import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAllGooglePages, fetchMeetSnapshot, getToken, googleJson, syncEvent } from '../background.js';

const token = 'valid-test-token-1234567890';
const meetingCode = 'abc-mnop-xyz';
const scheduledStart = '2099-10-13T09:00:00.000Z';

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

function makeFutureEvent(id = 'event-1') {
  return {
    id,
    start: { dateTime: scheduledStart },
    end: { dateTime: '2099-10-13T10:00:00.000Z' },
    hangoutLink: `https://meet.google.com/${meetingCode}`,
    attendees: [{ email: 'ada@holbertonstudents.com', displayName: 'Ada Lovelace' }],
  };
}

function setFetch(fetchImpl) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  return () => { globalThis.fetch = previous; };
}

test('worker snapshot exhausts records, participants, and each participant session pagination', async () => {
  const urls = [];
  const restoreFetch = setFetch(async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname === '/v2/conferenceRecords') {
      if (!url.searchParams.has('pageToken')) return response(200, {
        conferenceRecords: [{ name: 'conferenceRecords/older', startTime: '2099-10-13T08:00:00Z' }],
        nextPageToken: 'records-page-2',
      });
      assert.equal(url.searchParams.get('pageToken'), 'records-page-2');
      return response(200, { conferenceRecords: [{ name: 'conferenceRecords/target', startTime: scheduledStart }] });
    }
    if (url.pathname === '/v2/conferenceRecords/target/participants') {
      if (!url.searchParams.has('pageToken')) return response(200, {
        participants: [{ name: 'conferenceRecords/target/participants/p1', displayName: 'Ada Lovelace', signedinUser: { email: 'ada@HOLBERTONSTUDENTS.COM' } }],
        nextPageToken: 'participants-page-2',
      });
      assert.equal(url.searchParams.get('pageToken'), 'participants-page-2');
      return response(200, { participants: [{ name: 'conferenceRecords/target/participants/p2', displayName: 'Grace Hopper', signedinUser: { email: 'grace@holbertonstudents.com' } }] });
    }
    if (url.pathname.endsWith('/participants/p1/participantSessions')) {
      if (!url.searchParams.has('pageToken')) return response(200, { participantSessions: [{ startTime: '2099-10-13T09:05:00Z' }], nextPageToken: 'p1-sessions-2' });
      assert.equal(url.searchParams.get('pageToken'), 'p1-sessions-2');
      return response(200, { participantSessions: [{ startTime: '2099-10-13T09:30:00Z', endTime: '2099-10-13T09:35:00Z' }] });
    }
    if (url.pathname.endsWith('/participants/p2/participantSessions')) {
      if (!url.searchParams.has('pageToken')) return response(200, { participantSessions: [{ startTime: '2099-10-13T09:01:00Z', endTime: '2099-10-13T09:10:00Z' }], nextPageToken: 'p2-sessions-2' });
      assert.equal(url.searchParams.get('pageToken'), 'p2-sessions-2');
      return response(200, { participantSessions: [{ startTime: '2099-10-13T09:20:00Z', endTime: '2099-10-13T09:40:00Z' }] });
    }
    throw new Error(`unexpected request ${url}`);
  });

  try {
    const snapshot = await fetchMeetSnapshot(meetingCode, scheduledStart, token);
    assert.deepEqual(snapshot.map(({ name, email, joinedAt, leftAt }) => ({ name, email, joinedAt, leftAt })), [
      { name: 'Ada Lovelace', email: 'ada@holbertonstudents.com', joinedAt: '2099-10-13T09:05:00Z', leftAt: '2099-10-13T09:35:00Z' },
      { name: 'Grace Hopper', email: 'grace@holbertonstudents.com', joinedAt: '2099-10-13T09:01:00Z', leftAt: '2099-10-13T09:40:00Z' },
    ]);
    assert.equal(urls.filter((url) => url.pathname === '/v2/conferenceRecords').length, 2);
    assert.equal(urls.filter((url) => url.pathname.endsWith('/participants') && !url.pathname.endsWith('/participantSessions')).length, 2);
    assert.equal(urls.filter((url) => url.pathname.endsWith('/participantSessions')).length, 4);
  } finally {
    restoreFetch();
  }
});

test('invalid OAuth values at getToken, googleJson, and syncEvent cause zero requests or session mutations', async (t) => {
  const invalidTokens = [null, undefined, '', '  ', false, 0, {}, []];
  for (const invalidToken of invalidTokens) {
    await t.test(String(invalidToken), async () => {
      let fetchCalls = 0;
      const restoreFetch = setFetch(async () => { fetchCalls += 1; return response(200, {}); });
      const previousChrome = globalThis.chrome;
      const beforeSessions = {};
      const storageWrites = [];
      globalThis.chrome = {
        identity: { getAuthToken(_options, callback) { callback(invalidToken); } },
        runtime: { lastError: null },
        storage: { local: { async set(value) { storageWrites.push(value); } } },
      };
      try {
        await assert.rejects(getToken(), /google-auth-required/);
        await assert.rejects(googleJson('https://meet.googleapis.com/v2/conferenceRecords', invalidToken), /google-auth-required/);
        const sessions = structuredClone(beforeSessions);
        await assert.rejects(syncEvent(makeFutureEvent(), invalidToken, sessions), /google-auth-required/);
        assert.deepEqual(sessions, beforeSessions);
        assert.deepEqual(storageWrites, []);
        assert.equal(fetchCalls, 0);
      } finally {
        if (previousChrome === undefined) delete globalThis.chrome;
        else globalThis.chrome = previousChrome;
        restoreFetch();
      }
    });
  }
});

test('malformed or repeated nextPageToken rejects the Meet page collection', async (t) => {
  const malformedTokens = ['', ' padded ', false, 1, {}, 'bad\u0001token', 'x'.repeat(4097)];
  for (const pageToken of malformedTokens) {
    await t.test(`invalid ${String(pageToken).slice(0, 24)}`, async () => {
      const restoreFetch = setFetch(async () => response(200, { conferenceRecords: [], nextPageToken: pageToken }));
      try {
        await assert.rejects(fetchAllGooglePages('https://meet.googleapis.com/v2/conferenceRecords', 'conferenceRecords', token), /google-pagination-invalid-page-token/);
      } finally {
        restoreFetch();
      }
    });
  }

  await t.test('repeated token is rejected before it can loop indefinitely', async () => {
    let calls = 0;
    const restoreFetch = setFetch(async () => {
      calls += 1;
      return response(200, { conferenceRecords: [], nextPageToken: 'same-token' });
    });
    try {
      await assert.rejects(fetchAllGooglePages('https://meet.googleapis.com/v2/conferenceRecords', 'conferenceRecords', token), /google-pagination-token-loop/);
      assert.equal(calls, 2);
    } finally {
      restoreFetch();
    }
  });
});

test('page without its collection key fails closed and prevents backend writes', async (t) => {
  await t.test('generic Google paginator rejects missing collection key', async () => {
    const restoreFetch = setFetch(async () => response(200, { nextPageToken: null }));
    try {
      await assert.rejects(
        fetchAllGooglePages('https://meet.googleapis.com/v2/conferenceRecords', 'conferenceRecords', token),
        /google-pagination-invalid-collection/,
      );
    } finally {
      restoreFetch();
    }
  });

  await t.test('missing participants collection causes zero backend writes or session mutations', async () => {
    const backendRequests = [];
    const restoreFetch = setFetch(async (input, options = {}) => {
      const url = new URL(String(input));
      if (!url.hostname.endsWith('googleapis.com')) {
        backendRequests.push({ url, options });
        return response(200, { id: 'backend-session-1' });
      }
      if (url.pathname === '/v2/conferenceRecords') {
        return response(200, { conferenceRecords: [{ name: 'conferenceRecords/target', startTime: scheduledStart }] });
      }
      if (url.pathname.endsWith('/participants') && !url.pathname.endsWith('/participantSessions')) {
        return response(200, { nextPageToken: null });
      }
      throw new Error(`unexpected request ${url}`);
    });
    const sessions = {};
    const beforeSessions = structuredClone(sessions);
    try {
      await assert.rejects(syncEvent(makeFutureEvent('event-missing-participants'), token, sessions), /google-pagination-invalid-collection/);
      assert.deepEqual(backendRequests, [], 'malformed collection must not write to the backend');
      assert.deepEqual(sessions, beforeSessions, 'malformed collection must not mutate local session state');
    } finally {
      restoreFetch();
    }
  });
});

test('later page failure rejects the snapshot before any backend write or local session mutation', async (t) => {
  const failureStages = ['conferenceRecords', 'participants', 'participantSessions'];
  for (const failureStage of failureStages) {
    await t.test(failureStage, async () => {
      const backendRequests = [];
      let sessionPageCalls = 0;
      const restoreFetch = setFetch(async (input, options = {}) => {
        const url = new URL(String(input));
        if (!url.hostname.endsWith('googleapis.com')) {
          backendRequests.push({ url, options });
          return response(200, { id: 'backend-session-1' });
        }
        if (url.pathname === '/v2/conferenceRecords') {
          if (failureStage === 'conferenceRecords') {
            return url.searchParams.has('pageToken')
              ? response(503, {})
              : response(200, { conferenceRecords: [], nextPageToken: 'records-next' });
          }
          return response(200, { conferenceRecords: [{ name: 'conferenceRecords/target', startTime: scheduledStart }] });
        }
        if (url.pathname.endsWith('/participants') && !url.pathname.endsWith('/participantSessions')) {
          if (failureStage === 'participants') {
            return url.searchParams.has('pageToken')
              ? response(503, {})
              : response(200, { participants: [], nextPageToken: 'participants-next' });
          }
          return response(200, { participants: [{ name: 'conferenceRecords/target/participants/p1', displayName: 'Ada', signedinUser: { email: 'ada@holbertonstudents.com' } }] });
        }
        if (url.pathname.endsWith('/participantSessions')) {
          sessionPageCalls += 1;
          return failureStage === 'participantSessions' && sessionPageCalls > 1
            ? response(503, {})
            : response(200, { participantSessions: [{ startTime: '2099-10-13T09:01:00Z' }], nextPageToken: 'sessions-next' });
        }
        throw new Error(`unexpected request ${url}`);
      });
      const sessions = {};
      const beforeSessions = structuredClone(sessions);
      try {
        await assert.rejects(syncEvent(makeFutureEvent(`event-${failureStage}`), token, sessions), /google-request-failed-503/);
        assert.deepEqual(backendRequests, [], 'failed collection must not write to the backend');
        assert.deepEqual(sessions, beforeSessions, 'failed collection must not persist a partial backend session locally');
      } finally {
        restoreFetch();
      }
    });
  }
});
