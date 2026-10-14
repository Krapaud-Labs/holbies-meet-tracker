import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './database.js';
import { applyMeetEvent, applyParticipantSnapshot, createLiveStore, decodeWorkspaceEvent, renderReportHtml, verifyEventsSecret, verifyGoogleAccessToken } from './live.js';

const port = Number(process.env.PORT || 8080);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 256 * 1024);
const allowedExtensionOrigin = process.env.ALLOWED_EXTENSION_ORIGIN || 'chrome-extension://jilidimjjdkgdggfkackomkmjjldlpaf';
const store = createLiveStore();
const database = createDatabase();

function bearerToken(request) {
  return request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

async function authenticate(request) {
  return verifyGoogleAccessToken(bearerToken(request));
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (origin === allowedExtensionOrigin) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
  response.setHeader('access-control-allow-headers', 'Authorization, Content-Type, X-Google-Events-Secret');
  response.setHeader('access-control-max-age', '600');
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        const error = new Error('payload-too-large');
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      raw += chunk;
    });
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid-json')); }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response);
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, { status: 'ok', service: 'holbies-meet-tracker-live' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/live/sessions') {
    try {
      const body = await readBody(request);
      const mentor = await authenticate(request);
      if (!mentor) {
        json(response, 403, { error: 'mentor-domain-not-allowed' });
        return;
      }
      if (typeof body.meetingId !== 'string' || body.meetingId.length > 512 || Number.isNaN(Date.parse(body.scheduledStart)) ) {
        json(response, 400, { error: 'meetingId-and-scheduledStart-required' });
        return;
      }
      if (body.expectedParticipants !== undefined && (!Array.isArray(body.expectedParticipants) || body.expectedParticipants.length > 250)) {
        json(response, 400, { error: 'invalid-expected-participants' });
        return;
      }
      const session = {
        id: randomUUID(),
        meetingId: body.meetingId,
        mentorEmail: mentor.email,
        scheduledStart: body.scheduledStart,
        expectedParticipants: (body.expectedParticipants || []).filter((participant) => participant && (participant.email || participant.name || participant.displayName)),
        participants: [],
        createdAt: new Date().toISOString(),
      };
      store.upsert(session);
      if (database) await database.saveSession(session);
      json(response, 201, session);
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/v1/live/sessions/')) {
    const session = store.get(url.pathname.split('/').pop());
    const mentor = await authenticate(request);
    if (!mentor) json(response, 403, { error: 'mentor-domain-not-allowed' });
    else if (!session) json(response, 404, { error: 'live-session-not-found' });
    else if (session.mentorEmail !== mentor.email) json(response, 403, { error: 'session-owner-only' });
    else json(response, 200, session);
    return;
  }

  if (request.method === 'PUT' && url.pathname.startsWith('/api/v1/live/sessions/') && url.pathname.endsWith('/participants')) {
    try {
      const sessionId = url.pathname.split('/').at(-2);
      const session = store.get(sessionId);
      const mentor = await authenticate(request);
      if (!mentor) json(response, 403, { error: 'mentor-domain-not-allowed' });
      else if (!session) json(response, 404, { error: 'live-session-not-found' });
      else if (session.mentorEmail !== mentor.email) json(response, 403, { error: 'session-owner-only' });
      else {
        const body = await readBody(request);
        applyParticipantSnapshot(session, body.participants);
        json(response, 200, session);
      }
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname.startsWith('/api/v1/live/sessions/') && url.pathname.endsWith('/end')) {
    const sessionId = url.pathname.split('/').at(-2);
    const session = store.get(sessionId);
    const mentor = await authenticate(request);
    if (!mentor) json(response, 403, { error: 'mentor-domain-not-allowed' });
    else if (!session) json(response, 404, { error: 'live-session-not-found' });
    else if (session.mentorEmail !== mentor.email) json(response, 403, { error: 'session-owner-only' });
    else {
      session.endedAt = new Date().toISOString();
      if (database) await database.saveSession(session);
      json(response, 200, session);
    }
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
    const session = store.get(url.pathname.split('/').pop());
    const mentor = await authenticate(request);
    if (!mentor) json(response, 403, { error: 'mentor-domain-not-allowed' });
    else if (!session) json(response, 404, { error: 'report-not-found' });
    else if (session.mentorEmail !== mentor.email) json(response, 403, { error: 'session-owner-only' });
    else {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
        'x-content-type-options': 'nosniff',
      });
      response.end(renderReportHtml(session));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/events/google') {
    try {
      if (!verifyEventsSecret(request.headers['x-google-events-secret'], process.env.GOOGLE_EVENTS_SECRET)) {
        json(response, 401, { error: 'google-events-unauthorized' });
        return;
      }
      const event = decodeWorkspaceEvent(await readBody(request));
      const meetingId = event?.conferenceRecord?.name || event?.participantSession?.conferenceRecord;
      const session = meetingId ? store.findByMeeting(meetingId) : null;
      if (!event || !session) {
        json(response, 202, { accepted: true, processed: false });
        return;
      }
      applyMeetEvent(session, event);
      if (database) await database.saveParticipantEvent(session.id, event.participantSession, event.type.endsWith('.left') ? 'left' : 'joined', event.eventTime || new Date().toISOString());
      json(response, 202, { accepted: true, processed: true, sessionId: session.id });
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }

  json(response, 404, { error: 'not-found' });
});

async function start() {
  if (database) {
    try {
      for (const session of await database.loadSessions()) store.upsert(session);
      console.log(`Restored ${store.size()} live session(s) from PostgreSQL`);
    } catch (error) {
      console.error(`PostgreSQL restore failed: ${error.message}`);
    }
  }
  server.listen(port, () => console.log(`Live backend listening on ${port}`));
}

start();
