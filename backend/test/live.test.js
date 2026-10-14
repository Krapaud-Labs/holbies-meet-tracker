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
  const result = calculateStatus('2026-10-13T09:02:00Z', '2026-10-13T09:00:00Z');
  assert.deepEqual(result, { status: 'on-time', lateMinutes: 0 });
});

test('renders a safe HTML report with late participants highlighted', () => {
  const html = renderReportHtml({ mentorEmail: 'mentor@holbertonschool.com', participants: [{ name: '<Alice>', status: 'late', lateMinutes: 8 }] });
  assert.match(html, /&lt;Alice&gt;/);
  assert.match(html, /class="late"/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /color-scheme/);
  assert.doesNotMatch(html, /<Alice>/);
});

test('accepts only a verified Google token from the allowed domain', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ email: 'mentor@holbertonschool.com', sub: 'subject-1' }) });
  assert.deepEqual(await verifyGoogleAccessToken('a-valid-token-with-enough-length', fetchImpl), { email: 'mentor@holbertonschool.com', subject: 'subject-1' });
});

test('decodes and applies a Google Meet participant join event', () => {
  const store = createLiveStore();
  const session = store.upsert({ id: 's1', meetingId: 'conferenceRecords/c1', scheduledStart: '2026-10-13T09:00:00Z', participants: [] });
  const event = { type: 'google.workspace.meet.participant.v2.joined', participantSession: { displayName: 'Thomas Durand', startTime: '2026-10-13T09:14:00Z' } };
  const decoded = decodeWorkspaceEvent({ message: { data: Buffer.from(JSON.stringify(event)).toString('base64') } });
  applyMeetEvent(session, decoded);
  assert.equal(session.participants[0].status, 'late');
  assert.equal(session.participants[0].lateMinutes, 14);
});

test('marks expected participants who have not joined as absent', () => {
  const statuses = getParticipantStatuses({ expectedParticipants: [{ email: 'absent@holbertonschool.com', displayName: 'Absent Person' }], participants: [] });
  assert.deepEqual(statuses, [{ name: 'Absent Person', email: 'absent@holbertonschool.com', status: 'absent', lateMinutes: 0 }]);
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
