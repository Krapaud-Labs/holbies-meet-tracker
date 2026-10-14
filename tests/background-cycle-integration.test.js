import assert from 'node:assert/strict';
import test from 'node:test';
import { syncEvent } from '../background.js';

test('runs the autonomous cycle from Agenda to snapshot and safe closure', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const responses = [
    { status: 201, body: { id: 'session-1' } },
    { status: 200, body: { conferenceRecords: [{ name: 'conferenceRecords/record-1', startTime: '2026-10-14T08:55:00Z' }] } },
    { status: 200, body: { participants: [{ name: 'conferenceRecords/record-1/participants/p-1', displayName: 'Alice Test', signedinUser: { email: 'alice@holbertonschool.com' } }] } },
    { status: 200, body: { participantSessions: [{ startTime: '2026-10-14T09:05:00Z', endTime: '2026-10-14T10:05:00Z' }] } },
    { status: 200, body: {} },
    { status: 200, body: { id: 'session-1', endedAt: '2026-10-14T10:20:00Z' } },
  ];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body || null });
    const next = responses.shift();
    return { ok: next.status >= 200 && next.status < 300, status: next.status, async json() { return next.body; } };
  };

  try {
    const sessions = {};
    await syncEvent({
      id: 'agenda-1',
      start: { dateTime: '2026-10-14T09:00:00Z' },
      end: { dateTime: '2026-10-14T10:10:00Z' },
      hangoutLink: 'https://meet.google.com/abc-mnop-xyz',
      attendees: [{ email: 'alice@holbertonschool.com', displayName: 'Alice Test' }],
    }, 'token', sessions);

    assert.equal(sessions['agenda-1'].id, 'session-1');
    assert.deepEqual(calls.map((call) => call.method), ['POST', 'GET', 'GET', 'GET', 'PUT', 'POST']);
    assert.match(calls[4].body, /Alice Test/);
    assert.match(calls[5].url, /\/end$/);
    assert.equal(responses.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
