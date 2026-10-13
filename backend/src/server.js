import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createLiveStore, renderReportHtml, verifyGoogleAccessToken } from './live.js';

const port = Number(process.env.PORT || 8080);
const store = createLiveStore();

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid-json')); }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, { status: 'ok', service: 'holbies-meet-tracker-live' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/live/sessions') {
    try {
      const body = await readBody(request);
      const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
      const mentor = await verifyGoogleAccessToken(token);
      if (!mentor) {
        json(response, 403, { error: 'mentor-domain-not-allowed' });
        return;
      }
      if (!body.meetingId || !body.scheduledStart) {
        json(response, 400, { error: 'meetingId-and-scheduledStart-required' });
        return;
      }
      const session = {
        id: randomUUID(),
        meetingId: body.meetingId,
        mentorEmail: mentor.email,
        scheduledStart: body.scheduledStart,
        expectedParticipants: Array.isArray(body.expectedParticipants) ? body.expectedParticipants : [],
        participants: [],
        createdAt: new Date().toISOString(),
      };
      store.upsert(session);
      json(response, 201, session);
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/v1/live/sessions/')) {
    const session = store.get(url.pathname.split('/').pop());
    if (!session) json(response, 404, { error: 'live-session-not-found' });
    else json(response, 200, session);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/reports/')) {
    const session = store.get(url.pathname.split('/').pop());
    if (!session) json(response, 404, { error: 'report-not-found' });
    else {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderReportHtml(session));
    }
    return;
  }

  json(response, 404, { error: 'not-found' });
});

server.listen(port, () => console.log(`Live backend listening on ${port}`));
