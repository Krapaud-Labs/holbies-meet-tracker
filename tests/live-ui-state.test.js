const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const popup = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

assert.match(popup, /function clearAttendanceRows\(\)/);
assert.match(popup, /summaryOnTime\.textContent = '0'/);
assert.match(popup, /summaryLate\.textContent = '0'/);
assert.match(popup, /summaryAbsent\.textContent = '0'/);
assert.match(popup, /summaryWaiting\.textContent = '0'/);
assert.match(popup, /participantList\.replaceChildren\(\)/);
assert.match(popup, /renderAttendanceRows\(rows\);/);
assert.doesNotMatch(popup, /if \(rows\.length\) renderAttendanceRows\(rows\);/);
assert.match(popup, /setCalendarState\('empty', 'Aucun événement prévu aujourd’hui\.'\)/);
assert.match(popup, /calendarEvents = \[\];\s+eventList\.replaceChildren\(\);/);

console.log('live UI state contracts passed');
