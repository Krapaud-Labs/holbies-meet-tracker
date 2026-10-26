const signInButton = document.querySelector('#sign-in-button');
const signOutButton = document.querySelector('#sign-out-button');
const authStatus = document.querySelector('#auth-status');
const connectedAccount = document.querySelector('#connected-account');
const accountAvatar = document.querySelector('#account-avatar');
const accountName = document.querySelector('#account-name');
const accountEmail = document.querySelector('#account-email');
const calendarStatus = document.querySelector('#calendar-status');
const calendarMenu = document.querySelector('#calendar-menu');
const calendarPicker = document.querySelector('#calendar-picker');
const calendarPickerList = document.querySelector('#calendar-picker-list');
const calendarSettingsButton = document.querySelector('#calendar-settings-button');
const calendarRefreshButton = document.querySelector('#calendar-refresh-button');
const eventList = document.querySelector('#event-list');
const attendanceStatus = document.querySelector('#attendance-status');
const analyzeOpenMeetButton = document.querySelector('#analyze-open-meet-button');
const participantList = document.querySelector('#participant-list');
const exportButton = document.querySelector('#export-button');
const htmlExportButton = document.querySelector('#html-export-button');
const exportConsent = document.querySelector('#export-consent');
const localExportButton = document.querySelector('#local-export-button');
const attendanceSummary = document.querySelector('#attendance-summary');
const summaryOnTime = document.querySelector('#summary-on-time');
const summaryLate = document.querySelector('#summary-late');
const summaryAbsent = document.querySelector('#summary-absent');
const summaryWaiting = document.querySelector('#summary-waiting');
const liveIndicator = document.querySelector('#live-indicator');
const liveStatus = document.querySelector('#live-status');
const liveReportLink = document.querySelector('#live-report-link');

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const MEET_RECORDS_URL = 'https://meet.googleapis.com/v2/conferenceRecords';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/spreadsheets'];
// URL du tunnel HTTPS gratuit actuellement actif sur le VPS.
const LIVE_BACKEND_URL = globalThis.HOLBIES_CONFIG?.liveBackendUrl || '';
let currentAccessToken = null;
let calendarLoadSerial = 0;
let currentAttendanceRows = [];
let currentCollectionComplete = false;
let currentAgendaAttendeesOmitted = false;
let currentReportFilenameDate = '';
let calendarEvents = [];
let calendarCatalog = [];
let liveSessionId = null;
let livePollTimer = null;
let liveSocket = null;
let liveSocketReconnectTimer = null;
let liveSocketReconnectAttempt = 0;
let liveSocketStopped = false;
const AUTH_TIMEOUT_MS = 15000;
const AUTH_FAILURES = Object.freeze({
  cancelled: {
    code: 'AUTH_CANCELLED',
    message: 'Connexion annulée. Vous pouvez réessayer avec le bouton.',
  },
  permissionIncomplete: {
    code: 'AUTH_PERMISSION_INCOMPLETE',
    message: 'Autorisation incomplète. Réessayez et examinez les accès demandés.',
  },
  timeout: {
    code: 'AUTH_TIMEOUT',
    message: 'Google met trop de temps à répondre. Réessayez. Code : AUTH_TIMEOUT.',
  },
  tokenInvalid: {
    code: 'AUTH_TOKEN_INVALID',
    message: "La connexion n'a pas abouti. Relancez-la depuis ce bouton. Code : AUTH_TOKEN_INVALID.",
  },
  unknown: {
    code: 'AUTH_UNKNOWN',
    message: 'Connexion impossible pour le moment. Réessayez; si le problème persiste, communiquez le code AUTH_UNKNOWN au support.',
  },
});
const LIVE_START_WINDOW_MS = 15 * 60 * 1000;
const LIVE_END_GRACE_MS = 10 * 60 * 1000;
const MAX_GOOGLE_PAGES = 100;
const MAX_PAGE_TOKEN_LENGTH = 4096;

liveReportLink.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!currentAccessToken || !liveSessionId) return;

  try {
    const response = await fetchWithRetry(liveReportLink.href, {
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });
    if (!response.ok) throw new Error(`report-request-failed-${response.status}`);
    const reportHtml = await response.text();
    const reportUrl = URL.createObjectURL(new Blob([reportHtml], { type: 'text/html;charset=utf-8' }));
    await chrome.tabs.create({ url: reportUrl });
    setTimeout(() => URL.revokeObjectURL(reportUrl), 60_000);
  } catch (error) {
    liveStatus.textContent = 'Rapport live indisponible. Actualisez la session et réessayez.';
  }
});

function withTimeout(promise, timeoutMs, errorCode) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function stopLiveTracking() {
  if (livePollTimer) clearInterval(livePollTimer);
  if (liveSocketReconnectTimer) clearTimeout(liveSocketReconnectTimer);
  if (liveSocket) liveSocket.close(1000, 'tracking-stopped');
  livePollTimer = null;
  liveSocketReconnectTimer = null;
  liveSocket = null;
  liveSocketReconnectAttempt = 0;
  liveSocketStopped = true;
  liveSessionId = null;
  liveIndicator.hidden = true;
  liveReportLink.hidden = true;
}

function shouldTrackLive(event, now = Date.now()) {
  const start = Date.parse(event?.start?.dateTime || event?.start?.date || '');
  const end = Date.parse(event?.end?.dateTime || event?.end?.date || '');
  return !Number.isNaN(start) && !Number.isNaN(end)
    && now >= start - LIVE_START_WINDOW_MS
    && now <= end + LIVE_END_GRACE_MS;
}

function describeLiveBackendError(error) {
  const status = error?.message?.match(/request-failed-(\d+)/)?.[1];
  if (status === '401' || status === '403') return `Accès backend refusé (HTTP ${status}). Reconnectez le compte Google.`;
  if (status) return `Backend live en erreur (HTTP ${status}).`;
  return 'Backend live inaccessible. Vérifiez le tunnel HTTPS et votre connexion.';
}

async function fetchMeetLiveSnapshot(recordName) {
  const recordId = recordName.split('/').pop();
  const participantsUrl = `${MEET_RECORDS_URL}/${recordId}/participants?pageSize=250`;
  const participants = await fetchAllMeetPages(participantsUrl, 'participants', currentAccessToken);
  return participants.map((participant) => {
    const identity = MeetAttendance.getParticipantIdentity(participant);
    return {
      name: identity.name,
      email: normalizeEmail(participant.signedinUser?.email || participant.user?.signedinUser?.email),
      joinedAt: participant.earliestStartTime || null,
      leftAt: participant.latestEndTime || null,
    };
  }).filter((participant) => participant.name && participant.name !== 'Participant inconnu');
}

async function startLiveTracking(meetingId, scheduledStart, expectedParticipants) {
  if (!LIVE_BACKEND_URL || !currentAccessToken) return;
  stopLiveTracking();
  liveSocketStopped = false;
  try {
    const created = await fetchWithRetry(`${LIVE_BACKEND_URL}/api/v1/live/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, scheduledStart, expectedParticipants }),
    });
    const session = await created.json();
    liveSessionId = session.id;
    liveIndicator.hidden = false;
    liveStatus.textContent = 'Connexion temps réel en cours…';
    liveReportLink.href = `${LIVE_BACKEND_URL}/reports/${encodeURIComponent(liveSessionId)}`;
    liveReportLink.hidden = false;
    const refreshLiveSession = async () => {
      const snapshot = await fetchMeetLiveSnapshot(meetingId);
      await fetchWithRetry(`${LIVE_BACKEND_URL}/api/v1/live/sessions/${encodeURIComponent(liveSessionId)}/participants`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${currentAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: snapshot }),
      });
      const response = await fetchWithRetry(`${LIVE_BACKEND_URL}/api/v1/live/sessions/${encodeURIComponent(liveSessionId)}`, { headers: { Authorization: `Bearer ${currentAccessToken}` } });
      const liveSession = await response.json();
      const rows = (liveSession.participantStatuses || []).map((participant) => ({
        name: participant.name,
        status: formatAttendanceStatus(participant.status),
        lateMinutes: participant.lateMinutes || 0,
      }));
      renderLiveRows(rows);
    };
    const startPollingFallback = () => {
      if (liveSocketStopped || livePollTimer) return;
      liveStatus.textContent = 'Temps réel indisponible, actualisation toutes les 5 secondes.';
      livePollTimer = setInterval(() => refreshLiveSession().catch(() => {}), 5000);
    };
    const stopPollingFallback = () => {
      if (!livePollTimer) return;
      clearInterval(livePollTimer);
      livePollTimer = null;
    };
    const scheduleSocketReconnect = () => {
      if (liveSocketStopped || liveSocketReconnectTimer) return;
      const delay = Math.min(30_000, 1_000 * (2 ** liveSocketReconnectAttempt));
      liveSocketReconnectAttempt += 1;
      liveSocketReconnectTimer = setTimeout(() => {
        liveSocketReconnectTimer = null;
        connectLiveSocket();
      }, delay);
    };
    const connectLiveSocket = async () => {
      if (liveSocketStopped || !liveSessionId || typeof WebSocket === 'undefined') {
        startPollingFallback();
        return;
      }
      let ticketResponse;
      try {
        ticketResponse = await fetchWithRetry(`${LIVE_BACKEND_URL}/api/v1/live/sessions/${encodeURIComponent(liveSessionId)}/stream-ticket`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentAccessToken}` },
        });
        if (!ticketResponse.ok) throw new Error(`websocket-ticket-failed-${ticketResponse.status}`);
      } catch {
        startPollingFallback();
        scheduleSocketReconnect();
        return;
      }
      const { ticket } = await ticketResponse.json();
      if (!ticket || liveSocketStopped) return;
      const socketUrl = `${LIVE_BACKEND_URL.replace(/^http/i, 'ws')}/api/v1/live/sessions/${encodeURIComponent(liveSessionId)}/stream?ticket=${encodeURIComponent(ticket)}`;
      let socket;
      try {
        socket = new WebSocket(socketUrl, ['holbies-live-v1']);
      } catch {
        startPollingFallback();
        scheduleSocketReconnect();
        return;
      }
      liveSocket = socket;
      socket.addEventListener('open', () => {
        if (liveSocket !== socket || liveSocketStopped) return;
        liveSocketReconnectAttempt = 0;
        stopPollingFallback();
        liveStatus.textContent = 'Présences actualisées en temps réel.';
      });
      socket.addEventListener('message', (event) => {
        if (liveSocket !== socket) return;
        try {
          const payload = JSON.parse(event.data);
          const participantStatuses = payload.participantStatuses || payload.session?.participantStatuses;
          if (!Array.isArray(participantStatuses)) return;
          const rows = participantStatuses.map((participant) => ({
            name: participant.name,
            email: participant.email || '',
            status: formatAttendanceStatus(participant.status),
            lateMinutes: participant.lateMinutes || 0,
          }));
          renderLiveRows(rows);
        } catch {
          // Ignore malformed server messages and keep the connection alive.
        }
      });
      socket.addEventListener('error', () => {
        if (liveSocket === socket) startPollingFallback();
      });
      socket.addEventListener('close', () => {
        if (liveSocket !== socket) return;
        liveSocket = null;
        startPollingFallback();
        scheduleSocketReconnect();
      });
    };
    await refreshLiveSession();
    startPollingFallback();
    connectLiveSocket();
  } catch (error) {
    liveStatus.textContent = `${describeLiveBackendError(error)} Le relevé Meet reste disponible localement.`;
  }
}

function normalizeEmail(email) {
  return MeetAttendance.normalizeEmail(email);
}

function requireAccessToken(token) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('google-auth-required');
  return token.trim();
}

function isIdentityToCheck(status) {
  return ['identity-to-check', 'inconnu', 'à vérifier'].includes(status);
}

function displayAttendanceStatus(status) {
  return isIdentityToCheck(status) ? 'à vérifier' : formatAttendanceStatus(status);
}

function validatePageToken(pageToken) {
  if (typeof pageToken !== 'string'
    || !pageToken.trim()
    || pageToken !== pageToken.trim()
    || pageToken.length > MAX_PAGE_TOKEN_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(pageToken)) {
    throw new Error('google-pagination-invalid-page-token');
  }
  return pageToken;
}

function readNextPageToken(page, seenTokens, pageIndex) {
  if (!Object.prototype.hasOwnProperty.call(page || {}, 'nextPageToken') || page.nextPageToken === null) return null;
  const pageToken = validatePageToken(page.nextPageToken);
  if (seenTokens.has(pageToken)) throw new Error('google-pagination-token-loop');
  if (pageIndex === MAX_GOOGLE_PAGES - 1) throw new Error('google-pagination-page-limit');
  seenTokens.add(pageToken);
  return pageToken;
}

function selectClosestMeetRecord(records, scheduledStart) {
  const target = Date.parse(scheduledStart || '');
  return [...records]
    .filter((record) => record?.name && !Number.isNaN(Date.parse(record.startTime || '')))
    .sort((left, right) => {
      if (Number.isNaN(target)) return Date.parse(right.startTime) - Date.parse(left.startTime);
      return Math.abs(Date.parse(left.startTime) - target) - Math.abs(Date.parse(right.startTime) - target);
    })[0] || null;
}

function formatExportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
}

function splitName(name) {
  const parts = String(name || 'Participant inconnu').trim().split(/\s+/);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

function exportValues() {
  const identityChecks = currentAttendanceRows.filter((row) => isIdentityToCheck(row.status)).length;
  const partial = identityChecks > 0 || currentAgendaAttendeesOmitted;
  const reportLabel = partial ? 'Rapport PARTIEL' : 'Rapport COMPLET';
  return [
    [reportLabel, '', '', '', '', '', ''],
    [`Identités à vérifier : ${identityChecks}`, '', '', '', '', '', ''],
    [currentAgendaAttendeesOmitted ? 'Roster Agenda incomplet : des invités peuvent manquer' : '', '', '', '', '', '', ''],
    ['Prénom', 'Nom', 'Date', 'Réunion', 'Arrivée', 'Départ', 'Statut'],
    ...currentAttendanceRows.map((row) => [row.firstName, row.lastName, row.date, row.meeting, row.arrival, row.departure, displayAttendanceStatus(row.status)]),
  ];
}

function formatCsvCell(value) {
  const text = String(value ?? '');
  const formulaLike = /^[\u0000-\u0020\u00a0\uFEFF]*[=+\-@]/u.test(text);
  const safeText = formulaLike ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function downloadLocalCsv() {
  if (!currentCollectionComplete || currentAttendanceRows.length === 0) return;
  const csv = exportValues().map((row) => row.map(formatCsvCell).join(';')).join('\n');
  const url = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
  chrome.downloads.download({ url, filename: `holbies-meet-presences-${new Date().toISOString().slice(0, 10)}.csv`, saveAs: true });
}

function escapeReportHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function formatReportTime(value) {
  const text = String(value ?? '').trim();
  const time = text.match(/\b(\d{1,2}:\d{2})(?::\d{2})?\b/);
  return time ? time[1].padStart(5, '0') : '-';
}

function createLocalReportHtmlBase(rows) {
  const counts = rows.reduce((summary, row) => {
    const status = String(row.status || '').replace('’', "'");
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
  const partial = currentAgendaAttendeesOmitted || rows.some((row) => isIdentityToCheck(row.status));
  const identityChecks = rows.filter((row) => isIdentityToCheck(row.status)).length;
  const rosterWarning = currentAgendaAttendeesOmitted ? ' · Roster Agenda incomplet : des invités peuvent manquer' : '';
  const title = `${partial ? 'Rapport PARTIEL' : 'Rapport COMPLET'} · Identités à vérifier : ${identityChecks} · ${rows[0]?.meeting || 'Réunion Google Meet'}${rosterWarning}`;
  const tableRows = rows.map((row) => `<tr><td data-column="participant">${escapeReportHtml(row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim())}</td><td data-column="email">${escapeReportHtml(row.email || '')}</td><td data-column="status" class="${row.status === 'en retard' ? 'late' : row.status === 'absent' ? 'absent' : ''}">${escapeReportHtml(displayAttendanceStatus(row.status))}</td><td data-column="arrival">${escapeReportHtml(formatReportTime(row.arrival))}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeReportHtml(title)}</title><style>:root{color-scheme:light dark;--bg:#fff7f8;--panel:#fff;--ink:#24101b;--muted:#704c59;--line:#efd8df;--accent:#d7194f}@media(prefers-color-scheme:dark){:root{--bg:#160b12;--panel:#24101b;--ink:#fff5f7;--muted:#d5b8c2;--line:#683345;--accent:#ff2d55}}*{box-sizing:border-box}body{margin:0;min-width:0;padding:clamp(18px,4vw,48px);overflow-x:hidden;background:var(--bg);color:var(--ink);font:16px Arial,sans-serif}main{width:min(100%,1100px);margin:auto}h1{margin:0 0 8px}p{color:var(--muted)}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{padding:10px 14px;border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}.summary{display:flex;gap:12px;flex-wrap:wrap}.summary span{padding:12px 16px;border:1px solid var(--line);border-top:3px solid var(--accent);background:var(--panel);border-radius:10px}.sort-help{color:var(--muted);font-size:14px}.column-hidden{display:none!important}section{margin-top:24px;padding:clamp(14px,3vw,20px);background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow-x:auto}table{width:100%;min-width:620px;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);overflow-wrap:anywhere;vertical-align:top}th:nth-child(1){width:28%}th:nth-child(2){width:36%}th:nth-child(3){width:18%}th:nth-child(4){width:18%}th{color:var(--muted);font-size:12px;text-transform:uppercase}th[role=button]{cursor:pointer}th[role=button]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.late{color:var(--accent);font-weight:700}.absent{color:var(--muted);font-weight:700}@media(max-width:700px){body{padding:16px}.summary{gap:8px}.summary span{flex:1 1 140px}section{margin-top:18px}}@media print{body{padding:0;background:#fff;color:#000}.no-print{display:none!important}section{margin-top:12px;padding:0;border:0;overflow:visible}table{min-width:0}.summary span{break-inside:avoid}}</style></head><body><main><h1>${escapeReportHtml(title)}</h1><p>Rapport local Holbies Meet · ${escapeReportHtml(rows[0]?.date || new Date().toLocaleString('fr-FR'))}</p><div class="actions no-print"><button type="button" id="print-report">Télécharger en PDF</button></div><div class="summary"><span>À l'heure : ${counts["à l'heure"] || 0}</span><span>En retard : ${counts["en retard"] || 0}</span><span>En attente : ${counts["en attente"] || 0}</span><span>Absents : ${counts.absent || 0}</span></div><p class="sort-help no-print">Cliquez sur Participant, E-mail, Statut ou Arrivée pour trier. Un second clic inverse l’ordre.</p><section><table><thead><tr><th data-column="participant" data-sort-column="participant">Participant</th><th data-column="email" data-sort-column="email">E-mail</th><th data-column="status" data-sort-column="status">Statut</th><th data-column="arrival" data-sort-column="arrival">Arrivée</th></tr></thead><tbody>${tableRows}</tbody></table></section></main><script>document.getElementById('print-report').addEventListener('click',()=>window.print());const statusRank={'en retard':0,absent:1,'en attente':2,"à l'heure":3};document.querySelectorAll('th[data-sort-column]').forEach((header)=>{header.setAttribute('role','button');header.tabIndex=0;header.addEventListener('click',()=>sortRows(header));header.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();sortRows(header);}});});function sortRows(header){const column=header.dataset.sortColumn;const direction=header.dataset.sortDirection==='asc'?'desc':'asc';document.querySelectorAll('th[data-sort-column]').forEach((item)=>item.removeAttribute('aria-sort'));header.dataset.sortDirection=direction;header.setAttribute('aria-sort',direction==='asc'?'ascending':'descending');const cells=[...document.querySelectorAll('tbody tr')];cells.sort((left,right)=>{const leftValue=left.querySelector('[data-column="'+column+'"]')?.textContent.trim().toLocaleLowerCase('fr-FR')||'';const rightValue=right.querySelector('[data-column="'+column+'"]')?.textContent.trim().toLocaleLowerCase('fr-FR')||'';const comparison=column==='status'?(statusRank[leftValue]??99)-(statusRank[rightValue]??99):leftValue.localeCompare(rightValue,'fr',{numeric:true});return direction==='asc'?comparison:-comparison;});document.querySelector('tbody').replaceChildren(...cells);}</script></body></html>`;
}

function createLocalReportHtml(rows) {
  return createLocalReportHtmlBase(rows)
    .replace('table-layout:fixed', 'table-layout:auto')
    .replace('th:nth-child(3){width:18%}th:nth-child(4){width:18%}', 'th:nth-child(3),th:nth-child(4){width:1%;white-space:nowrap}');
}

async function exportAttendanceToHtml() {
  if (!currentCollectionComplete || !currentAttendanceRows.length) return;
  const reportUrl = URL.createObjectURL(new Blob([createLocalReportHtml(currentAttendanceRows)], { type: 'text/html;charset=utf-8' }));
  try {
    await chrome.tabs.create({ url: reportUrl });
    setTimeout(() => URL.revokeObjectURL(reportUrl), 60_000);
  } catch {
    URL.revokeObjectURL(reportUrl);
    setAttendanceState('unavailable', 'Ouverture du rapport HTML impossible. Autorisez les nouveaux onglets Chrome puis réessayez.');
  }
}

async function fetchWithRetry(url, options, attempts = 2) {
  const authorization = options?.headers?.Authorization;
  const token = typeof authorization === 'string' ? authorization.match(/^Bearer (.+)$/)?.[1] : null;
  requireAccessToken(token);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const body = await response.text();
      lastError = new Error(`request-failed-${response.status}`);
      lastError.apiMessage = body;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastError;
}

function setCalendarState(state, message) {
  calendarStatus.dataset.state = state;
  calendarStatus.textContent = message;
  calendarStatus.setAttribute('aria-busy', String(state === 'loading'));
  calendarRefreshButton.disabled = state === 'loading' || !currentAccessToken;
  calendarRefreshButton.setAttribute('aria-busy', String(state === 'loading'));
}

async function getSavedCalendarIds() {
  const stored = await chrome.storage.local.get('holbiesSelectedCalendarIds');
  return Array.isArray(stored.holbiesSelectedCalendarIds) ? stored.holbiesSelectedCalendarIds : null;
}

async function saveSelectedCalendarIds(ids) {
  await chrome.storage.local.set({ holbiesSelectedCalendarIds: ids });
}

function renderCalendarPicker(calendars, selectedIds) {
  const keepMenuOpen = !calendarMenu.hidden;
  calendarCatalog = calendars;
  calendarPickerList.replaceChildren();
  calendars.forEach((calendar) => {
    const label = document.createElement('label');
    label.className = 'calendar-choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = calendar.id;
    checkbox.checked = selectedIds.includes(calendar.id);
    checkbox.addEventListener('change', async () => {
      const ids = [...calendarPickerList.querySelectorAll('input:checked')].map((input) => input.value);
      await saveSelectedCalendarIds(ids);
      await refreshCalendar(currentAccessToken);
    });
    const name = document.createElement('span');
    name.textContent = calendar.summaryOverride || calendar.summary || calendar.id;
    label.append(checkbox, name);
    calendarPickerList.append(label);
  });
  setCalendarPickerOpen(keepMenuOpen);
}

function setCalendarPickerOpen(isOpen) {
  calendarMenu.hidden = !isOpen || calendarCatalog.length === 0;
  const open = isOpen && calendarCatalog.length > 0;
  calendarSettingsButton.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => calendarPickerList.querySelector('input')?.focus());
}

function closeCalendarPicker({ restoreFocus = true } = {}) {
  if (calendarMenu.hidden) return;
  setCalendarPickerOpen(false);
  if (restoreFocus) calendarSettingsButton.focus();
}

function trapCalendarPickerFocus(event) {
  if (calendarMenu.hidden || event.key !== 'Tab') return;
  const focusable = [...calendarMenu.querySelectorAll('input:not([disabled]), button:not([disabled])')];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function refreshCalendar(token) {
  const serial = ++calendarLoadSerial;
  try {
    return await loadCalendarEvents(token);
  } catch (error) {
    if (serial === calendarLoadSerial) {
      const message = error?.message?.includes('calendar-list-request-failed-403')
        ? 'Reconnectez-vous pour autoriser la lecture de vos agendas.'
        : 'Impossible de charger votre agenda. Réessayez après la connexion.';
      setCalendarState('error', message);
    }
    throw error;
  }
}

function formatEventDate(event) {
  const start = event.start?.dateTime || event.start?.date;
  if (!start) return 'Date non renseignée';

  const date = new Date(start);
  return Number.isNaN(date.getTime())
    ? 'Date non renseignée'
    : new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: event.start?.dateTime ? 'short' : undefined,
      }).format(date);
}

function formatReportFilenameDate(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function setAttendanceState(state, message) {
  attendanceStatus.dataset.state = state;
  attendanceStatus.textContent = message;
  attendanceStatus.setAttribute('aria-busy', String(state === 'loading'));
}

function clearAttendanceRows() {
  currentAttendanceRows = [];
  currentCollectionComplete = false;
  currentAgendaAttendeesOmitted = false;
  currentReportFilenameDate = '';
  participantList.replaceChildren();
  summaryOnTime.textContent = '0';
  summaryLate.textContent = '0';
  summaryAbsent.textContent = '0';
  summaryWaiting.textContent = '0';
  attendanceSummary.hidden = true;
  exportButton.disabled = true;
  htmlExportButton.hidden = true;
  localExportButton.hidden = true;
}

function renderAttendanceRows(rows) {
  const safeRows = MeetAttendance.mergeAttendanceRows(Array.isArray(rows) ? rows : []);
  currentAttendanceRows = safeRows;
  const counts = safeRows.reduce((summary, row) => {
    if (row.status === 'à l’heure') summary.onTime += 1;
    else if (row.status === 'en retard') summary.late += 1;
    else if (row.status === 'absent') summary.absent += 1;
    else if (row.status === 'en attente') summary.waiting += 1;
    return summary;
  }, { onTime: 0, late: 0, absent: 0, waiting: 0 });
  summaryOnTime.textContent = String(counts.onTime);
  summaryLate.textContent = String(counts.late);
  summaryAbsent.textContent = String(counts.absent);
  summaryWaiting.textContent = String(counts.waiting);
  attendanceSummary.hidden = safeRows.length === 0;
  exportButton.disabled = safeRows.length === 0 || !exportConsent.checked || !currentCollectionComplete;
  htmlExportButton.hidden = safeRows.length === 0 || !currentCollectionComplete;

}

function renderLiveRows(rows) {
  const safeRows = MeetAttendance.mergeAttendanceRows(Array.isArray(rows) ? rows : []);
  currentCollectionComplete = false;
  currentAgendaAttendeesOmitted = false;
  currentReportFilenameDate = '';
  localExportButton.hidden = true;
  renderAttendanceRows(safeRows);
  setAttendanceState(safeRows.length ? 'success' : 'empty', safeRows.length
    ? `${safeRows.length} participant${safeRows.length > 1 ? 's' : ''} trouvé${safeRows.length > 1 ? 's' : ''}.`
    : 'Aucun participant connecté actuellement.');
}

async function exportAttendanceToSheets() {
  if (!currentAccessToken || currentAttendanceRows.length === 0 || !exportConsent.checked) return;
  if (!currentCollectionComplete) {
    setAttendanceState('unavailable', 'Export indisponible : attendez la fin réelle de la réunion et la fin complète de la collecte Meet.');
    return;
  }

  exportButton.disabled = true;
  exportButton.setAttribute('aria-busy', 'true');
  exportButton.textContent = 'Export en cours…';
  try {
    const sheetsSession = await withTimeout(chrome.identity.getAuthToken({ interactive: true, scopes: [...chrome.runtime.getManifest().oauth2.scopes, ...SHEETS_SCOPES] }), AUTH_TIMEOUT_MS, 'google-auth-timeout');
    const sheetsToken = requireAccessToken(normalizeAuthSession(sheetsSession).token);
    const createResponse = await fetchWithRetry('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title: `${currentAttendanceRows[0]?.meeting || 'Présences Meet'} - ${currentReportFilenameDate || new Date().toLocaleDateString('fr-FR')}` } }),
    });
    if (!createResponse.ok) throw new Error(`sheets-create-failed-${createResponse.status}`);
    const spreadsheet = await createResponse.json();
    if (!spreadsheet.spreadsheetId) throw new Error('sheets-missing-id');
    const folderId = await findOrCreateSheetsFolder(sheetsToken);
    await moveDriveFileToFolder(spreadsheet.spreadsheetId, folderId, sheetsToken);
    const values = exportValues();
    const sheetTitle = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
    const range = encodeURIComponent(`${sheetTitle}!A1:G${values.length}`);
    const updateResponse = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: `${sheetTitle}!A1:G${values.length}`, majorDimension: 'ROWS', values }),
    });
    if (!updateResponse.ok) throw new Error(`sheets-update-failed-${updateResponse.status}`);
    const partial = currentAgendaAttendeesOmitted || currentAttendanceRows.some((row) => isIdentityToCheck(row.status));
    setAttendanceState('success', `Rapport ${partial ? 'PARTIEL' : 'COMPLET'} exporté dans le dossier Drive « Holbies Meet Tracker ».`);
    exportButton.textContent = 'Exporter à nouveau';
  } catch (error) {
    const status = error?.message?.match(/request-failed-(\d+)/)?.[1];
    let detail = status ? ` (HTTP ${status})` : '';
    try {
      const apiError = JSON.parse(error?.apiMessage || '{}')?.error?.message;
      if (apiError) detail += ` : ${apiError}`;
    } catch {
      // The local CSV fallback remains available when the API returns non-JSON data.
    }
    setAttendanceState('unavailable', `Export Google Sheets impossible${detail}. Réessayez ou téléchargez le CSV local.`);
    exportButton.textContent = 'Réessayer l’export';
    localExportButton.hidden = false;
  } finally {
    exportButton.setAttribute('aria-busy', 'false');
    exportButton.disabled = currentAttendanceRows.length === 0 || !exportConsent.checked || !currentCollectionComplete;
  }
}

async function findOrCreateSheetsFolder(token) {
  const query = encodeURIComponent("name = 'Holbies Meet Tracker' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents");
  const listResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&pageSize=10&fields=files(id,name,mimeType,parents)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listResponse.ok) throw new Error(`drive-folder-list-failed-${listResponse.status}`);
  const folders = await listResponse.json();
  if (folders.files?.[0]?.id) return folders.files[0].id;

  const createResponse = await fetchWithRetry('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Holbies Meet Tracker', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] }),
  });
  if (!createResponse.ok) throw new Error(`drive-folder-create-failed-${createResponse.status}`);
  const folder = await createResponse.json();
  if (!folder.id) throw new Error('drive-folder-missing-id');
  return folder.id;
}

async function moveDriveFileToFolder(fileId, folderId, token) {
  const metadataResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,parents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metadataResponse.ok) throw new Error(`drive-file-metadata-failed-${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  const oldParents = (metadata.parents || []).filter((parent) => parent !== folderId);
  const params = new URLSearchParams({ addParents: folderId, fields: 'id,parents' });
  if (oldParents.length) params.set('removeParents', oldParents.join(','));
  const moveResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!moveResponse.ok) throw new Error(`drive-file-move-failed-${moveResponse.status}`);
}

function prepareAttendanceView(event) {
  currentAttendanceRows = [];
  currentCollectionComplete = false;
  currentAgendaAttendeesOmitted = Boolean(event.attendeesOmitted);
  currentReportFilenameDate = '';
  attendanceSummary.hidden = true;
  exportButton.disabled = true;
  htmlExportButton.hidden = true;
  localExportButton.hidden = true;
  if (!getMeetingLink(event)) {
    setAttendanceState('unavailable', 'Aucun lien Google Meet pour cet événement.');
    return;
  }

  setAttendanceState('ready', 'Réunion prête à être analysée.');
}

async function detectOpenMeet() {
  if (!currentAccessToken || !chrome.tabs?.query) return;
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const tab = tabs.find((candidate) => candidate.active && extractMeetingCode(candidate?.url))
    || tabs.find((candidate) => extractMeetingCode(candidate?.url));
  const meetingCode = extractMeetingCode(tab?.url);
  analyzeOpenMeetButton.hidden = !meetingCode;
  if (meetingCode) {
    const meetTitle = String(tab?.title || '').replace(/^Meet\s*[–-]\s*/i, '').trim().toLocaleLowerCase('fr-FR');
    const agendaEvent = findAgendaEventForOpenMeet(meetingCode, meetTitle);
    analyzeOpenMeetButton.onclick = () => analyzeMeeting(agendaEvent || {
      summary: 'Meet ouvert',
      hangoutLink: `https://meet.google.com/${meetingCode}`,
      start: { dateTime: new Date().toISOString() },
      attendees: [],
    });
  }
}

function normalizePersonName(name) {
  return MeetAttendance.normalizePersonName(name);
}

function findAgendaEventForOpenMeet(meetingCode, meetTitle) {
  const byCode = calendarEvents.find((event) => extractMeetingCode(getMeetingLink(event)) === meetingCode);
  if (byCode) return byCode;

  const byTitle = calendarEvents.find((event) => {
    const summary = normalizePersonName(event.summary);
    return summary && meetTitle && (meetTitle.includes(summary) || summary.includes(meetTitle));
  });
  if (byTitle) return byTitle;

  const now = Date.now();
  return calendarEvents
    .filter((event) => getMeetingLink(event) && event.start?.dateTime)
    .map((event) => ({ event, distance: Math.abs(Date.parse(event.start.dateTime) - now) }))
    .filter(({ distance }) => distance <= 24 * 60 * 60 * 1000)
    .sort((left, right) => left.distance - right.distance)[0]?.event || null;
}

function extractMeetingCode(hangoutLink) {
  try {
    const rawLink = String(hangoutLink || '').match(/https?:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0];
    if (!rawLink) return null;
    const url = new URL(rawLink);
    if (url.hostname !== 'meet.google.com') return null;
    const code = url.pathname.split('/').filter(Boolean)[0];
    return /^[a-z0-9-]+$/i.test(code || '') ? code : null;
  } catch {
    return null;
  }
}

function getMeetingLink(event) {
  const candidates = [
    event?.hangoutLink,
    ...(event?.conferenceData?.entryPoints || []).map((entryPoint) => entryPoint.uri),
    event?.location,
    event?.description,
  ];
  return candidates.find((value) => extractMeetingCode(value)) || null;
}

async function fetchMeetPage(url, token) {
  token = requireAccessToken(token);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 401) await chrome.identity.removeCachedAuthToken({ token });
    let reason = '';
    try {
      const details = await response.json();
      reason = details?.error?.status || details?.error?.reason || '';
    } catch {
      // Google peut répondre sans JSON, le statut HTTP reste exploitable.
    }
    throw new Error(`meet-request-failed-${response.status}${reason ? `-${reason.toLowerCase()}` : ''}`);
  }

  return response.json();
}

async function fetchAllMeetPages(url, collectionKey, token) {
  token = requireAccessToken(token);
  const baseUrl = new URL(url);
  baseUrl.searchParams.delete('pageToken');
  const items = [];
  const seenTokens = new Set();
  let pageToken = null;

  for (let pageIndex = 0; pageIndex < MAX_GOOGLE_PAGES; pageIndex += 1) {
    const pageUrl = new URL(baseUrl);
    if (pageToken !== null) pageUrl.searchParams.set('pageToken', pageToken);
    const page = await fetchMeetPage(pageUrl, token);
    if (!page || !Object.prototype.hasOwnProperty.call(page, collectionKey) || !Array.isArray(page[collectionKey])) {
      throw new Error('google-pagination-invalid-collection');
    }
    items.push(...page[collectionKey]);
    pageToken = readNextPageToken(page, seenTokens, pageIndex);
    if (pageToken === null) return items;
  }

  throw new Error('google-pagination-page-limit');
}

function formatAttendanceStatus(status) {
  return {
    'on-time': 'à l’heure',
    "à l'heure": 'à l’heure',
    'à l’heure': 'à l’heure',
    late: 'en retard',
    'en retard': 'en retard',
    absent: 'absent',
    waiting: 'en attente',
    'en attente': 'en attente',
    'identity-to-check': 'à vérifier',
    inconnu: 'à vérifier',
  }[status] || 'à vérifier';
}

async function analyzeMeeting(event) {
  const meetingCode = extractMeetingCode(getMeetingLink(event));
  if (!meetingCode || !currentAccessToken) {
    setAttendanceState('unavailable', 'Lien Meet ou connexion Google indisponible.');
    return;
  }

  setAttendanceState('loading', 'Recherche du compte rendu Meet…');
  stopLiveTracking();
  clearAttendanceRows();
  currentCollectionComplete = false;
  currentAgendaAttendeesOmitted = Boolean(event.attendeesOmitted);

  try {
    const filter = `space.meeting_code = "${meetingCode}"`;
    const recordsUrl = new URL(MEET_RECORDS_URL);
    recordsUrl.searchParams.set('filter', filter);
    recordsUrl.searchParams.set('pageSize', '10');
    const records = await fetchAllMeetPages(recordsUrl, 'conferenceRecords', currentAccessToken);
    const record = selectClosestMeetRecord(records, event.start?.dateTime || event.start?.date);

    if (!record?.name) {
      setAttendanceState('empty', 'Aucun compte rendu Meet disponible pour cette réunion.');
      return;
    }

    const recordPrefix = 'conferenceRecords/';
    const recordId = typeof record.name === 'string' && record.name.startsWith(recordPrefix)
      ? record.name.slice(recordPrefix.length)
      : '';
    if (!recordId || recordId.includes('/') || recordId === '.' || recordId === '..') {
      throw new Error('meet-record-invalid-name');
    }
    const encodedRecordId = encodeURIComponent(recordId);
    const participantsUrl = `${MEET_RECORDS_URL}/${encodedRecordId}/participants?pageSize=250`;
    const participants = await fetchAllMeetPages(participantsUrl, 'participants', currentAccessToken);
    const participantRows = await Promise.all(participants.map(async (participant) => {
      const participantPrefix = `${record.name}/participants/`;
      const participantResourceName = participant?.name;
      const participantName = typeof participantResourceName === 'string' && participantResourceName.startsWith(participantPrefix)
        ? participantResourceName.slice(participantPrefix.length)
        : '';
      if (!participantName || participantName.includes('/') || participantName === '.' || participantName === '..') {
        throw new Error('meet-participant-invalid-name');
      }
      const sessionsUrl = `${MEET_RECORDS_URL}/${encodedRecordId}/participants/${encodeURIComponent(participantName)}/participantSessions?pageSize=250`;
      const sessions = await fetchAllMeetPages(sessionsUrl, 'participantSessions', currentAccessToken);
      const result = MeetAttendance.calculateAttendance(participant, sessions, event.start?.dateTime || event.start?.date);
      const name = splitName(result.name);
      return {
        ...name,
        name: result.name,
        email: normalizeEmail(participant.signedinUser?.email || participant.user?.signedinUser?.email),
        status: formatAttendanceStatus(result.status),
        arrival: formatExportDate(result.firstJoin),
        departure: formatExportDate(result.lastLeave),
      };
    }));

    // Fusionner d'abord les lignes Meet brutes. Une même personne peut être
    // exposée plusieurs fois par conferenceRecords (alias e-mail, reconnexion
    // ou ressource participant différente) avant le rapprochement Agenda.
    const canonicalParticipantRows = MeetAttendance.mergeAttendanceRows(participantRows.filter(Boolean));
    const hasUnidentifiedMeetParticipant = canonicalParticipantRows.some((row) => !row.email);
    const byEmail = new Map(canonicalParticipantRows.filter((row) => row.email).map((row) => [normalizeEmail(row.email), row]));
    const canConfirmAbsence = Boolean(record.endTime
      && !Number.isNaN(Date.parse(record.endTime))
      && !event.attendeesOmitted
      && !hasUnidentifiedMeetParticipant);
    const invitedRows = (event.attendees || [])
      .filter((attendee) => {
        const email = normalizeEmail(attendee?.email);
        const displayName = typeof attendee?.displayName === 'string' ? attendee.displayName.trim() : '';
        return !email?.endsWith('@resource.calendar.google.com') && Boolean(email || displayName);
      })
      .map((attendee) => {
        const email = normalizeEmail(attendee?.email);
        const match = byEmail.get(email);
        const displayName = typeof attendee?.displayName === 'string' ? attendee.displayName.trim() : '';
        const attendeeEmail = typeof attendee?.email === 'string' ? attendee.email : '';
        const name = splitName(match?.name || displayName || email || attendeeEmail || 'Participant inconnu');
        if (match) {
          return { ...match, email: match.email || email };
        }
        const normalizedDisplayName = displayName ? MeetAttendance.normalizePersonName(displayName) : '';
        const hasAmbiguousEmailCandidate = Boolean(normalizedDisplayName && canonicalParticipantRows.some((row) =>
          normalizeEmail(row.email) !== email
          && MeetAttendance.normalizePersonName(row.name) === normalizedDisplayName));
        return {
          ...name,
          name: displayName || email || attendeeEmail || 'Participant inconnu',
          email: email || null,
          status: email && canConfirmAbsence && !hasAmbiguousEmailCandidate ? 'absent' : 'à vérifier',
          arrival: '',
          departure: '',
        };
      });
    const invitedEmails = new Set(invitedRows.map((row) => normalizeEmail(row.email)).filter(Boolean));
    const unmatchedMeetRows = canonicalParticipantRows
      .filter((row) => !row.email || !invitedEmails.has(normalizeEmail(row.email)))
      .map((row) => ({ ...row, status: 'à vérifier' }));
    // Les lignes Meet qui ne correspondent pas à un e-mail complet du roster
    // restent visibles à vérifier et ne sont jamais comptées présentes/absentes.
    const rows = MeetAttendance.mergeAttendanceRows([...invitedRows, ...unmatchedMeetRows]).map((row) => ({
      ...row,
      date: formatEventDate(event),
      meeting: event.summary || 'Réunion Google Meet',
    }));

    currentReportFilenameDate = formatReportFilenameDate(event.start?.dateTime || event.start?.date);
    currentCollectionComplete = Boolean(record.endTime && !Number.isNaN(Date.parse(record.endTime)));
    renderAttendanceRows(rows);
    if (shouldTrackLive(event)) {
      await startLiveTracking(record.name, event.start?.dateTime || event.start?.date, invitedRows.map((row) => ({ email: row.email, displayName: row.name })));
    }
    setAttendanceState(rows.length ? 'success' : 'empty', rows.length
      ? `${rows.length} participant${rows.length > 1 ? 's' : ''} trouvé${rows.length > 1 ? 's' : ''}.${currentAgendaAttendeesOmitted ? ' Le roster Agenda peut être incomplet; le rapport sera PARTIEL.' : ''}`
      : 'Aucun participant dans ce compte rendu.');
  } catch (error) {
    currentAttendanceRows = [];
    clearAttendanceRows();
    const message = error.name === 'AbortError'
      ? 'La recherche Meet a dépassé le délai prévu.'
      : error.message?.startsWith('meet-request-failed-401')
        ? 'La session Google a expiré. Déconnectez-vous puis reconnectez le compte.'
        : error.message?.startsWith('meet-request-failed-403')
          ? 'Google refuse l’accès aux présences. Vous devez être organisateur ou participant autorisé de cette réunion, et l’API Google Meet doit être activée.'
          : error.message?.startsWith('meet-request-failed-404')
            ? 'Le compte rendu Meet est indisponible ou la réunion n’est pas encore terminée.'
            : error.message?.startsWith('meet-request-failed-429')
              ? 'Google limite momentanément les requêtes. Réessayez dans quelques instants.'
              : 'Impossible de charger les présences Meet. Vérifiez la connexion du compte et les droits sur la réunion.';
    setAttendanceState('unavailable', message);
  }
}

function renderEvents(events, nowMs = Date.now()) {
  eventList.replaceChildren();

  events.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'event-item';

    const title = event.htmlLink ? document.createElement('a') : document.createElement('span');
    title.className = 'event-title';
    title.textContent = event.summary || 'Événement sans titre';

    if (event.htmlLink) {
      title.href = event.htmlLink;
      title.target = '_blank';
      title.rel = 'noopener noreferrer';
      title.setAttribute('aria-label', `Ouvrir ${event.summary || 'l’événement'} dans Google Agenda`);
    }

    const date = document.createElement('span');
    date.className = 'event-date';
    date.textContent = formatEventDate(event);

    const status = document.createElement('span');
    status.className = 'event-status';
    const eventStatus = HolbiesCalendar.getEventStatus(event, nowMs);
    status.dataset.status = eventStatus.toLowerCase();
    status.textContent = eventStatus;
    status.setAttribute('aria-label', `Statut : ${eventStatus}`);

    const actions = document.createElement('div');
    actions.className = 'event-actions';

    if (getMeetingLink(event)) {
      const analyzeButton = document.createElement('button');
      analyzeButton.className = 'secondary-button';
      analyzeButton.type = 'button';
      analyzeButton.textContent = 'Analyser';
      analyzeButton.setAttribute('aria-label', `Analyser les présences de ${event.summary || 'la réunion'}`);
      analyzeButton.addEventListener('click', () => {
        prepareAttendanceView(event);
        analyzeMeeting(event);
      });
      actions.append(analyzeButton);
    }

    item.append(title, date, status, actions);
    eventList.append(item);
  });
}

async function loadCalendarEvents(token) {
  token = requireAccessToken(token);
  setCalendarState('loading', 'Chargement de votre agenda…');
  calendarEvents = [];
  eventList.replaceChildren();

  const now = new Date();
  const dayFromMonday = (now.getDay() + 6) % 7;
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - dayFromMonday);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMin.getDate() + 7);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: '50',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const calendarItems = [];
  try {
    const calendarListResponse = await fetchWithRetry(CALENDAR_LIST_URL, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
    }, 3);

    if (!calendarListResponse.ok) {
      if (calendarListResponse.status === 401) {
        await chrome.identity.removeCachedAuthToken({ token });
      }
      throw new Error(`calendar-list-request-failed-${calendarListResponse.status}`);
    }

    const calendarList = await calendarListResponse.json();
    const calendars = Array.isArray(calendarList.items) && calendarList.items.length
      ? calendarList.items
      : [{ id: 'primary' }];
    const savedIds = await getSavedCalendarIds();
    const defaultIds = calendars.filter((calendar) => calendar.selected !== false).map((calendar) => calendar.id);
    const selectedIds = (savedIds || defaultIds).filter((id) => calendars.some((calendar) => calendar.id === id));
    renderCalendarPicker(calendars, selectedIds);

    for (const calendar of calendars) {
      if (!selectedIds.includes(calendar.id)) continue;
      const seenPageTokens = new Set();
      let pageToken = null;
      for (let pageIndex = 0; pageIndex < MAX_GOOGLE_PAGES; pageIndex += 1) {
        const pageParams = new URLSearchParams(params);
        if (pageToken !== null) pageParams.set('pageToken', pageToken);
        const calendarId = encodeURIComponent(calendar.id || 'primary');
        const response = await fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${pageParams}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }, 3);

        if (!response.ok) {
          if (response.status === 401) {
            await chrome.identity.removeCachedAuthToken({ token });
          }
          throw new Error(`calendar-request-failed-${response.status}`);
        }

        const data = await response.json();
        if (!data || !Object.prototype.hasOwnProperty.call(data, 'items') || !Array.isArray(data.items)) {
          throw new Error('calendar-pagination-invalid-collection');
        }
        calendarItems.push(...data.items);
        pageToken = readNextPageToken(data, seenPageTokens, pageIndex);
        if (pageToken === null) break;
      }
      if (pageToken !== null) throw new Error('google-pagination-page-limit');
    }
  } finally {
    clearTimeout(timeout);
  }

  const events = HolbiesCalendar.filterVisibleAgendaEvents(calendarItems, now.getTime());
  calendarEvents = events;
  renderEvents(events, now.getTime());

  if (events.length === 0) {
    setCalendarState('empty', 'Aucun événement prévu aujourd’hui.');
    return;
  }

  setCalendarState('success', `${events.length} événement${events.length > 1 ? 's' : ''} trouvé${events.length > 1 ? 's' : ''}.`);
}

function setAuthState(state, message) {
  authStatus.dataset.state = state;
  authStatus.textContent = message;
}

async function fetchConnectedAccount(token) {
  token = requireAccessToken(token);
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`account-request-failed-${response.status}`);
  const profile = await response.json();
  return {
    email: typeof profile.email === 'string' ? profile.email : '',
    name: typeof profile.email === 'string' ? profile.email : 'Compte Google connecté',
  };
}

function renderConnectedAccount(account) {
  const label = account.name || account.email || 'Compte Google connecté';
  accountName.textContent = label;
  accountEmail.textContent = account.email && account.email !== label ? account.email : '';
  accountAvatar.textContent = (label.trim()[0] || 'G').toUpperCase();
  connectedAccount.hidden = false;
  signInButton.hidden = true;
  detectOpenMeet().catch(() => {});
}

function setLoading(isLoading) {
  signInButton.disabled = isLoading;
  signInButton.setAttribute('aria-busy', String(isLoading));
  signInButton.querySelector('span').textContent = isLoading
    ? 'Connexion en cours…'
    : 'Se connecter avec Google';
}

function resetSession() {
  stopLiveTracking();
  currentAccessToken = null;
  clearAttendanceRows();
  eventList.replaceChildren();
  exportConsent.checked = false;
  localExportButton.hidden = true;
  signOutButton.hidden = true;
  signInButton.hidden = false;
  connectedAccount.hidden = true;
  analyzeOpenMeetButton.hidden = true;
  accountName.textContent = 'Compte Google connecté';
  accountEmail.textContent = '';
  accountAvatar.textContent = 'G';
  setAuthState('ready', 'Compte déconnecté.');
  setCalendarState('ready', 'Connectez-vous pour charger vos événements.');
  setAttendanceState('ready', 'Choisissez une réunion Google Meet pour afficher les participants.');
}

async function disconnectGoogleAccount() {
  signOutButton.disabled = true;
  try {
    if (currentAccessToken) await chrome.identity.removeCachedAuthToken({ token: currentAccessToken });
    if (chrome.identity.clearAllCachedAuthTokens) await chrome.identity.clearAllCachedAuthTokens();
  } finally {
    resetSession();
    signOutButton.disabled = false;
  }
}

function finishGoogleConnection({ token, grantedScopes = [] }, message = 'Compte Google connecté.') {
  token = requireAccessToken(token);
  const requiredScopes = chrome.runtime.getManifest().oauth2.scopes;
  // Selon la version de Chrome, getAuthToken peut renvoyer un token sans la
  // liste grantedScopes. L'API ayant déjà validé le token, cette absence ne
  // doit pas masquer le compte connecté ni fermer la popup silencieusement.
  const hasRequiredScopes = grantedScopes.length === 0 || requiredScopes.every((scope) => grantedScopes.includes(scope));

  if (!hasRequiredScopes) throw new Error('required-scopes-not-granted');

  setLoading(false);
  setAuthState('success', message);
  signOutButton.hidden = false;
  currentAccessToken = token;
  return fetchConnectedAccount(token)
    .then(renderConnectedAccount)
    .catch(() => {
      renderConnectedAccount({ email: '', name: 'Compte Google connecté' });
    })
    .then(() => refreshCalendar(token))
    .catch((error) => {
      const message = error?.message?.includes('calendar-list-request-failed-403')
        ? 'Reconnectez-vous pour autoriser la lecture de vos agendas.'
        : 'Impossible de charger votre agenda. Réessayez après la connexion.';
      setCalendarState('error', message);
    });
}

function normalizeAuthSession(session) {
  if (typeof session === 'string') return { token: session, grantedScopes: [] };
  return session || {};
}

function classifyAuthFailure(error) {
  // Only classify stable, locally generated sentinels or the standard
  // cancellation name. Never display or log provider supplied error text.
  if (error?.name === 'AbortError') return AUTH_FAILURES.cancelled;
  if (error?.message === 'required-scopes-not-granted') return AUTH_FAILURES.permissionIncomplete;
  if (error?.message === 'google-auth-timeout') return AUTH_FAILURES.timeout;
  if (error?.message === 'google-auth-required') return AUTH_FAILURES.tokenInvalid;
  return AUTH_FAILURES.unknown;
}

function connectGoogleAccount() {
  setLoading(true);
  setAuthState('loading', 'Ouverture de la connexion Google…');

  withTimeout(chrome.identity.getAuthToken({ interactive: true }), AUTH_TIMEOUT_MS, 'google-auth-timeout')
    .then((session) => finishGoogleConnection(normalizeAuthSession(session)))
    .catch((error) => {
      setLoading(false);
      const diagnostic = classifyAuthFailure(error);
      setAuthState('error', diagnostic.message);
    });
}

function restoreGoogleSession() {
  withTimeout(chrome.identity.getAuthToken({ interactive: false }), AUTH_TIMEOUT_MS, 'google-auth-timeout')
    .then((session) => finishGoogleConnection(normalizeAuthSession(session), ''))
    .catch(() => {
      // Aucun token en cache : l'utilisateur verra l'action de connexion.
    });
}

async function showBackgroundTrackingStatus() {
  if (!chrome.storage?.local) return;
  const { holbiesTrackingStatus: status } = await chrome.storage.local.get('holbiesTrackingStatus');
  if (!status) return;
  const when = status.finishedAt ? new Date(status.finishedAt).toLocaleTimeString('fr-FR') : 'jamais';
  if (status.state === 'ok') liveStatus.textContent = `Suivi arrière-plan actif : ${status.trackedEvents} réunion(s), dernier cycle ${when}.`;
  else if (status.state === 'degraded') liveStatus.textContent = `Suivi arrière-plan partiel : ${status.errors.length} erreur(s), dernier cycle ${when}.`;
  else liveStatus.textContent = `Suivi arrière-plan indisponible depuis ${when}. Ouvrez la popup pour réautoriser Google.`;
}

signInButton.addEventListener('click', connectGoogleAccount);
signOutButton.addEventListener('click', disconnectGoogleAccount);
calendarSettingsButton.addEventListener('click', () => {
  setCalendarPickerOpen(calendarMenu.hidden);
});
calendarRefreshButton.addEventListener('click', () => {
  if (!currentAccessToken) return;
  refreshCalendar(currentAccessToken).catch(() => {});
});
document.addEventListener('click', (event) => {
  if (!calendarMenu.hidden && !calendarMenu.contains(event.target) && !calendarSettingsButton.contains(event.target)) {
    closeCalendarPicker();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !calendarMenu.hidden) closeCalendarPicker();
  else trapCalendarPickerFocus(event);
});
exportConsent.addEventListener('change', () => {
  exportButton.disabled = currentAttendanceRows.length === 0 || !exportConsent.checked || !currentCollectionComplete;
});
localExportButton.addEventListener('click', downloadLocalCsv);
htmlExportButton.addEventListener('click', exportAttendanceToHtml);
exportButton.addEventListener('click', exportAttendanceToSheets);
restoreGoogleSession();
showBackgroundTrackingStatus().catch(() => {});
