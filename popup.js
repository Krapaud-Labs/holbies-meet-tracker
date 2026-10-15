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
const LIVE_BACKEND_URL = 'https://walter-bringing-greatest-warming.trycloudflare.com';
let currentAccessToken = null;
let calendarLoadSerial = 0;
let currentAttendanceRows = [];
let calendarEvents = [];
let calendarCatalog = [];
let liveSessionId = null;
let livePollTimer = null;
const AUTH_TIMEOUT_MS = 15000;
const LIVE_START_WINDOW_MS = 15 * 60 * 1000;
const LIVE_END_GRACE_MS = 10 * 60 * 1000;

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
  livePollTimer = null;
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
  try {
    const created = await fetchWithRetry(`${LIVE_BACKEND_URL}/api/v1/live/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, scheduledStart, expectedParticipants }),
    });
    const session = await created.json();
    liveSessionId = session.id;
    liveIndicator.hidden = false;
    liveStatus.textContent = 'Présences actualisées toutes les 5 secondes.';
    liveReportLink.href = `${LIVE_BACKEND_URL}/reports/${encodeURIComponent(liveSessionId)}`;
    liveReportLink.hidden = false;
    const refresh = async () => {
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
      if (rows.length) renderAttendanceRows(rows);
    };
    await refresh();
    livePollTimer = setInterval(() => refresh().catch(() => {}), 5000);
  } catch (error) {
    liveStatus.textContent = `${describeLiveBackendError(error)} Le relevé Meet reste disponible localement.`;
  }
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
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

function nameFromHolbertonEmail(email) {
  const localPart = String(email || '').split('@')[0];
  if (!localPart || /^\d{4,5}$/.test(localPart)) return '';
  return localPart.replace(/[._-]+/g, ' ');
}

function exportValues() {
  return [['Prénom', 'Nom', 'Date', 'Réunion', 'Arrivée', 'Départ', 'Statut'], ...currentAttendanceRows.map((row) => [row.firstName, row.lastName, row.date, row.meeting, row.arrival, row.departure, row.status])];
}

function downloadLocalCsv() {
  const csv = exportValues().map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
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

function createLocalReportHtml(rows) {
  const counts = rows.reduce((summary, row) => {
    const status = String(row.status || '').replace('’', "'");
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
  const title = rows[0]?.meeting || 'Rapport de réunion Google Meet';
  const tableRows = rows.map((row) => `<tr><td data-column="participant">${escapeReportHtml(row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim())}</td><td data-column="email">${escapeReportHtml(row.email || '')}</td><td data-column="status" class="${row.status === 'en retard' ? 'late' : row.status === 'absent' ? 'absent' : ''}">${escapeReportHtml(row.status)}</td><td data-column="arrival">${escapeReportHtml(formatReportTime(row.arrival))}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeReportHtml(title)}</title><style>:root{color-scheme:light dark;--bg:#fff7f8;--panel:#fff;--ink:#24101b;--muted:#704c59;--line:#efd8df;--accent:#d7194f}@media(prefers-color-scheme:dark){:root{--bg:#160b12;--panel:#24101b;--ink:#fff5f7;--muted:#d5b8c2;--line:#683345;--accent:#ff2d55}}*{box-sizing:border-box}body{margin:0;min-width:0;padding:clamp(18px,4vw,48px);overflow-x:hidden;background:var(--bg);color:var(--ink);font:16px Arial,sans-serif}main{width:min(100%,1100px);margin:auto}h1{margin:0 0 8px}p{color:var(--muted)}.summary{display:flex;gap:12px;flex-wrap:wrap}.summary span{padding:12px 16px;border:1px solid var(--line);border-top:3px solid var(--accent);background:var(--panel);border-radius:10px}.filters{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.filters legend{font-weight:700}.filters label{display:inline-flex;gap:6px;align-items:center;color:var(--muted)}.column-hidden{display:none!important}section{margin-top:24px;padding:clamp(14px,3vw,20px);background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow-x:auto}table{width:100%;min-width:620px;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);overflow-wrap:anywhere;vertical-align:top}th:nth-child(1){width:28%}th:nth-child(2){width:36%}th:nth-child(3){width:18%}th:nth-child(4){width:18%}th{color:var(--muted);font-size:12px;text-transform:uppercase}.late{color:var(--accent);font-weight:700}.absent{color:var(--muted);font-weight:700}@media(max-width:700px){body{padding:16px}.summary{gap:8px}.summary span{flex:1 1 140px}section{margin-top:18px}}</style></head><body><main><h1>${escapeReportHtml(title)}</h1><p>Rapport local Holbies Meet · ${escapeReportHtml(rows[0]?.date || new Date().toLocaleString('fr-FR'))}</p><div class="summary"><span>À l'heure : ${counts["à l'heure"] || 0}</span><span>En retard : ${counts["en retard"] || 0}</span><span>En attente : ${counts["en attente"] || 0}</span><span>Absents : ${counts.absent || 0}</span></div><section><fieldset class="filters"><legend>Colonnes visibles</legend><label><input type="checkbox" data-column-toggle="participant" checked> Participant</label><label><input type="checkbox" data-column-toggle="email" checked> E-mail</label><label><input type="checkbox" data-column-toggle="status" checked> Statut</label><label><input type="checkbox" data-column-toggle="arrival" checked> Arrivée</label></fieldset></section><section><table><thead><tr><th data-column="participant">Participant</th><th data-column="email">E-mail</th><th data-column="status">Statut</th><th data-column="arrival">Arrivée</th></tr></thead><tbody>${tableRows}</tbody></table></section></main><script>document.querySelectorAll('[data-column-toggle]').forEach((control)=>control.addEventListener('change',()=>{document.querySelectorAll('[data-column="'+control.dataset.columnToggle+'"]').forEach((cell)=>cell.classList.toggle('column-hidden',!control.checked));}));</script></body></html>`;
}

async function exportAttendanceToHtml() {
  if (!currentAttendanceRows.length) return;
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

function setAttendanceState(state, message) {
  attendanceStatus.dataset.state = state;
  attendanceStatus.textContent = message;
  attendanceStatus.setAttribute('aria-busy', String(state === 'loading'));
}

function renderAttendanceRows(rows) {
  currentAttendanceRows = rows;
  const counts = rows.reduce((summary, row) => {
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
  attendanceSummary.hidden = rows.length === 0;
  exportButton.disabled = rows.length === 0 || !exportConsent.checked;
  htmlExportButton.hidden = rows.length === 0;

}

async function exportAttendanceToSheets() {
  if (!currentAccessToken || currentAttendanceRows.length === 0 || !exportConsent.checked) return;

  exportButton.disabled = true;
  exportButton.setAttribute('aria-busy', 'true');
  exportButton.textContent = 'Export en cours…';
  try {
    const sheetsSession = await withTimeout(chrome.identity.getAuthToken({ interactive: true, scopes: [...chrome.runtime.getManifest().oauth2.scopes, ...SHEETS_SCOPES] }), AUTH_TIMEOUT_MS, 'google-auth-timeout');
    currentAccessToken = normalizeAuthSession(sheetsSession).token;
    const createResponse = await fetchWithRetry('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title: `Présences Meet - ${new Date().toLocaleDateString('fr-FR')}` } }),
    });
    if (!createResponse.ok) throw new Error(`sheets-create-failed-${createResponse.status}`);
    const spreadsheet = await createResponse.json();
    if (!spreadsheet.spreadsheetId) throw new Error('sheets-missing-id');
    const values = exportValues();
    const sheetTitle = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
    const range = encodeURIComponent(`${sheetTitle}!A1:G${values.length}`);
    const updateResponse = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${currentAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: `${sheetTitle}!A1:G${values.length}`, majorDimension: 'ROWS', values }),
    });
    if (!updateResponse.ok) throw new Error(`sheets-update-failed-${updateResponse.status}`);
    setAttendanceState('success', 'Présences exportées dans une nouvelle feuille Google Sheets.');
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
    exportButton.disabled = currentAttendanceRows.length === 0 || !exportConsent.checked;
  }
}

function prepareAttendanceView(event) {
  currentAttendanceRows = [];
  attendanceSummary.hidden = true;
  exportButton.disabled = true;
  htmlExportButton.hidden = true;
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
  const items = [];
  let pageToken = null;

  do {
    const pageUrl = new URL(url);
    if (pageToken) pageUrl.searchParams.set('pageToken', pageToken);
    const page = await fetchMeetPage(pageUrl, token);
    items.push(...(Array.isArray(page[collectionKey]) ? page[collectionKey] : []));
    pageToken = page.nextPageToken || null;
  } while (pageToken);

  return items;
}

function formatAttendanceStatus(status) {
  return {
    'on-time': 'à l’heure',
    late: 'en retard',
    absent: 'absent',
    waiting: 'en attente',
    'identity-to-check': 'inconnu',
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
  participantList.replaceChildren();
  currentAttendanceRows = [];
  exportButton.disabled = true;

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

    const participantsUrl = `${MEET_RECORDS_URL}/${record.name.split('/').pop()}/participants?pageSize=250`;
    const participants = await fetchAllMeetPages(participantsUrl, 'participants', currentAccessToken);
    const participantRows = await Promise.all(participants.map(async (participant) => {
      const participantName = participant.name?.split('/').pop();
      if (!participantName) return null;
      const sessionsUrl = `${MEET_RECORDS_URL}/${record.name.split('/').pop()}/participants/${participantName}/participantSessions?pageSize=250`;
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

    const byEmail = new Map(participantRows.filter(Boolean).filter((row) => row.email).map((row) => [row.email, row]));
    const byName = new Map(participantRows.filter(Boolean).map((row) => [normalizePersonName(row.name), row]));
    const invitedRows = (event.attendees || [])
      .filter((attendee) => normalizeEmail(attendee.email))
      .map((attendee) => {
        const email = normalizeEmail(attendee.email);
        const attendeeName = attendee.displayName || attendee.email;
        const emailName = nameFromHolbertonEmail(email);
        const match = byEmail.get(email)
          || byName.get(normalizePersonName(attendeeName))
          || byName.get(normalizePersonName(emailName));
        const name = splitName(match?.name || attendee.displayName || attendee.email);
        if (match) {
          return { ...match, email: match.email || email };
        }
        return {
          ...name,
          name: attendee.displayName || attendee.email,
          email,
          status: 'absent',
          arrival: '',
          departure: '',
        };
      });
    const invitedEmails = new Set(invitedRows.map((row) => row.email));
    const unidentifiedRows = participantRows.filter((row) => row && (!row.email || !invitedEmails.has(row.email)));
    const rows = MeetAttendance.mergeAttendanceRows([...invitedRows, ...unidentifiedRows]).map((row) => ({
      ...row,
      date: formatEventDate(event),
      meeting: event.summary || 'Réunion Google Meet',
    }));

    renderAttendanceRows(rows);
    if (shouldTrackLive(event)) {
      await startLiveTracking(record.name, event.start?.dateTime || event.start?.date, invitedRows.map((row) => ({ email: row.email, displayName: row.name })));
    }
    setAttendanceState(rows.length ? 'success' : 'empty', rows.length
      ? `${rows.length} participant${rows.length > 1 ? 's' : ''} trouvé${rows.length > 1 ? 's' : ''}.`
      : 'Aucun participant dans ce compte rendu.');
  } catch (error) {
    currentAttendanceRows = [];
    exportButton.disabled = true;
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

function renderEvents(events) {
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

    item.append(title, date, actions);
    eventList.append(item);
  });
}

async function loadCalendarEvents(token) {
  setCalendarState('loading', 'Chargement de votre agenda…');
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
      let pageToken = null;
      do {
        const pageParams = new URLSearchParams(params);
        if (pageToken) pageParams.set('pageToken', pageToken);
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
        calendarItems.push(...(Array.isArray(data.items) ? data.items : []));
        pageToken = data.nextPageToken || null;
      } while (pageToken);
    }
  } finally {
    clearTimeout(timeout);
  }

  const events = HolbiesCalendar.filterVisibleAgendaEvents(calendarItems, now.getTime());
  calendarEvents = events;
  renderEvents(events);

  if (events.length === 0) {
    setCalendarState('empty', 'Aucun événement récent ou prochain.');
    return;
  }

  setCalendarState('success', `${events.length} événement${events.length > 1 ? 's' : ''} trouvé${events.length > 1 ? 's' : ''}.`);
}

function setAuthState(state, message) {
  authStatus.dataset.state = state;
  authStatus.textContent = message;
}

async function fetchConnectedAccount(token) {
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
  currentAttendanceRows = [];
  participantList.replaceChildren();
  eventList.replaceChildren();
  exportConsent.checked = false;
  exportButton.disabled = true;
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
  const requiredScopes = chrome.runtime.getManifest().oauth2.scopes;
  // Selon la version de Chrome, getAuthToken peut renvoyer un token sans la
  // liste grantedScopes. L'API ayant déjà validé le token, cette absence ne
  // doit pas masquer le compte connecté ni fermer la popup silencieusement.
  const hasRequiredScopes = grantedScopes.length === 0 || requiredScopes.every((scope) => grantedScopes.includes(scope));

  if (!token || !hasRequiredScopes) throw new Error('required-scopes-not-granted');

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

function connectGoogleAccount() {
  setLoading(true);
  setAuthState('loading', 'Ouverture de la connexion Google…');

  withTimeout(chrome.identity.getAuthToken({ interactive: true }), AUTH_TIMEOUT_MS, 'google-auth-timeout')
    .then((session) => finishGoogleConnection(normalizeAuthSession(session)))
    .catch((error) => {
      setLoading(false);
      const message = error?.message === 'google-auth-timeout'
        ? 'Google ne répond pas. Rechargez l’extension puis réessayez.'
        : 'Connexion impossible ou autorisations incomplètes. Réessayez depuis la popup.';
      setAuthState('error', message);
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
    setCalendarPickerOpen(false);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !calendarMenu.hidden) {
    setCalendarPickerOpen(false);
    calendarSettingsButton.focus();
  }
});
exportConsent.addEventListener('change', () => {
  exportButton.disabled = currentAttendanceRows.length === 0 || !exportConsent.checked;
});
localExportButton.addEventListener('click', downloadLocalCsv);
htmlExportButton.addEventListener('click', exportAttendanceToHtml);
exportButton.addEventListener('click', exportAttendanceToSheets);
restoreGoogleSession();
showBackgroundTrackingStatus().catch(() => {});
