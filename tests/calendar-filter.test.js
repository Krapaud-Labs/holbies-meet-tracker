import assert from 'node:assert/strict';
import test from 'node:test';
import calendarFilter from '../calendar-filter.js';

const { filterVisibleAgendaEvents, getEventStatus, isEventOnDay, isVisibleAgendaEvent } = calendarFilter;

const now = Date.parse('2026-10-14T12:00:00Z');

test('keeps current and future events', () => {
  assert.equal(isVisibleAgendaEvent({ start: { dateTime: '2026-10-14T11:00:00Z' }, end: { dateTime: '2026-10-14T12:00:00Z' } }, now), true);
  assert.equal(isVisibleAgendaEvent({ start: { dateTime: '2026-10-14T13:00:00Z' }, end: { dateTime: '2026-10-14T14:00:00Z' } }, now), true);
});

test('keeps every event starting on the current day, including past events', () => {
  assert.equal(isEventOnDay({ start: { dateTime: '2026-10-14T08:00:00Z' } }, now), true);
  assert.equal(isVisibleAgendaEvent({ start: { dateTime: '2026-10-14T08:00:00Z' }, end: { dateTime: '2026-10-14T09:00:00Z' } }, now), true);
  assert.equal(isVisibleAgendaEvent({ start: { dateTime: '2026-10-13T10:00:00Z' }, end: { dateTime: '2026-10-13T11:00:00Z' } }, now), false);
});

test('removes events from another day instead of using an elapsed-hour cutoff', () => {
  const events = [
    { id: 'recent', start: { dateTime: '2026-10-14T10:00:00Z' }, end: { dateTime: '2026-10-14T11:00:00Z' } },
    { id: 'old', start: { dateTime: '2026-10-14T08:00:00Z' }, end: { dateTime: '2026-10-14T08:30:00Z' } },
    { id: 'yesterday', start: { dateTime: '2026-10-13T10:00:00Z' }, end: { dateTime: '2026-10-13T11:00:00Z' } },
  ];
  assert.deepEqual(filterVisibleAgendaEvents(events, now).map(({ id }) => id), ['old', 'recent']);
});

test('calculates the event status from the current time', () => {
  assert.equal(getEventStatus({ start: { dateTime: '2026-10-14T08:00:00Z' }, end: { dateTime: '2026-10-14T09:00:00Z' } }, now), 'Terminé');
  assert.equal(getEventStatus({ start: { dateTime: '2026-10-14T11:30:00Z' }, end: { dateTime: '2026-10-14T12:30:00Z' } }, now), 'En cours');
  assert.equal(getEventStatus({ start: { dateTime: '2026-10-14T13:00:00Z' }, end: { dateTime: '2026-10-14T14:00:00Z' } }, now), 'Bientôt');
});

test('sorts visible events by chronological start time', () => {
  const events = [
    { id: 'later', start: { dateTime: '2026-10-14T13:00:00Z' }, end: { dateTime: '2026-10-14T14:00:00Z' } },
    { id: 'earlier', start: { dateTime: '2026-10-14T12:30:00Z' }, end: { dateTime: '2026-10-14T13:00:00Z' } },
  ];
  assert.deepEqual(filterVisibleAgendaEvents(events, now).map(({ id }) => id), ['earlier', 'later']);
});
