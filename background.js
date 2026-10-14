const BACKEND_URL = 'https://walter-bringing-greatest-warming.trycloudflare.com';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MEET_RECORDS_URL = 'https://meet.googleapis.com/v2/conferenceRecords';
const TRACKING_ALARM = 'holbies-meet-tracking';
const WINDOW_BEFORE_MS = 15 * 60 * 1000;
const WINDOW_AFTER_MS = 6 * 60 * 60 * 1000;

function extractMeetingCode(value) {
  const match = String(value || '').match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

function getMeetingCode(event) {
  const entryPoint = event.conferenceData?.entryPoints?.find((item) => item.entryPointType === 'video')?.uri;
  return extractMeetingCode(event.hangoutLink || entryPoint || event.location || event.description);
}

function eventStart(event) {
  return event.start?.dateTime || event.start?.date || null;
}

function eventEnd(event) {
  return event.end?.dateTime || event.end?.date || null;
}

function isTrackableEvent(event, now = Date.now()) {
  const start = Date.parse(eventStart(event) || '');
  const end = Date.parse(eventEnd(event) || '');
  return Boolean(getMeetingCode(event) && !Number.isNaN(start) && !Number.isNaN(end)
    && now >= start - WINDOW_BEFORE_MS && now <= end + WINDOW_AFTER_MS);
}

function expectedParticipants(event) {
  return (event.attendees || [])
    .filter((attendee) => typeof attendee.email === 'string' && attendee.email.includes('@'))
    .map((attendee) => ({ email: attendee.email.toLowerCase(), displayName: attendee.displayName || attendee.email }));
}

async function googleJson(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`google-request-failed-${response.status}`);
  return response.json();
}

async function fetchCalendarEvents(token, now = new Date()) {
  const timeMin = new Date(now.getTime() - WINDOW_BEFORE_MS).toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_AFTER_MS).toISOString();
  const url = new URL(CALENDAR_URL);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '50');
  const page = await googleJson(url, token);
  return Array.isArray(page.items) ? page.items : [];
}

async function fetchMeetSnapshot(meetingCode, scheduledStart, token) {
  const recordsUrl = new URL(MEET_RECORDS_URL);
  recordsUrl.searchParams.set('filter', `space.meeting_code = "${meetingCode}"`);
  recordsUrl.searchParams.set('pageSize', '10');
  const records = (await googleJson(recordsUrl, token)).conferenceRecords || [];
  const record = [...records].sort((left, right) => Date.parse(right.startTime || '') - Date.parse(left.startTime || ''))[0];
  if (!record?.name) return [];

  const recordId = record.name.split('/').pop();
  const participants = (await googleJson(`${MEET_RECORDS_URL}/${recordId}/participants?pageSize=250`, token)).participants || [];
  const snapshot = [];
  for (const participant of participants) {
    const participantId = participant.name?.split('/').pop();
    if (!participantId) continue;
    const sessions = (await googleJson(`${MEET_RECORDS_URL}/${recordId}/participants/${participantId}/participantSessions?pageSize=250`, token)).participantSessions || [];
    const validSessions = sessions.filter((session) => session.startTime);
    if (!validSessions.length) continue;
    const firstJoin = validSessions.map((session) => session.startTime).sort()[0];
    const lastLeave = validSessions.map((session) => session.endTime).filter(Boolean).sort().at(-1) || null;
    snapshot.push({
      name: participant.displayName || participant.user?.displayName || 'Participant inconnu',
      email: participant.signedinUser?.email || participant.user?.signedinUser?.email || null,
      joinedAt: firstJoin,
      leftAt: lastLeave,
    });
  }
  return snapshot;
}

async function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) reject(new Error('google-auth-required'));
      else resolve(token);
    });
  });
}

async function syncEvent(event, token, sessions) {
  const eventKey = event.id;
  const meetingCode = getMeetingCode(event);
  const stored = sessions[eventKey];
  const createSession = async () => {
    const response = await fetch(`${BACKEND_URL}/api/v1/live/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meetingCode, scheduledStart: eventStart(event), expectedParticipants: expectedParticipants(event) }),
    });
    if (!response.ok) throw new Error(`backend-session-failed-${response.status}`);
    const created = await response.json();
    sessions[eventKey] = { id: created.id, meetingCode };
    return created;
  };
  let session = stored ? { id: stored.id } : await createSession();

  const participants = await fetchMeetSnapshot(meetingCode, eventStart(event), token);
  const update = () => fetch(`${BACKEND_URL}/api/v1/live/sessions/${encodeURIComponent(session.id)}/participants`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ participants }),
  });
  let response = await update();
  if (response.status === 404) {
    session = await createSession();
    response = await update();
  }
  if (!response.ok) throw new Error(`backend-snapshot-failed-${response.status}`);
}

async function runTrackingCycle() {
  const token = await getToken();
  const events = await fetchCalendarEvents(token);
  const saved = await chrome.storage.local.get('holbiesLiveSessions');
  const sessions = saved.holbiesLiveSessions || {};
  for (const event of events.filter((item) => isTrackableEvent(item))) {
    try { await syncEvent(event, token, sessions); } catch (error) { console.warn('Holbies tracking cycle failed', event.id, error); }
  }
  await chrome.storage.local.set({ holbiesLiveSessions: sessions, holbiesLastTrackingAt: new Date().toISOString() });
}

if (typeof chrome !== 'undefined') {
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 }));
  chrome.runtime.onStartup.addListener(() => chrome.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 }));
  chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === TRACKING_ALARM) runTrackingCycle().catch((error) => console.warn('Holbies tracking unavailable', error)); });
}

export { eventEnd, eventStart, expectedParticipants, extractMeetingCode, getMeetingCode, isTrackableEvent };
