import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const popupSource = await readFile(new URL('../popup.js', import.meta.url), 'utf8');
const backgroundSource = await readFile(new URL('../background.js', import.meta.url), 'utf8');

test('extension exchanges its Google token for a one-time WebSocket ticket', () => {
  assert.match(popupSource, /stream-ticket/);
  assert.match(popupSource, /const \{ ticket \} = await ticketResponse\.json\(\)/);
  assert.match(popupSource, /new\s+WebSocket\s*\(/, 'popup must open a WebSocket connection');
  assert.match(popupSource, /onopen|addEventListener\(['"]open/i, 'popup must handle WebSocket connection success');
  assert.match(popupSource, /replace\(\/\^http\/i, ['"]ws['"]\)/, 'WebSocket URL must derive ws or wss from the HTTPS backend');
  assert.match(popupSource, /\?ticket=\$\{encodeURIComponent\(ticket\)\}/);
  assert.match(popupSource, /new WebSocket\(socketUrl, \['holbies-live-v1'\]\)/);
  assert.doesNotMatch(popupSource, /bearer\.\$\{currentAccessToken\}/);
});

test('extension applies incoming live updates to the presence view', () => {
  assert.match(popupSource, /onmessage|addEventListener\(['"]message/i, 'popup must consume WebSocket messages');
  assert.match(popupSource, /participant|presence|live/i, 'incoming messages must update live presence state');
});

test('extension reconnects after a WebSocket close or error', () => {
  assert.match(popupSource, /onclose|addEventListener\(['"]close/i, 'popup must handle WebSocket closure');
  assert.match(popupSource, /onerror|addEventListener\(['"]error/i, 'popup must handle WebSocket errors');
  assert.match(popupSource, /setTimeout|setInterval/i, 'reconnection must be delayed or bounded');
});

test('extension keeps HTTP polling as a fallback when WebSocket is unavailable', () => {
  assert.match(popupSource, /setInterval\(\(\)\s*=>\s*refreshLiveSession\(\)/, 'popup must retain a polling fallback');
  assert.match(popupSource, /WebSocket|websocket/i, 'fallback must be coupled to WebSocket availability');
  assert.match(backgroundSource, /fetch\([^)]*participants|\/participants/i, 'background sync must keep the HTTP participant snapshot path');
});
