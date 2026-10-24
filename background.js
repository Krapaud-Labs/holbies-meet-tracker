import './config.js';

const BACKEND_URL = globalThis.HOLBIES_CONFIG?.liveBackendUrl || '';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MEET_RECORDS_URL = 'https://meet.googleapis.com/v2/conferenceRecords';
const TRACKING_ALARM = 'holbies-meet-tracking';
const WINDOW_BEFORE_MS = 15 * 60 * 1000;
const WINDOW_AFTER_MS = 6 * 60 * 60 * 1000;
const SESSION_CLOSE_GRACE_MS = 10 * 60 * 1000;
const MAX_GOOGLE_PAGES = 100;
const MAX_PAGE_TOKEN_LENGTH = 4096;

function requireAccessToken(token) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('google-auth-required');
  return token.trim();
}

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

function selectClosestMeetRecord(records, scheduledStart) {
  const target = Date.parse(scheduledStart || '');
  return [...records]
    .filter((record) => record?.name && !Number.isNaN(Date.parse(record.startTime || '')))
    .sort((left, right) => {
      if (Number.isNaN(target)) return Date.parse(right.startTime) - Date.parse(left.startTime);
      return Math.abs(Date.parse(left.startTime) - target) - Math.abs(Date.parse(right.startTime) - target);
    })[0] || null;
}

function isTrackableEvent(event, now = Date.now()) {
  const start = Date.parse(eventStart(event) || '');
  const end = Date.parse(eventEnd(event) || '');
  return Boolean(getMeetingCode(event) && !Number.isNaN(start) && !Number.isNaN(end)
    && now >= start - WINDOW_BEFORE_MS && now <= end + WINDOW_AFTER_MS);
}

function shouldCloseEvent(event, now = Date.now()) {
  const end = Date.parse(eventEnd(event) || '');
  return !Number.isNaN(end) && now >= end + SESSION_CLOSE_GRACE_MS;
}

function expectedParticipants(event) {
  return (event.attendees || [])
    .map((attendee) => {
      const email = normalizeEmail(attendee?.email);
      const displayName = typeof attendee?.displayName === 'string' ? attendee.displayName.trim() : '';
      return { attendee, email, displayName };
    })
    .filter(({ attendee, email, displayName }) => !email?.endsWith('@resource.calendar.google.com') && Boolean(email || displayName))
    .map(({ email, displayName }) => ({
      email,
      displayName: displayName || email,
      ...(!email ? { status: 'identity-to-check' } : {}),
    }));
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().normalize('NFC');
  if (!/^[^@\s]+@[^@\s]+$/u.test(email)) return null;
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator === email.length - 1) return null;
  return `${email.slice(0, separator)}@${email.slice(separator + 1).toLowerCase()}`;
}

async function googleJson(url, token, options = {}) {
  token = requireAccessToken(token);
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`google-request-failed-${response.status}`);
  return response.json();
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

async function fetchAllGooglePages(url, collectionKey, token) {
  token = requireAccessToken(token);
  const baseUrl = new URL(url);
  baseUrl.searchParams.delete('pageToken');
  const items = [];
  const seenTokens = new Set();
  let pageToken = null;

  for (let pageIndex = 0; pageIndex < MAX_GOOGLE_PAGES; pageIndex += 1) {
    const pageUrl = new URL(baseUrl);
    if (pageToken !== null) pageUrl.searchParams.set('pageToken', pageToken);
    const page = await googleJson(pageUrl, token);
    if (!page || !Object.prototype.hasOwnProperty.call(page, collectionKey) || !Array.isArray(page[collectionKey])) {
      throw new Error('google-pagination-invalid-collection');
    }
    items.push(...page[collectionKey]);

    if (page?.nextPageToken === undefined || page.nextPageToken === null) return items;
    const nextPageToken = validatePageToken(page.nextPageToken);
    if (seenTokens.has(nextPageToken)) throw new Error('google-pagination-token-loop');
    if (pageIndex === MAX_GOOGLE_PAGES - 1) throw new Error('google-pagination-page-limit');
    seenTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }

  throw new Error('google-pagination-page-limit');
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
  return fetchAllGooglePages(url, 'items', token);
}

async function fetchMeetSnapshot(meetingCode, scheduledStart, token) {
  token = requireAccessToken(token);
  const recordsUrl = new URL(MEET_RECORDS_URL);
  recordsUrl.searchParams.set('filter', `space.meeting_code = "${meetingCode}"`);
  recordsUrl.searchParams.set('pageSize', '10');
  const records = await fetchAllGooglePages(recordsUrl, 'conferenceRecords', token);
  const record = selectClosestMeetRecord(records, scheduledStart);
  if (!record) throw new Error('meet-record-not-found');
  if (typeof record.name !== 'string' || !record.name.startsWith('conferenceRecords/')) throw new Error('meet-record-invalid-name');

  const recordId = record.name.split('/').pop();
  if (!recordId || recordId === record.name) throw new Error('meet-record-invalid-name');
  const participantsUrl = new URL(`${MEET_RECORDS_URL}/${encodeURIComponent(recordId)}/participants`);
  participantsUrl.searchParams.set('pageSize', '250');
  const participants = await fetchAllGooglePages(participantsUrl, 'participants', token);
  const snapshot = [];
  for (const participant of participants) {
    if (typeof participant?.name !== 'string' || !participant.name.startsWith(`${record.name}/participants/`)) {
      throw new Error('meet-participant-invalid-name');
    }
    const participantId = participant.name?.split('/').pop();
    if (!participantId || participantId === participant.name) throw new Error('meet-participant-invalid-name');
    const sessionsUrl = new URL(`${MEET_RECORDS_URL}/${encodeURIComponent(recordId)}/participants/${encodeURIComponent(participantId)}/participantSessions`);
    sessionsUrl.searchParams.set('pageSize', '250');
    const sessions = await fetchAllGooglePages(sessionsUrl, 'participantSessions', token);
    if (!sessions.length || sessions.some((session) => !session?.startTime
      || Number.isNaN(Date.parse(session.startTime))
      || (session.endTime !== undefined && session.endTime !== null && (typeof session.endTime !== 'string' || Number.isNaN(Date.parse(session.endTime)))))) {
      throw new Error('meet-participant-sessions-incomplete');
    }
    const firstJoin = sessions.reduce((earliest, session) => Date.parse(session.startTime) < Date.parse(earliest) ? session.startTime : earliest, sessions[0].startTime);
    const endedSessions = sessions.map((session) => session.endTime).filter((endTime) => endTime && !Number.isNaN(Date.parse(endTime)));
    const lastLeave = endedSessions.reduce((latest, endTime) => Date.parse(endTime) > Date.parse(latest) ? endTime : latest, endedSessions[0] || null);
    snapshot.push({
      name: participant.displayName || participant.user?.displayName || 'Participant inconnu',
      email: normalizeEmail(participant.signedinUser?.email || participant.user?.signedinUser?.email),
      joinedAt: firstJoin,
      leftAt: lastLeave,
    });
  }
  return snapshot;
}

async function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      try {
        if (chrome.runtime.lastError) throw new Error('google-auth-required');
        resolve(requireAccessToken(token));
      } catch {
        reject(new Error('google-auth-required'));
      }
    });
  });
}

async function syncEvent(event, token, sessions) {
  token = requireAccessToken(token);
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
  const participants = await fetchMeetSnapshot(meetingCode, eventStart(event), token);
  let session = stored ? { id: stored.id } : await createSession();
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
  if (shouldCloseEvent(event)) {
    const closeResponse = await fetch(`${BACKEND_URL}/api/v1/live/sessions/${encodeURIComponent(session.id)}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!closeResponse.ok && closeResponse.status !== 409) throw new Error(`backend-close-failed-${closeResponse.status}`);
  }
}

async function runTrackingCycle() {
  const startedAt = new Date().toISOString();
  try {
    const token = requireAccessToken(await getToken());
    const events = await fetchCalendarEvents(token);
    const saved = await chrome.storage.local.get('holbiesLiveSessions');
    const sessions = saved.holbiesLiveSessions || {};
    const trackedEvents = events.filter((item) => isTrackableEvent(item));
    const errors = [];
    for (const event of trackedEvents) {
      try { await syncEvent(event, token, sessions); } catch (error) {
        errors.push({ eventId: event.id, message: error.message });
        console.warn('Holbies tracking cycle failed', event.id, error);
      }
    }
    await chrome.storage.local.set({
      holbiesLiveSessions: sessions,
      holbiesTrackingStatus: { state: errors.length ? 'degraded' : 'ok', startedAt, finishedAt: new Date().toISOString(), trackedEvents: trackedEvents.length, errors },
      holbiesLastTrackingAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error?.message === 'google-auth-required') return;
    await chrome.storage.local.set({ holbiesTrackingStatus: { state: 'error', startedAt, finishedAt: new Date().toISOString(), trackedEvents: 0, errors: [{ message: error.message }] } });
    throw error;
  }
}

if (typeof chrome !== 'undefined') {
  const startTracking = () => {
    chrome.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
    runTrackingCycle().catch((error) => console.warn('Holbies tracking unavailable', error));
  };
  chrome.runtime.onInstalled.addListener(startTracking);
  chrome.runtime.onStartup.addListener(startTracking);
  chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === TRACKING_ALARM) runTrackingCycle().catch((error) => console.warn('Holbies tracking unavailable', error)); });
}

export { eventEnd, eventStart, expectedParticipants, extractMeetingCode, fetchAllGooglePages, fetchMeetSnapshot, getMeetingCode, getToken, googleJson, isTrackableEvent, shouldCloseEvent, syncEvent, requireAccessToken };
