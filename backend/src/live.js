import { timingSafeEqual } from 'node:crypto';

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'holbertonschool.com').toLowerCase();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

async function verifyGoogleAccessToken(token, fetchImpl = fetch) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response;
  try {
    response = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return null;
  const profile = await response.json();
  const expiresIn = Number(profile.expires_in);
  const scopes = typeof profile.scope === 'string' ? profile.scope.split(/\s+/).filter(Boolean) : [];
  const audienceMatches = !GOOGLE_CLIENT_ID || profile.aud === GOOGLE_CLIENT_ID;
  const issuerMatches = !profile.iss || profile.iss === 'https://accounts.google.com' || profile.iss === 'accounts.google.com';
  const scopeMatches = scopes.length === 0 || scopes.includes('https://www.googleapis.com/auth/meetings.space.readonly');
  const verified = profile.email_verified === undefined || profile.email_verified === 'true' || profile.email_verified === true;
  return audienceMatches && issuerMatches && verified && (Number.isNaN(expiresIn) || expiresIn > 0) && scopeMatches && isAllowedEmail(profile.email)
    ? { email: profile.email.toLowerCase(), subject: profile.sub || null }
    : null;
}

function isAllowedEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

function normalizeIdentity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function identityKeys(row) {
  const email = String(row?.email || '').trim().toLowerCase();
  const name = normalizeIdentity(row?.name || row?.displayName);
  const keys = new Set();
  if (email) {
    keys.add(`email:${email}`);
    const id = email.match(/^(\d{4,5})@holbertonstudents\.com$/)?.[1];
    if (id) keys.add(`student-id:${id}`);
    const local = email.split('@')[0];
    if (!/^\d{4,5}$/.test(local)) keys.add(`name:${normalizeIdentity(local.replace(/[._-]+/g, ' '))}`);
  }
  if (name && name !== 'participant inconnu') keys.add(`name:${name}`);
  return [...keys];
}

function mergeIdentityRows(rows) {
  const merged = [];
  const indexes = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || (!row.email && !row.name && !row.displayName)) continue;
    const keys = identityKeys(row);
    const matchIndex = keys.map((key) => indexes.get(key)).find((index) => index !== undefined);
    if (matchIndex === undefined) {
      const next = { ...row, email: row.email?.toLowerCase?.() || row.email || null, leftAt: row.leftAt || row.lastLeave || null };
      merged.push(next);
      keys.forEach((key) => indexes.set(key, merged.length - 1));
      continue;
    }
    const current = merged[matchIndex];
    const joinedAt = [current.joinedAt, current.firstJoin, row.joinedAt, row.firstJoin].filter(Boolean).sort()[0] || null;
    const leftAt = [current.leftAt, current.lastLeave, row.leftAt, row.lastLeave].filter(Boolean).sort().at(-1) || null;
    merged[matchIndex] = { ...current, ...row, name: current.name || row.name || row.displayName, email: current.email || row.email || null, joinedAt, leftAt };
    identityKeys(merged[matchIndex]).forEach((key) => indexes.set(key, matchIndex));
  }
  return merged;
}

function verifyEventsSecret(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function createLiveStore() {
  const sessions = new Map();

  return {
    get(id) {
      return sessions.get(id) || null;
    },
    findByMeeting(meetingId) {
      return [...sessions.values()].find((session) => session.meetingId === meetingId) || null;
    },
    upsert(session) {
      sessions.set(session.id, session);
      return session;
    },
    remove(id) {
      sessions.delete(id);
    },
    size() {
      return sessions.size;
    },
  };
}

function decodeWorkspaceEvent(payload) {
  const encoded = payload?.message?.data;
  if (!encoded) return null;
  try { return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')); } catch { return null; }
}

function applyMeetEvent(session, event) {
  if (!session || !event) return session;
  if (event.type?.endsWith('.conference.v2.ended')) {
    session.endedAt = event.eventTime || new Date().toISOString();
    return session;
  }
  if (!event.participantSession) return session;
  const participant = event.participantSession;
  const name = participant.displayName || participant.name || 'Participant inconnu';
  const email = participant.email?.toLowerCase?.() || null;
  const existing = session.participants.find((item) => (email && item.email?.toLowerCase?.() === email) || item.name === name);
  const joinedAt = participant.startTime || event.eventTime || new Date().toISOString();
  if (event.type.endsWith('.left')) {
    if (existing) {
      const leftAt = participant.endTime || event.eventTime || new Date().toISOString();
      if (!existing.leftAt || Date.parse(leftAt) > Date.parse(existing.leftAt)) existing.leftAt = leftAt;
    }
    return session;
  }
  const next = existing || { name, email, status: 'unknown', lateMinutes: 0 };
  if (!next.joinedAt || Date.parse(joinedAt) < Date.parse(next.joinedAt)) next.joinedAt = joinedAt;
  if (email) next.email = email;
  const status = calculateStatus(next.joinedAt, session.scheduledStart);
  next.lateMinutes = status.lateMinutes;
  next.status = status.status;
  if (!existing) session.participants.push(next);
  return session;
}

function applyParticipantSnapshot(session, participants) {
  if (!session || !Array.isArray(participants)) return session;
  const incoming = participants
    .filter((participant) => participant && (participant.name || participant.email))
    .slice(0, 250)
    .map((participant) => ({ ...participant, name: participant.name || participant.email || 'Participant inconnu', email: participant.email?.toLowerCase?.() || null }));
  session.participants = mergeIdentityRows([...(session.participants || []), ...incoming]).map((participant) => {
    const status = calculateStatus(participant.joinedAt, session.scheduledStart);
    return { ...participant, status: status.status, lateMinutes: status.lateMinutes };
  });
  return session;
}

function getParticipantStatuses(session) {
  const expected = mergeIdentityRows(session?.expectedParticipants || []);
  const current = mergeIdentityRows(session?.participants || []);
  const expectedStatuses = expected.map((expectedParticipant) => {
    const participant = current.find((candidate) => identityKeys(candidate).some((key) => identityKeys(expectedParticipant).includes(key)));
    return participant || {
      name: expectedParticipant.displayName || expectedParticipant.name,
      email: expectedParticipant.email || null,
      status: session?.endedAt ? 'absent' : 'waiting',
      lateMinutes: 0,
    };
  });
  return [...expectedStatuses, ...current.filter((participant) => !expected.some((item) => identityKeys(item).some((key) => identityKeys(participant).includes(key))))];
}

function calculateStatus(joinedAt, scheduledStart, toleranceMinutes = 2) {
  const joined = Date.parse(joinedAt || '');
  const start = Date.parse(scheduledStart || '');
  if (Number.isNaN(joined) || Number.isNaN(start)) return { status: 'unknown', lateMinutes: 0 };
  const lateMinutes = Math.max(0, Math.ceil((joined - start) / 60000));
  return lateMinutes > toleranceMinutes
    ? { status: 'late', lateMinutes }
    : { status: 'on-time', lateMinutes: 0 };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderReportHtml(session) {
  const participants = getParticipantStatuses(session);
  const counts = participants.reduce((summary, participant) => {
    if (participant.status === 'on-time') summary.onTime += 1;
    else if (participant.status === 'late') summary.late += 1;
    else if (participant.status === 'waiting') summary.waiting += 1;
    else if (participant.status === 'absent') summary.absent += 1;
    return summary;
  }, { onTime: 0, late: 0, waiting: 0, absent: 0 });
  const labels = { 'on-time': "à l'heure", late: 'en retard', waiting: 'en attente', absent: 'absent', unknown: 'inconnu' };
  const rows = participants.map((participant) => `<tr><td>${escapeHtml(participant.name)}</td><td class="${participant.status === 'late' ? 'late' : participant.status === 'absent' ? 'absent' : ''}">${escapeHtml(labels[participant.status] || participant.status)}</td><td>${escapeHtml(participant.lateMinutes ? `${participant.lateMinutes} min` : '-')}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Rapport de réunion</title><style>
:root{color-scheme:light dark;--ink:#fff7f8;--panel:#ffffff;--paper:#24101b;--muted:#704c59;--line:#efd8df;--cherry:#d7194f;--cherry-soft:#fff0f3;--shadow:0 18px 50px rgba(83,20,42,.12)}
@media(prefers-color-scheme:dark){:root{--ink:#160b12;--panel:#24101b;--paper:#fff5f7;--muted:#d5b8c2;--line:#683345;--cherry:#ff2d55;--cherry-soft:#351521;--shadow:0 18px 50px rgba(0,0,0,.25)}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:clamp(18px,4vw,48px);background:radial-gradient(circle at 100% 0,rgba(255,45,85,.14),transparent 34%),var(--ink);color:var(--paper);font:16px Arial,Helvetica,sans-serif}main{max-width:960px;margin:auto}.eyebrow{margin:0 0 10px;color:var(--cherry);font-size:12px;font-weight:800;letter-spacing:.14em}h1{margin:0;font-size:clamp(28px,5vw,48px);letter-spacing:-.06em}h2{margin:0 0 18px;font-size:22px}header{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:28px}header p{margin:0;color:var(--muted)}section{padding:clamp(18px,3vw,30px);margin-top:20px;background:var(--panel);border:1px solid var(--line);border-top:3px solid var(--cherry);border-radius:18px;box-shadow:var(--shadow)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}tbody tr:last-child td{border-bottom:0}.late{color:var(--cherry);font-weight:800}.absent{color:var(--muted);font-weight:800}@media(max-width:600px){body{padding:16px}header{display:block}header p{margin-top:8px}table{font-size:14px}th,td{padding:11px 6px}}
</style><style>body{overflow-x:hidden}main{width:min(100%,960px)}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.summary span{padding:14px;border:1px solid var(--line);border-top:3px solid var(--cherry);border-radius:10px}.table-wrap{overflow-x:auto}table{min-width:560px}th,td{overflow-wrap:anywhere;vertical-align:top}caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:600px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}</style></head><body><main><header><div><p class="eyebrow">HOLBIES MEET TRACKER</p><h1>Rapport de réunion</h1></div><p>Mentor : ${escapeHtml(session?.mentorEmail)}</p></header><section><h2>Résumé des présences</h2><div class="summary"><span>À l'heure : ${counts.onTime}</span><span>En retard : ${counts.late}</span><span>En attente : ${counts.waiting}</span><span>Absents : ${counts.absent}</span></div></section><section><h2>Détail des participants</h2><div class="table-wrap"><table><caption>Détail des participants</caption><thead><tr><th scope="col">Participant</th><th scope="col">Statut</th><th scope="col">Retard</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Aucune présence enregistrée.</td></tr>'}</tbody></table></div></section></main></body></html>`;
}

export { ALLOWED_DOMAIN, applyMeetEvent, applyParticipantSnapshot, calculateStatus, createLiveStore, decodeWorkspaceEvent, getParticipantStatuses, identityKeys, isAllowedEmail, mergeIdentityRows, renderReportHtml, verifyEventsSecret, verifyGoogleAccessToken };
