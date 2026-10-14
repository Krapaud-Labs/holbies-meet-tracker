import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedParticipants, extractMeetingCode, getMeetingCode, isTrackableEvent } from '../background.js';

test('extracts a Meet code from calendar conferencing data', () => {
  assert.equal(extractMeetingCode('https://meet.google.com/abc-mnop-xyz'), 'abc-mnop-xyz');
  assert.equal(getMeetingCode({ conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/qrs-tuvw-123' }] } }), 'qrs-tuvw-123');
});

test('tracks only events in the active monitoring window', () => {
  const now = Date.parse('2026-10-14T10:00:00Z');
  const event = { id: 'event-1', start: { dateTime: '2026-10-14T09:55:00Z' }, end: { dateTime: '2026-10-14T11:00:00Z' }, hangoutLink: 'https://meet.google.com/abc-mnop-xyz' };
  assert.equal(isTrackableEvent(event, now), true);
  assert.equal(isTrackableEvent({ ...event, start: { dateTime: '2026-10-13T09:00:00Z' }, end: { dateTime: '2026-10-13T10:00:00Z' } }, now), false);
});

test('keeps only identifiable Agenda guests as expected participants', () => {
  assert.deepEqual(expectedParticipants({ attendees: [{ email: 'Alice@holbertonschool.com', displayName: 'Alice' }, { responseStatus: 'accepted' }] }), [{ email: 'alice@holbertonschool.com', displayName: 'Alice' }]);
});
