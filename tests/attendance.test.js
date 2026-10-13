const assert = require('node:assert/strict');
const { calculateAttendance, getSessionWindow } = require('../attendance.js');

const eventStart = '2026-10-13T09:00:00.000Z';

assert.deepEqual(getSessionWindow([
  { startTime: '2026-10-13T09:04:00.000Z', endTime: '2026-10-13T09:20:00.000Z' },
  { startTime: '2026-10-13T09:25:00.000Z', endTime: '2026-10-13T09:50:00.000Z' },
]), {
  firstJoin: Date.parse('2026-10-13T09:04:00.000Z'),
  lastLeave: Date.parse('2026-10-13T09:50:00.000Z'),
});

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Ada' } } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).status, 'on-time');

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Grace' } } }, [
  { startTime: '2026-10-13T09:05:00.000Z', endTime: '2026-10-13T09:40:00.000Z' },
], eventStart).status, 'late');

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Linus' } } }, [], eventStart).status, 'absent');
assert.equal(calculateAttendance({ user: { anonymousUser: { displayName: 'Visiteur' } } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).status, 'identity-to-check');

console.log('attendance tests passed');
