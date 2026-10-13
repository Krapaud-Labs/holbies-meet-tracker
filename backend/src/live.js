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

function createLiveStore() {
  const sessions = new Map();

  return {
    get(id) {
      return sessions.get(id) || null;
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
  const participants = Array.isArray(session?.participants) ? session.participants : [];
  const rows = participants.map((participant) => `<tr><td>${escapeHtml(participant.name)}</td><td class="${participant.status === 'late' ? 'late' : ''}">${escapeHtml(participant.status)}</td><td>${escapeHtml(participant.lateMinutes ? `${participant.lateMinutes} min` : '-')}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport de réunion</title><style>:root{color-scheme:dark;--ink:#160b12;--panel:#24101b;--paper:#fff5f7;--muted:#d5b8c2;--cherry:#ff2d55}body{margin:0;padding:32px;background:var(--ink);color:var(--paper);font:16px Arial,sans-serif}main{max-width:960px;margin:auto}.eyebrow{color:var(--cherry);font-weight:800;letter-spacing:.12em}section{padding:24px;margin-top:20px;background:var(--panel);border:1px solid #683345}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #683345}.late{color:var(--cherry);font-weight:800}</style></head><body><main><p class="eyebrow">HOLBIES MEET TRACKER</p><h1>Rapport de réunion</h1><p>Mentor : ${escapeHtml(session?.mentorEmail)}</p><section><h2>Présences</h2><table><thead><tr><th>Participant</th><th>Statut</th><th>Retard</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Aucune présence enregistrée.</td></tr>'}</tbody></table></section></main></body></html>`;
}

export { ALLOWED_DOMAIN, calculateStatus, createLiveStore, isAllowedEmail, renderReportHtml, verifyGoogleAccessToken };
