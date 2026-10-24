import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMeetEvent, applyParticipantSnapshot, calculateStatus, createLiveStore, decodeWorkspaceEvent, getParticipantStatuses, isAllowedEmail, renderReportHtml, verifyEventsSecret, verifyGoogleAccessToken } from '../src/live.js';

test('only Holberton School emails are allowed', () => {
  assert.equal(isAllowedEmail('mentor@holbertonschool.com'), true);
  assert.equal(isAllowedEmail('mentor@gmail.com'), false);
  assert.equal(isAllowedEmail('mentor@holbertonstudents.com'), false);
});

test('requires the exact Google events secret', () => {
  assert.equal(verifyEventsSecret('secret-123', 'secret-123'), true);
  assert.equal(verifyEventsSecret('secret-123', 'secret-124'), false);
  assert.equal(verifyEventsSecret(undefined, 'secret-123'), false);
  assert.equal(verifyEventsSecret('secret-123', undefined), false);
});

test('calculates late status and minutes', () => {
  const result = calculateStatus('2026-10-13T09:14:00Z', '2026-10-13T09:00:00Z');
  assert.deepEqual(result, { status: 'late', lateMinutes: 14 });
});

test('keeps a small delay on time', () => {
  const result = calculateStatus('2026-10-13T09:01:59Z', '2026-10-13T09:00:00Z');
  assert.deepEqual(result, { status: 'on-time', lateMinutes: 0 });
});

test('counts exactly two minutes as late', () => {
  assert.deepEqual(calculateStatus('2026-10-13T09:46:59Z', '2026-10-13T09:45:00Z'), { status: 'on-time', lateMinutes: 0 });
  assert.deepEqual(calculateStatus('2026-10-13T09:47:00Z', '2026-10-13T09:45:00Z'), { status: 'late', lateMinutes: 2 });
  assert.deepEqual(calculateStatus('2026-10-13T09:47:01Z', '2026-10-13T09:45:00Z'), { status: 'late', lateMinutes: 3 });
});

test('renders a safe HTML report with late participants highlighted', () => {
  const html = renderReportHtml({ mentorEmail: 'mentor@holbertonschool.com', participants: [{ name: '<Alice>', email: 'alice@holbertonstudents.com', joinedAt: '2026-10-13T09:08:00Z', status: 'late', lateMinutes: 8 }, { name: 'Bob', email: 'bob@holbertonstudents.com', joinedAt: '2026-10-13T09:00:00Z', status: 'on-time', lateMinutes: 0 }] });
  assert.match(html, /&lt;Alice&gt;/);
  assert.match(html, /class="late"/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /color-scheme/);
  assert.match(html, /Résumé des présences/);
  assert.match(html, /À l'heure : 1/);
  assert.match(html, /scope="col"/);
  assert.match(html, /alice@holbertonstudents\.com/);
  assert.match(html, /Arrivée/);
  assert.doesNotMatch(html, /<Alice>/);
});

test('accepts only a verified Google token from the allowed domain', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({
    email: 'mentor@holbertonschool.com',
    sub: 'subject-1',
    aud: 'test-client',
    iss: 'https://accounts.google.com',
    email_verified: true,
    expires_in: '3600',
    scope: 'https://www.googleapis.com/auth/meetings.space.readonly',
  }) });
  assert.deepEqual(await verifyGoogleAccessToken('a-valid-token-with-enough-length', fetchImpl), { email: 'mentor@holbertonschool.com', subject: 'subject-1' });
});

test('rejects blank or malformed OAuth tokens before contacting Google', async () => {
  const invalidTokens = [null, undefined, '', '   ', ' '.repeat(32), false, 0, {}, 'short'];
  for (const token of invalidTokens) {
    let fetchCount = 0;
    const result = await verifyGoogleAccessToken(token, async () => {
      fetchCount += 1;
      return { ok: true, json: async () => ({}) };
    });
    assert.equal(result, null, `token ${String(token)} must be rejected`);
    assert.equal(fetchCount, 0, `token ${String(token)} must not trigger Google tokeninfo`);
  }
});

test('decodes and applies a Google Meet participant join event', () => {
  const store = createLiveStore();
  const session = store.upsert({ id: 's1', meetingId: 'conferenceRecords/c1', scheduledStart: '2026-10-13T09:00:00Z', participants: [] });
  const event = { type: 'google.workspace.meet.participant.v2.joined', participantSession: { displayName: 'Thomas Durand', email: 'thomas@holbertonstudents.com', startTime: '2026-10-13T09:14:00Z' } };
  const decoded = decodeWorkspaceEvent({ message: { data: Buffer.from(JSON.stringify(event)).toString('base64') } });
  applyMeetEvent(session, decoded);
  assert.equal(session.participants[0].status, 'late');
  assert.equal(session.participants[0].lateMinutes, 14);
});

test('keeps an on-time participant on-time after a disconnect and reconnect with matching email', () => {
  const session = { scheduledStart: '2026-10-13T09:00:00Z', participants: [] };
  applyMeetEvent(session, { type: 'google.workspace.meet.participant.v2.joined', participantSession: { displayName: 'Thomas Durand', email: 'thomas@holbertonstudents.com', startTime: '2026-10-13T09:01:00Z' } });
  applyMeetEvent(session, { type: 'google.workspace.meet.participant.v2.left', eventTime: '2026-10-13T09:20:00Z', participantSession: { displayName: 'Thomas Durand', email: 'thomas@holbertonstudents.com', endTime: '2026-10-13T09:20:00Z' } });
  applyMeetEvent(session, { type: 'google.workspace.meet.participant.v2.joined', participantSession: { displayName: 'Thomas Durand', email: 'thomas@holbertonstudents.com', startTime: '2026-10-13T09:25:00Z' } });
  assert.equal(session.participants.length, 1);
  assert.equal(session.participants[0].status, 'on-time');
  assert.equal(session.participants[0].lateMinutes, 0);
  assert.equal(session.participants[0].joinedAt, '2026-10-13T09:01:00Z');
});

test('does not infer absence from an endedAt value without server-verified complete collection', () => {
  const statuses = getParticipantStatuses({ endedAt: '2026-10-13T10:00:00Z', expectedParticipants: [{ email: 'absent@holbertonschool.com', displayName: 'Absent Person' }], participants: [] });
  assert.deepEqual(statuses, [{ name: 'Absent Person', email: 'absent@holbertonschool.com', status: 'identity-to-check', lateMinutes: 0 }]);
});

test('keeps an invited participant pending while the conference is active', () => {
  const statuses = getParticipantStatuses({ expectedParticipants: [{ email: 'pending@holbertonschool.com', displayName: 'Pending Person' }], participants: [] });
  assert.deepEqual(statuses, [{ name: 'Pending Person', email: 'pending@holbertonschool.com', status: 'identity-to-check', lateMinutes: 0 }]);
});

test('closes an active session only when Meet reports the conference ended', () => {
  const session = { participants: [], expectedParticipants: [] };
  applyMeetEvent(session, { type: 'google.workspace.meet.conference.v2.ended', eventTime: '2026-10-13T10:00:00Z' });
  assert.equal(session.endedAt, '2026-10-13T10:00:00Z');
});

test('updates a live session from a participant snapshot', () => {
  const session = { scheduledStart: '2026-10-13T09:00:00Z', participants: [] };
  applyParticipantSnapshot(session, [{ email: 'ada@holbertonschool.com', name: 'Ada Lovelace', joinedAt: '2026-10-13T09:05:00Z' }]);
  assert.deepEqual(session.participants[0], {
    email: 'ada@holbertonschool.com',
    name: 'Ada Lovelace',
    joinedAt: '2026-10-13T09:05:00Z',
    leftAt: null,
    status: 'late',
    lateMinutes: 5,
  });
});

test('merges reconnect snapshots without creating a late or duplicate participant', () => {
  const session = { scheduledStart: '2026-10-13T09:00:00Z', participants: [] };
  applyParticipantSnapshot(session, [
    { email: 'ada@holbertonschool.com', name: 'Ada Lovelace', joinedAt: '2026-10-13T09:01:00Z', leftAt: '2026-10-13T09:20:00Z' },
    { email: 'ada@HOLBERTONSCHOOL.COM', name: 'Ada Lovelace', joinedAt: '2026-10-13T09:25:00Z', leftAt: '2026-10-13T09:40:00Z' },
  ]);
  assert.equal(session.participants.length, 1);
  assert.equal(session.participants[0].status, 'on-time');
  assert.equal(session.participants[0].lateMinutes, 0);
  assert.equal(session.participants[0].joinedAt, '2026-10-13T09:01:00Z');
  assert.equal(session.participants[0].leftAt, '2026-10-13T09:40:00Z');
});

test('backend participant merge is invariant to row order and never bridges by name', () => {
  const rows = [
    { name: 'Zoé Durand', email: 'student@holbertonstudents.com', joinedAt: '2026-10-13T09:02:00Z' },
    { name: 'Alice Martin', email: 'student@HOLBERTONSTUDENTS.COM', joinedAt: '2026-10-13T09:01:00Z' },
    { name: 'Alice Martin', email: 'other@holbertonstudents.com', joinedAt: '2026-10-13T09:03:00Z' },
    { name: 'Alice Martin', email: null, joinedAt: '2026-10-13T09:04:00Z' },
  ];
  const permutations = (items) => items.length === 0
    ? [[]]
    : items.flatMap((item, index) => permutations(items.filter((_, itemIndex) => itemIndex !== index)).map((rest) => [item, ...rest]));
  const results = permutations(rows).map((participants) => {
    const session = { scheduledStart: '2026-10-13T09:00:00Z', participants: [] };
    applyParticipantSnapshot(session, participants);
    return getParticipantStatuses(session);
  });

  for (const result of results.slice(1)) assert.deepEqual(result, results[0]);
  assert.equal(results[0].length, 3, 'only identical full emails may merge');
  const student = results[0].find((participant) => participant.email === 'student@holbertonstudents.com');
  assert.equal(student.name, 'Alice Martin', 'conflicting display names resolve deterministically');
  assert.equal(student.joinedAt, '2026-10-13T09:01:00Z');
  assert.equal(results[0].filter((participant) => participant.email && participant.name === 'Alice Martin').length, 2,
    'a shared name does not bridge distinct emails');
  assert.equal(results[0].find((participant) => !participant.email).status, 'identity-to-check');
});

test('Meet event name selection is invariant to event order for one full email', () => {
  const events = [
    { type: 'google.workspace.meet.participant.v2.joined', participantSession: { displayName: 'Zoé Durand', email: 'student@holbertonstudents.com', startTime: '2026-10-13T09:02:00Z' } },
    { type: 'google.workspace.meet.participant.v2.joined', participantSession: { displayName: 'Alice Martin', email: 'student@HOLBERTONSTUDENTS.COM', startTime: '2026-10-13T09:01:00Z' } },
  ];
  const run = (orderedEvents) => {
    const session = { scheduledStart: '2026-10-13T09:00:00Z', participants: [] };
    for (const event of orderedEvents) applyMeetEvent(session, event);
    return getParticipantStatuses(session);
  };

  assert.deepEqual(run(events), run(events.slice().reverse()));
  assert.equal(run(events)[0].name, 'Alice Martin');
  assert.equal(run(events)[0].joinedAt, '2026-10-13T09:01:00Z');
});

test('does not merge distinct full emails that share a display name', () => {
  const session = {
    scheduledStart: '2026-10-13T09:45:00Z',
    expectedParticipants: [
      { email: '14000@holbertonstudents.com', displayName: 'Pierre Cardin' },
      { email: 'pierre.cardin@holbertonstudents.com', displayName: 'Pierre Cardin' },
    ],
    participants: [],
  };
  applyParticipantSnapshot(session, [
    { email: '14000@holbertonstudents.com', name: 'Pierre Cardin', joinedAt: '2026-10-13T09:46:00Z' },
    { email: 'pierre.cardin@holbertonstudents.com', name: 'Pierre Cardin', joinedAt: '2026-10-13T10:01:00Z' },
  ]);
  const statuses = getParticipantStatuses(session);
  assert.equal(statuses.length, 2);
  assert.deepEqual(statuses.map(({ email }) => email).sort(), ['14000@holbertonstudents.com', 'pierre.cardin@holbertonstudents.com']);
  assert.equal(statuses.find(({ email }) => email === '14000@holbertonstudents.com').status, 'on-time');
  assert.equal(statuses.find(({ email }) => email === 'pierre.cardin@holbertonstudents.com').status, 'late');
});

test('keeps distinct email identities across live events even when names match', () => {
  const session = { scheduledStart: '2026-10-13T09:45:00Z', participants: [] };
  applyMeetEvent(session, {
    type: 'google.workspace.meet.participant.v2.joined',
    participantSession: { email: '14000@holbertonstudents.com', displayName: 'Pierre Cardin', startTime: '2026-10-13T09:46:00Z' },
  });
  applyMeetEvent(session, {
    type: 'google.workspace.meet.participant.v2.joined',
    participantSession: { email: 'pierre.cardin@holbertonstudents.com', displayName: 'Pierre Cardin', startTime: '2026-10-13T09:47:00Z' },
  });
  assert.equal(session.participants.length, 2);
  assert.equal(session.participants.find(({ email }) => email === '14000@holbertonstudents.com').joinedAt, '2026-10-13T09:46:00Z');
  assert.equal(session.participants.find(({ email }) => email === '14000@holbertonstudents.com').status, 'on-time');
  assert.equal(session.participants.find(({ email }) => email === 'pierre.cardin@holbertonstudents.com').joinedAt, '2026-10-13T09:47:00Z');
});

test('does not infer a shared identity from numbered nominative email aliases', () => {
  const session = { scheduledStart: '2026-10-13T09:45:00Z', participants: [] };
  applyMeetEvent(session, {
    type: 'google.workspace.meet.participant.v2.joined',
    participantSession: { email: 'benjamin.dereuck@holbertonstudents.com', displayName: 'Benjamin Dereuck', startTime: '2026-10-13T09:46:00Z' },
  });
  applyMeetEvent(session, {
    type: 'google.workspace.meet.participant.v2.joined',
    participantSession: { email: 'benjamin.dereuck.1@holbertonstudents.com', displayName: 'benjamin.dereuck.1@holbertonstudents.com', startTime: '2026-10-13T09:47:00Z' },
  });
  assert.equal(session.participants.length, 2);
  assert.equal(session.participants.find(({ email }) => email === 'benjamin.dereuck@holbertonstudents.com').joinedAt, '2026-10-13T09:46:00Z');
  assert.equal(session.participants.find(({ email }) => email === 'benjamin.dereuck@holbertonstudents.com').status, 'on-time');
  assert.equal(session.participants.find(({ email }) => email === 'benjamin.dereuck.1@holbertonstudents.com').joinedAt, '2026-10-13T09:47:00Z');
});
