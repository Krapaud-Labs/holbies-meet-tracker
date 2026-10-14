import assert from 'node:assert/strict';
import test from 'node:test';
import calendarFilter from '../calendar-filter.js';

const { filterVisibleAgendaEvents, isVisibleAgendaEvent } = calendarFilter;

const now = Date.parse('2026-10-14T12:00:00Z');

test('keeps current and future events', () => {
  assert.equal(isVisibleAgendaEvent({ end: { dateTime: '2026-10-14T12:00:00Z' } }, now), true);
  assert.equal(isVisibleAgendaEvent({ end: { dateTime: '2026-10-14T13:00:00Z' } }, now), true);
});

test('keeps an event for one hour after it ends', () => {
  assert.equal(isVisibleAgendaEvent({ end: { dateTime: '2026-10-14T11:00:01Z' } }, now), true);
  assert.equal(isVisibleAgendaEvent({ end: { dateTime: '2026-10-14T11:00:00Z' } }, now), true);
});

test('removes events ended more than one hour ago', () => {
  const events = [
    { id: 'recent', end: { dateTime: '2026-10-14T11:00:00Z' } },
    { id: 'old', end: { dateTime: '2026-10-14T10:59:59Z' } },
  ];
  assert.deepEqual(filterVisibleAgendaEvents(events, now).map(({ id }) => id), ['recent']);
});

test('sorts visible events by chronological start time', () => {
  const events = [
    { id: 'later', start: { dateTime: '2026-10-14T13:00:00Z' }, end: { dateTime: '2026-10-14T14:00:00Z' } },
    { id: 'earlier', start: { dateTime: '2026-10-14T12:30:00Z' }, end: { dateTime: '2026-10-14T13:00:00Z' } },
  ];
  assert.deepEqual(filterVisibleAgendaEvents(events, now).map(({ id }) => id), ['earlier', 'later']);
});
