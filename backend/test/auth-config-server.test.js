import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const backendDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const clientId = '123456789012-test-client.apps.googleusercontent.com';
const allowedOrigin = `chrome-extension://${'a'.repeat(32)}`;
const disallowedOrigin = `chrome-extension://${'b'.repeat(32)}`;
const accessToken = 'synthetic-access-token-with-enough-length';
let server;
let serverUrl;
let tokenInfoCalls;
let tokenInfoRequest;
let originalFetch;

function runServerWithEnvironment(overrides) {
  const env = { ...process.env, NODE_ENV: 'test', ...overrides };
  return spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/server.js')"], {
    cwd: backendDirectory,
    env,
    encoding: 'utf8',
  });
}

function request(method, pathname, headers = {}) {
  return new Promise((resolveRequest, rejectRequest) => {
    const url = new URL(pathname, serverUrl);
    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', rejectRequest);
    req.end();
  });
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_CLIENT_ID = clientId;
  process.env.ALLOWED_EXTENSION_ORIGIN = allowedOrigin;
  process.env.DATABASE_URL = '';
  tokenInfoCalls = 0;
  tokenInfoRequest = null;
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    tokenInfoCalls += 1;
    tokenInfoRequest = { url: String(url), options };
    return new Response(JSON.stringify({
      audience: clientId,
      issued_to: clientId,
      email: 'mentor@holbertonschool.com',
      verified_email: true,
      user_id: 'synthetic-user-id',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/meetings.space.readonly',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  ({ server } = await import('../src/server.js'));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  serverUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (server?.listening) {
    server.close();
    await once(server, 'close');
  }
});

test('startup fails closed when GOOGLE_CLIENT_ID is absent or malformed without echoing its value', () => {
  for (const value of ['', 'not-a-real-client-secret']) {
    const result = runServerWithEnvironment({ GOOGLE_CLIENT_ID: value, ALLOWED_EXTENSION_ORIGIN: allowedOrigin });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /GOOGLE_CLIENT_ID/);
    assert.doesNotMatch(result.stderr, /not-a-real-client-secret/);
  }
});

test('startup fails closed when ALLOWED_EXTENSION_ORIGIN is absent or malformed without echoing it', () => {
  for (const value of ['', 'https://example.invalid', `${allowedOrigin}/popup.html`, `${allowedOrigin}?x=1`]) {
    const result = runServerWithEnvironment({ GOOGLE_CLIENT_ID: clientId, ALLOWED_EXTENSION_ORIGIN: value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ALLOWED_EXTENSION_ORIGIN/);
    assert.doesNotMatch(result.stderr, /https:\/\/example\.invalid/);
  }
});

test('missing GOOGLE_CLIENT_ID makes access-token verification return before any Google request', () => {
  const env = { ...process.env };
  delete env.GOOGLE_CLIENT_ID;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    let calls = 0;
    const { verifyGoogleAccessToken } = await import('./src/live.js');
    const verified = await verifyGoogleAccessToken('${accessToken}', async () => { calls += 1; return { ok: true, json: async () => ({}) }; });
    if (verified !== null || calls !== 0) process.exit(1);
  `], { cwd: backendDirectory, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('real HTTP CORS allows only the configured exact extension origin', async () => {
  const accepted = await request('OPTIONS', '/api/v1/live/sessions', {
    origin: allowedOrigin,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'authorization,content-type',
  });
  assert.equal(accepted.status, 204);
  assert.equal(accepted.headers['access-control-allow-origin'], allowedOrigin);
  assert.equal(accepted.headers.vary, 'Origin');

  const rejected = await request('OPTIONS', '/api/v1/live/sessions', {
    origin: disallowedOrigin,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'authorization,content-type',
  });
  assert.equal(rejected.status, 204);
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  assert.equal(rejected.headers['access-control-allow-methods'], undefined);
});

test('stream-ticket rejects a mismatched Origin before calling Google tokeninfo', async () => {
  const beforeCalls = tokenInfoCalls;
  const response = await request('POST', '/api/v1/live/sessions/missing-session/stream-ticket', {
    origin: disallowedOrigin,
    authorization: `Bearer ${accessToken}`,
  });
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error, 'extension-origin-required');
  assert.equal(tokenInfoCalls, beforeCalls);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('stream-ticket validates the Google access token only after the configured Origin passes', async () => {
  const beforeCalls = tokenInfoCalls;
  const response = await request('POST', '/api/v1/live/sessions/missing-session/stream-ticket', {
    origin: allowedOrigin,
    authorization: `Bearer ${accessToken}`,
  });
  assert.equal(response.status, 404);
  assert.equal(JSON.parse(response.body).error, 'live-session-not-found');
  assert.equal(tokenInfoCalls, beforeCalls + 1);
  assert.equal(new URL(tokenInfoRequest.url).origin + new URL(tokenInfoRequest.url).pathname, 'https://www.googleapis.com/oauth2/v2/tokeninfo');
  assert.equal(tokenInfoRequest.options.method, 'POST');
  assert.equal(new URL(tokenInfoRequest.url).searchParams.get('access_token'), accessToken);
  assert.doesNotMatch(response.body, /synthetic-access-token/);
  assert.equal(response.headers['access-control-allow-origin'], allowedOrigin);
});
