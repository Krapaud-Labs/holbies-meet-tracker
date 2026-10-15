import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createDatabase } from './database.js';
import { applyMeetEvent, applyParticipantSnapshot, createLiveStore, decodeWorkspaceEvent, getParticipantStatuses, mergeIdentityRows, renderReportHtml, verifyEventsSecret, verifyGoogleAccessToken } from './live.js';

const port = Number(process.env.PORT || 8080);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 256 * 1024);
const allowedExtensionOrigin = process.env.ALLOWED_EXTENSION_ORIGIN || 'chrome-extension://jilidimjjdkgdggfkackomkmjjldlpaf';
const store = createLiveStore();
const database = createDatabase();
const websocketServer = new WebSocketServer({
  noServer: true,
  handleProtocols(protocols) {
    return protocols.has('holbies-live-v1') ? 'holbies-live-v1' : false;
  },
});
const websocketClients = new Map();
const maxWebSocketClientsPerSession = Number(process.env.MAX_WEBSOCKET_CLIENTS_PER_SESSION || 20);
const websocketTicketTtlMs = Number(process.env.WEBSOCKET_TICKET_TTL_MS || 30_000);
const websocketTickets = new Map();

function sessionSnapshot(session) {
  return { ...session, participantStatuses: getParticipantStatuses(session) };
}

function broadcastSession(session, type = 'session.updated') {
  const clients = websocketClients.get(session.id);
  if (!clients) return;
  const message = JSON.stringify({ type, session: sessionSnapshot(session) });
  for (const client of clients) {
    if (client.readyState === 1) client.send(message);
    if (type === 'session.ended' && client.readyState === 1) client.close(1000, 'session-ended');
  }
}

function subscribeWebSocket(sessionId, socket) {
  const clients = websocketClients.get(sessionId) || new Set();
  if (clients.size >= maxWebSocketClientsPerSession) return false;
  clients.add(socket);
  websocketClients.set(sessionId, clients);
  socket.once('close', () => {
    clients.delete(socket);
    if (clients.size === 0) websocketClients.delete(sessionId);
  });
  return true;
}

function createWebSocketTicket(sessionId, mentorEmail) {
  const ticket = randomBytes(32).toString('base64url');
  websocketTickets.set(ticket, { sessionId, mentorEmail, expiresAt: Date.now() + websocketTicketTtlMs });
  return ticket;
}

function consumeWebSocketTicket(ticket, sessionId, mentorEmail) {
  if (typeof ticket !== 'string' || ticket.length < 32) return false;
  const entry = websocketTickets.get(ticket);
  websocketTickets.delete(ticket);
  if (!entry || entry.expiresAt < Date.now() || entry.sessionId !== sessionId || entry.mentorEmail !== mentorEmail) return false;
  return true;
}

function sameOrigin(request) {
  return request.headers.origin === allowedExtensionOrigin;
}

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
        expectedParticipants: mergeIdentityRows(body.expectedParticipants || []),
        participants: [],
        createdAt: new Date().toISOString(),
      };
      store.upsert(session);
      if (database) await database.saveSession(session);
      broadcastSession(session, 'session.created');
      json(response, 201, session);
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname.startsWith('/api/v1/live/sessions/') && url.pathname.endsWith('/stream-ticket')) {
    const sessionId = url.pathname.split('/').at(-2);
    const session = store.get(sessionId);
    const mentor = await authenticate(request);
    if (!sameOrigin(request)) json(response, 403, { error: 'extension-origin-required' });
    else if (!mentor) json(response, 403, { error: 'mentor-domain-not-allowed' });
    else if (!session) json(response, 404, { error: 'live-session-not-found' });
    else if (session.mentorEmail !== mentor.email) json(response, 403, { error: 'session-owner-only' });
    else json(response, 201, { ticket: createWebSocketTicket(session.id, mentor.email), expiresInMs: websocketTicketTtlMs });
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/v1/live/sessions/')) {
    const session = store.get(url.pathname.split('/').pop());
    const mentor = await authenticate(request);
    if (!mentor) json(response, 403, { error: 'mentor-domain-not-allowed' });
    else if (!session) json(response, 404, { error: 'live-session-not-found' });
    else if (session.mentorEmail !== mentor.email) json(response, 403, { error: 'session-owner-only' });
    else json(response, 200, { ...session, participantStatuses: getParticipantStatuses(session) });
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
        if (database) await database.saveSession(session);
        broadcastSession(session);
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
      broadcastSession(session, 'session.ended');
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
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
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
      broadcastSession(session);
      json(response, 202, { accepted: true, processed: true, sessionId: session.id });
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }

  json(response, 404, { error: 'not-found' });
});

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const match = url.pathname.match(/^\/api\/v1\/live\/sessions\/([^/]+)\/stream$/);
  const session = match ? store.get(match[1]) : null;
  const ticket = url.searchParams.get('ticket');
  const protocols = String(request.headers['sec-websocket-protocol'] || '').split(',').map((protocol) => protocol.trim());
  if (!match || !session || !sameOrigin(request) || !protocols.includes('holbies-live-v1') || !consumeWebSocketTicket(ticket, session.id, session.mentorEmail)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit('connection', websocket, request, session);
  });
});

websocketServer.on('connection', (socket, _request, session) => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', (raw) => {
    if (raw.toString() === '{"type":"ping"}') socket.send('{"type":"pong"}');
  });
  if (!subscribeWebSocket(session.id, socket)) {
    socket.close(1013, 'too-many-connections');
    return;
  }
  socket.send(JSON.stringify({ type: 'session.snapshot', session: sessionSnapshot(session) }));
});

const heartbeat = setInterval(() => {
  for (const [ticket, entry] of websocketTickets) {
    if (entry.expiresAt < Date.now()) websocketTickets.delete(ticket);
  }
  for (const clients of websocketClients.values()) {
    for (const socket of clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }
}, 30000);
heartbeat.unref();

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
