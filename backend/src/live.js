import { timingSafeEqual } from 'node:crypto';

const ALLOWED_DOMAIN = 'holbertonschool.com';

async function verifyGoogleAccessToken(token, fetchImpl = fetch) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const response = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!response.ok) return null;
  const profile = await response.json();
  return isAllowedEmail(profile.email) ? { email: profile.email.toLowerCase(), subject: profile.sub || null } : null;
}

function isAllowedEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
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
  if (!session || !event?.participantSession) return session;
  const participant = event.participantSession;
  const name = participant.displayName || participant.name || 'Participant inconnu';
  const existing = session.participants.find((item) => item.name === name);
  const joinedAt = participant.startTime || event.eventTime || new Date().toISOString();
  if (event.type.endsWith('.left')) {
    if (existing) existing.leftAt = participant.endTime || event.eventTime || new Date().toISOString();
    return session;
  }
  const next = existing || { name, status: 'unknown', lateMinutes: 0 };
  next.joinedAt = joinedAt;
  const joined = Date.parse(joinedAt);
  const start = Date.parse(session.scheduledStart);
  next.lateMinutes = Number.isNaN(joined) || Number.isNaN(start) ? 0 : Math.max(0, Math.ceil((joined - start) / 60000));
  next.status = next.lateMinutes > 2 ? 'late' : 'on-time';
  if (!existing) session.participants.push(next);
  return session;
}

function getParticipantStatuses(session) {
  const current = new Map((session?.participants || []).map((participant) => [participant.email || participant.name, participant]));
  const expectedStatuses = (session?.expectedParticipants || []).map((expected) => {
    const key = expected.email || expected.name || expected.displayName;
    const participant = current.get(key) || current.get(expected.name || expected.displayName);
    return participant || { name: expected.displayName || expected.name, email: expected.email || null, status: 'absent', lateMinutes: 0 };
  });
  const expectedKeys = new Set((session?.expectedParticipants || []).flatMap((expected) => [expected.email, expected.name, expected.displayName].filter(Boolean)));
  return [...expectedStatuses, ...(session?.participants || []).filter((participant) => !expectedKeys.has(participant.email) && !expectedKeys.has(participant.name))];
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
  const rows = participants.map((participant) => `<tr><td>${escapeHtml(participant.name)}</td><td class="${participant.status === 'late' ? 'late' : participant.status === 'absent' ? 'absent' : ''}">${escapeHtml(participant.status)}</td><td>${escapeHtml(participant.lateMinutes ? `${participant.lateMinutes} min` : '-')}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport de réunion</title><style>:root{color-scheme:dark;--ink:#160b12;--panel:#24101b;--paper:#fff5f7;--muted:#d5b8c2;--cherry:#ff2d55}body{margin:0;padding:32px;background:var(--ink);color:var(--paper);font:16px Arial,sans-serif}main{max-width:960px;margin:auto}.eyebrow{color:var(--cherry);font-weight:800;letter-spacing:.12em}section{padding:24px;margin-top:20px;background:var(--panel);border:1px solid #683345}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #683345}.late{color:var(--cherry);font-weight:800}.absent{color:var(--muted);font-weight:800}</style></head><body><main><p class="eyebrow">HOLBIES MEET TRACKER</p><h1>Rapport de réunion</h1><p>Mentor : ${escapeHtml(session?.mentorEmail)}</p><section><h2>Présences</h2><table><thead><tr><th>Participant</th><th>Statut</th><th>Retard</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Aucune présence enregistrée.</td></tr>'}</tbody></table></section></main></body></html>`;
}

export { ALLOWED_DOMAIN, applyMeetEvent, calculateStatus, createLiveStore, decodeWorkspaceEvent, getParticipantStatuses, isAllowedEmail, renderReportHtml, verifyEventsSecret, verifyGoogleAccessToken };
