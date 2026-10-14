const signInButton = document.querySelector('#sign-in-button');
const signOutButton = document.querySelector('#sign-out-button');
const authStatus = document.querySelector('#auth-status');
const connectedAccount = document.querySelector('#connected-account');
const accountAvatar = document.querySelector('#account-avatar');
const accountName = document.querySelector('#account-name');
const accountEmail = document.querySelector('#account-email');
const calendarStatus = document.querySelector('#calendar-status');
const eventList = document.querySelector('#event-list');
const attendanceStatus = document.querySelector('#attendance-status');
const analyzeOpenMeetButton = document.querySelector('#analyze-open-meet-button');
const participantList = document.querySelector('#participant-list');
const exportButton = document.querySelector('#export-button');
const exportConsent = document.querySelector('#export-consent');
const localExportButton = document.querySelector('#local-export-button');
const attendanceSummary = document.querySelector('#attendance-summary');
const summaryOnTime = document.querySelector('#summary-on-time');
const summaryLate = document.querySelector('#summary-late');
const summaryAbsent = document.querySelector('#summary-absent');
const liveIndicator = document.querySelector('#live-indicator');
const liveStatus = document.querySelector('#live-status');
const liveReportLink = document.querySelector('#live-report-link');

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MEET_RECORDS_URL = 'https://meet.googleapis.com/v2/conferenceRecords';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const SHEETS_SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/spreadsheets'];
// URL du tunnel HTTPS gratuit actuellement actif sur le VPS.
const LIVE_BACKEND_URL = 'https://walter-bringing-greatest-warming.trycloudflare.com';
let currentAccessToken = null;
let currentAttendanceRows = [];
let calendarEvents = [];
let liveSessionId = null;
let livePollTimer = null;
const AUTH_TIMEOUT_MS = 15000;

liveReportLink.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!currentAccessToken || !liveReportLink.href) return;

  const reportWindow = window.open('about:blank', '_blank');
  if (!reportWindow) {
    liveStatus.textContent = 'Autorisez les fenêtres pop-up pour ouvrir le rapport.';
    return;
  }

  try {
    const response = await fetchWithRetry(liveReportLink.href, {
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });
    const reportUrl = URL.createObjectURL(await response.blob());
    reportWindow.location.href = reportUrl;
    setTimeout(() => URL.revokeObjectURL(reportUrl), 60000);
  } catch {
    reportWindow.close();
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
      const rows = (liveSession.expectedParticipants || []).map((expected) => {
        const actual = (liveSession.participants || []).find((participant) => participant.email === expected.email || participant.name === expected.displayName);
        return { name: expected.displayName || expected.name, status: formatAttendanceStatus(actual?.status || 'absent'), lateMinutes: actual?.lateMinutes || 0 };
      });
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
  return [['Prénom', 'Nom', 'Date', 'Réunion', 'Arrivée', 'Départ', 'Statut'], ...currentAttendanceRows.map((row) => [row.firstName, row.lastName, row.date, row.meeting, row.arrival, row.departure, row.status])];
}

function downloadLocalCsv() {
  const csv = exportValues().map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const url = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
  chrome.downloads.download({ url, filename: `holbies-meet-presences-${new Date().toISOString().slice(0, 10)}.csv`, saveAs: true });
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
  participantList.replaceChildren();
  currentAttendanceRows = rows;
  const counts = rows.reduce((summary, row) => {
    if (row.status === 'à l’heure') summary.onTime += 1;
    else if (row.status === 'en retard') summary.late += 1;
    else if (row.status === 'absent') summary.absent += 1;
    return summary;
  }, { onTime: 0, late: 0, absent: 0 });
  summaryOnTime.textContent = String(counts.onTime);
  summaryLate.textContent = String(counts.late);
  summaryAbsent.textContent = String(counts.absent);
  attendanceSummary.hidden = rows.length === 0;
  exportButton.disabled = rows.length === 0 || !exportConsent.checked;

  rows.forEach((row) => {
    const item = document.createElement('li');
    item.className = 'participant-item';

    const identity = document.createElement('span');
    identity.className = 'participant-identity';
    identity.textContent = row.name;

    const status = document.createElement('span');
    status.className = 'participant-status';
    status.dataset.status = row.status;
    status.textContent = row.status;

    item.append(identity, status);
    participantList.append(item);
  });
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
  participantList.replaceChildren();
  currentAttendanceRows = [];
  attendanceSummary.hidden = true;
  exportButton.disabled = true;
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
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ');
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
    throw new Error(`meet-request-failed-${response.status}`);
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
  participantList.replaceChildren();
  currentAttendanceRows = [];
  exportButton.disabled = true;

  try {
    const filter = `space.meeting_code = "${meetingCode}"`;
    const recordsUrl = new URL(MEET_RECORDS_URL);
    recordsUrl.searchParams.set('filter', filter);
    recordsUrl.searchParams.set('pageSize', '10');
    const records = await fetchAllMeetPages(recordsUrl, 'conferenceRecords', currentAccessToken);
    const record = [...records].sort((left, right) => Date.parse(right.startTime || '') - Date.parse(left.startTime || ''))[0];

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
        const match = byEmail.get(email) || byName.get(normalizePersonName(attendeeName));
        const name = splitName(attendee.displayName || attendee.email);
        return match || {
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
    const rows = [...invitedRows, ...unidentifiedRows].map((row) => ({
      ...row,
      date: formatEventDate(event),
      meeting: event.summary || 'Réunion Google Meet',
    }));

    renderAttendanceRows(rows);
    await startLiveTracking(record.name, event.start?.dateTime || event.start?.date, invitedRows.map((row) => ({ email: row.email, displayName: row.name })));
    setAttendanceState(rows.length ? 'success' : 'empty', rows.length
      ? `${rows.length} participant${rows.length > 1 ? 's' : ''} trouvé${rows.length > 1 ? 's' : ''}.`
      : 'Aucun participant dans ce compte rendu.');
  } catch (error) {
    currentAttendanceRows = [];
    exportButton.disabled = true;
    const message = error.name === 'AbortError'
      ? 'La recherche Meet a dépassé le délai prévu.'
      : 'Impossible de charger les présences Meet. Vérifiez vos droits sur la réunion.';
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
  const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: '50',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetchWithRetry(`${CALENDAR_EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }, 3);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) {
      await chrome.identity.removeCachedAuthToken({ token });
    }
    throw new Error(`calendar-request-failed-${response.status}`);
  }

  const data = await response.json();
  const events = Array.isArray(data.items) ? data.items : [];
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
    .then(() => loadCalendarEvents(token))
    .catch(() => {
      setCalendarState('error', 'Impossible de charger votre agenda. Réessayez après la connexion.');
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
    .then((session) => finishGoogleConnection(normalizeAuthSession(session), 'Compte Google déjà connecté.'))
    .catch(() => {
      // Aucun token en cache : l'utilisateur verra l'action de connexion.
    });
}

signInButton.addEventListener('click', connectGoogleAccount);
signOutButton.addEventListener('click', disconnectGoogleAccount);
exportConsent.addEventListener('change', () => {
  exportButton.disabled = currentAttendanceRows.length === 0 || !exportConsent.checked;
});
localExportButton.addEventListener('click', downloadLocalCsv);
exportButton.addEventListener('click', exportAttendanceToSheets);
restoreGoogleSession();
