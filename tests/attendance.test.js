const assert = require('node:assert/strict');
const { calculateAttendance, getSessionWindow, getAttendanceIdentityKey, mergeAttendanceRows } = require('../attendance.js');

const eventStart = '2026-10-13T09:00:00.000Z';

assert.deepEqual(getSessionWindow([
  { startTime: '2026-10-13T09:04:00.000Z', endTime: '2026-10-13T09:20:00.000Z' },
  { startTime: '2026-10-13T09:25:00.000Z', endTime: '2026-10-13T09:50:00.000Z' },
]), {
  firstJoin: Date.parse('2026-10-13T09:04:00.000Z'),
  lastLeave: Date.parse('2026-10-13T09:50:00.000Z'),
});

assert.equal(getAttendanceIdentityKey({ name: 'Pierre Cardin', email: '14000@holbertonstudents.com' }), 'name:pierre cardin');
assert.equal(getAttendanceIdentityKey({ name: '14000@holbertonstudents.com', email: '14000@holbertonstudents.com' }), 'student-id:14000');
assert.deepEqual(mergeAttendanceRows([
  { name: 'Pierre Cardin', email: 'pierre.cardin@holbertonstudents.com', status: 'absent' },
  { name: 'Pierre Cardin', email: '14000@holbertonstudents.com', status: 'on-time' },
]), [{ name: 'Pierre Cardin', email: '14000@holbertonstudents.com', status: 'on-time' }]);

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Ada' } } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).status, 'on-time');

assert.deepEqual(calculateAttendance({ signedinUser: { displayName: 'Mickael Mur' } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart), {
  name: 'Mickael Mur',
  identifiable: true,
  status: 'on-time',
  firstJoin: Date.parse('2026-10-13T09:01:00.000Z'),
  lastLeave: null,
});

assert.equal(calculateAttendance({ anonymousUser: { displayName: 'Visiteur Meet' } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).name, 'Visiteur Meet');

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Grace' } } }, [
  { startTime: '2026-10-13T09:05:00.000Z', endTime: '2026-10-13T09:40:00.000Z' },
], eventStart).status, 'late');

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Linus' } } }, [], eventStart).status, 'absent');
assert.equal(calculateAttendance({ user: { anonymousUser: { displayName: 'Visiteur' } } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).status, 'identity-to-check');

assert.equal(getSessionWindow(null), null);
assert.deepEqual(getSessionWindow([
  { startTime: '2026-10-13T09:00:00.000Z', endTime: 'date-invalide' },
  { startTime: 'date-invalide', endTime: '2026-10-13T09:20:00.000Z' },
]), null);

assert.deepEqual(getSessionWindow([
  { startTime: '2026-10-13T09:00:00.000Z' },
  { startTime: '2026-10-13T09:05:00.000Z', endTime: '2026-10-13T09:20:00.000Z' },
]), {
  firstJoin: Date.parse('2026-10-13T09:00:00.000Z'),
  lastLeave: null,
});

console.log('attendance tests passed');
