import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serverSource = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
const packageSource = await readFile(new URL('../package.json', import.meta.url), 'utf8');

test('backend exchanges HTTP Bearer authentication for a one-time WebSocket ticket', () => {
  assert.match(packageSource, /"ws"\s*:/);
  assert.match(serverSource, /new WebSocketServer/);
  assert.match(serverSource, /server\.on\(['"]upgrade['"]/);
  assert.match(serverSource, /stream-ticket/);
  assert.match(serverSource, /createWebSocketTicket/);
  assert.match(serverSource, /consumeWebSocketTicket/);
  assert.match(serverSource, /randomBytes/);
  assert.doesNotMatch(serverSource, /bearer\.\$\{currentAccessToken\}/);
  assert.match(serverSource, /holbies-live-v1/);
  assert.match(serverSource, /session\.mentorEmail !== mentor\.email/);
});

test('backend enforces the extension Origin during ticket issuance and upgrade', () => {
  assert.match(serverSource, /sameOrigin\(request\)/);
  assert.match(serverSource, /allowedExtensionOrigin/);
  assert.match(serverSource, /extension-origin-required/);
});

test('backend broadcasts participant updates to subscribed clients', () => {
  assert.match(serverSource, /subscribeWebSocket/);
  assert.match(serverSource, /broadcastSession\(session/);
  assert.match(serverSource, /participantStatuses/);
  assert.match(serverSource, /client\.send\(message\)/);
});

test('backend closes subscriptions and cleans them up after disconnect or session end', () => {
  assert.match(serverSource, /socket\.once\(['"]close['"]/);
  assert.match(serverSource, /clients\.delete\(socket\)/);
  assert.match(serverSource, /session\.endedAt/);
  assert.match(serverSource, /broadcastSession\(session, ['"]session\.ended['"]\)/);
});

test('backend keeps WebSocket connections healthy and bounded', () => {
  assert.match(serverSource, /socket\.isAlive/);
  assert.match(serverSource, /socket\.ping\(\)/);
  assert.match(serverSource, /socket\.terminate\(\)/);
});
