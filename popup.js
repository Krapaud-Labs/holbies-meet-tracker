const signInButton = document.querySelector('#sign-in-button');
const signOutButton = document.querySelector('#sign-out-button');
const authStatus = document.querySelector('#auth-status');
const calendarStatus = document.querySelector('#calendar-status');
const eventList = document.querySelector('#event-list');
const attendanceStatus = document.querySelector('#attendance-status');
const participantList = document.querySelector('#participant-list');
const exportButton = document.querySelector('#export-button');
const exportConsent = document.querySelector('#export-consent');
const localExportButton = document.querySelector('#local-export-button');

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MEET_RECORDS_URL = 'https://meet.googleapis.com/v2/conferenceRecords';
let currentAccessToken = null;
let currentAttendanceRows = [];

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
      body: JSON.stringify({ range: `${sheetTitle}!A1`, majorDimension: 'ROWS', values }),
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
  exportButton.disabled = true;
  if (!getMeetingLink(event)) {
    setAttendanceState('unavailable', 'Aucun lien Google Meet pour cet événement.');
    return;
  }

  setAttendanceState('ready', 'Réunion prête à être analysée.');
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
    const record = records[0];

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
        email: normalizeEmail(participant.user?.signedinUser?.email),
        status: formatAttendanceStatus(result.status),
        arrival: formatExportDate(result.firstJoin),
        departure: formatExportDate(result.lastLeave),
      };
    }));

    const byEmail = new Map(participantRows.filter(Boolean).filter((row) => row.email).map((row) => [row.email, row]));
    const invitedRows = (event.attendees || [])
      .filter((attendee) => normalizeEmail(attendee.email))
      .map((attendee) => {
        const email = normalizeEmail(attendee.email);
        const match = byEmail.get(email);
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

function setLoading(isLoading) {
  signInButton.disabled = isLoading;
  signInButton.setAttribute('aria-busy', String(isLoading));
  signInButton.querySelector('span').textContent = isLoading
    ? 'Connexion en cours…'
    : 'Se connecter avec Google';
}

function resetSession() {
  currentAccessToken = null;
  currentAttendanceRows = [];
  participantList.replaceChildren();
  eventList.replaceChildren();
  exportConsent.checked = false;
  exportButton.disabled = true;
  localExportButton.hidden = true;
  signOutButton.hidden = true;
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

function connectGoogleAccount() {
  setLoading(true);
  setAuthState('loading', 'Ouverture de la connexion Google…');

  chrome.identity.getAuthToken({ interactive: true })
    .then(({ token, grantedScopes = [] }) => {
      const requiredScopes = chrome.runtime.getManifest().oauth2.scopes;
      const hasRequiredScopes = requiredScopes.every((scope) => grantedScopes.includes(scope));

      if (!token || !hasRequiredScopes) {
        throw new Error('required-scopes-not-granted');
      }

      setLoading(false);
      setAuthState('success', 'Compte Google connecté.');
      signOutButton.hidden = false;
      currentAccessToken = token;
      return loadCalendarEvents(token).catch(() => {
        setCalendarState('error', 'Impossible de charger votre agenda. Réessayez après la connexion.');
      });
    })
    .catch(() => {
      setLoading(false);
      setAuthState('error', 'Connexion impossible ou autorisations incomplètes. Réessayez depuis la popup.');
    });
}

signInButton.addEventListener('click', connectGoogleAccount);
signOutButton.addEventListener('click', disconnectGoogleAccount);
exportConsent.addEventListener('change', () => {
  exportButton.disabled = currentAttendanceRows.length === 0 || !exportConsent.checked;
});
localExportButton.addEventListener('click', downloadLocalCsv);
exportButton.addEventListener('click', exportAttendanceToSheets);
