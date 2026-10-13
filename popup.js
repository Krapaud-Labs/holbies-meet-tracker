const signInButton = document.querySelector('#sign-in-button');
const authStatus = document.querySelector('#auth-status');
const calendarStatus = document.querySelector('#calendar-status');
const eventList = document.querySelector('#event-list');

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

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

    item.append(title, date);
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
    maxResults: '10',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetch(`${CALENDAR_EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
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
