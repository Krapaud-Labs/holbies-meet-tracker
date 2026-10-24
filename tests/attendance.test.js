const assert = require('node:assert/strict');
const { calculateAttendance, getSessionWindow, getAttendanceIdentityKey, getAttendanceIdentityKeys, mergeAttendanceRows } = require('../attendance.js');

const eventStart = '2026-10-13T09:00:00.000Z';

assert.deepEqual(getSessionWindow([
  { startTime: '2026-10-13T09:04:00.000Z', endTime: '2026-10-13T09:20:00.000Z' },
  { startTime: '2026-10-13T09:25:00.000Z', endTime: '2026-10-13T09:50:00.000Z' },
]), {
  firstJoin: Date.parse('2026-10-13T09:04:00.000Z'),
  lastLeave: Date.parse('2026-10-13T09:50:00.000Z'),
});

assert.equal(getAttendanceIdentityKey({ name: 'Pierre Cardin', email: '14000@holbertonstudents.com' }), 'email:14000@holbertonstudents.com');
assert.equal(getAttendanceIdentityKey({ name: '14000@holbertonstudents.com', email: '14000@holbertonstudents.com' }), 'email:14000@holbertonstudents.com');
const conflictingIdentityRows = [
  { name: 'Pierre Cardin', email: 'pierre.cardin@holbertonstudents.com', status: 'absent' },
  { name: 'Pierre Cardin', email: '14000@holbertonstudents.com', status: 'on-time' },
];
const canonicalConflictingRows = (rows) => mergeAttendanceRows(rows).map(({ email, status }) => ({ email, status })).sort((left, right) => left.email.localeCompare(right.email));
assert.deepEqual(canonicalConflictingRows(conflictingIdentityRows), canonicalConflictingRows([...conflictingIdentityRows].reverse()));
assert.deepEqual(canonicalConflictingRows(conflictingIdentityRows), [
  { email: '14000@holbertonstudents.com', status: 'on-time' },
  { email: 'pierre.cardin@holbertonstudents.com', status: 'absent' },
]);
assert.notDeepEqual(getAttendanceIdentityKeys({ name: 'Pierre Cardin', email: 'pierre.cardin@holbertonstudents.com' }), getAttendanceIdentityKeys({ name: 'Pierre Cardin', email: '14000@holbertonstudents.com' }));
assert.deepEqual(getAttendanceIdentityKeys({ name: 'Pierre Cardin' }), []);
assert.equal(getAttendanceIdentityKey({ email: ' Ada@EXAMPLE.COM ' }), 'email:Ada@example.com');
assert.equal(getAttendanceIdentityKey({ email: 'e\u0301tudiant@EXAMPLE.COM' }), 'email:étudiant@example.com');
assert.notEqual(getAttendanceIdentityKey({ email: 'Ada@example.com' }), getAttendanceIdentityKey({ email: 'ada@example.com' }));
assert.equal(mergeAttendanceRows([
  { name: 'Ada Lovelace', email: 'Ada@EXAMPLE.COM', status: 'waiting' },
  { name: 'Ada', email: 'Ada@example.com', status: 'on-time' },
]).length, 1);
const duplicateAliasRows = mergeAttendanceRows([
  { name: 'Pierre Cardin', email: 'pierre.cardin@holbertonstudents.com', status: 'en attente' },
  { name: 'PIERRE CARDIN', email: '14000@holbertonstudents.com', status: 'à l’heure' },
]);
assert.equal(duplicateAliasRows.length, 2);
const numberedEmailAliasRows = mergeAttendanceRows([
  { name: 'Benjamin Dereuck', email: 'benjamin.dereuck@holbertonstudents.com', status: 'on-time' },
  { name: 'benjamin.dereuck.1@holbertonstudents.com', email: 'benjamin.dereuck.1@holbertonstudents.com', status: 'absent' },
]);
assert.equal(numberedEmailAliasRows.length, 2);
assert.deepEqual(numberedEmailAliasRows.map(({ email, status }) => ({ email, status })).sort((left, right) => left.email.localeCompare(right.email)), [
  { email: 'benjamin.dereuck.1@holbertonstudents.com', status: 'absent' },
  { email: 'benjamin.dereuck@holbertonstudents.com', status: 'on-time' },
]);

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Ada', email: 'ada@holbertonstudents.com' } } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).status, 'on-time');
assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Ada', email: 'ada@holbertonstudents.com' } } }, [
  { startTime: '2026-10-13T09:01:59.000Z' },
], eventStart).status, 'on-time');
assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Ada', email: 'ada@holbertonstudents.com' } } }, [
  { startTime: '2026-10-13T09:02:00.000Z' },
], eventStart).status, 'late');

assert.deepEqual(calculateAttendance({ signedinUser: { displayName: 'Mickael Mur', email: 'mickael@holbertonstudents.com' } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart), {
  name: 'Mickael Mur',
  email: 'mickael@holbertonstudents.com',
  identifiable: true,
  status: 'on-time',
  firstJoin: Date.parse('2026-10-13T09:01:00.000Z'),
  lastLeave: null,
});

assert.equal(calculateAttendance({ anonymousUser: { displayName: 'Visiteur Meet' } }, [
  { startTime: '2026-10-13T09:01:00.000Z' },
], eventStart).name, 'Visiteur Meet');

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Grace', email: 'grace@holbertonstudents.com' } } }, [
  { startTime: '2026-10-13T09:05:00.000Z', endTime: '2026-10-13T09:40:00.000Z' },
], eventStart).status, 'late');

assert.equal(calculateAttendance({ user: { signedinUser: { displayName: 'Linus' } } }, [], eventStart).status, 'identity-to-check');
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
