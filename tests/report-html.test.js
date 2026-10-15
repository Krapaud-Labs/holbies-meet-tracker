const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const popup = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

assert.match(popup, /data-column-toggle="participant" checked/);
assert.match(popup, /data-column-toggle="email" checked/);
assert.match(popup, /data-column-toggle="status" checked/);
assert.match(popup, /data-column-toggle="arrival" checked/);
assert.match(popup, /classList\.toggle\('column-hidden',!control\.checked\)/);
assert.match(popup, /data-column="participant"/);
assert.match(popup, /data-column="email"/);
assert.match(popup, /data-column="status"/);
assert.match(popup, /data-column="arrival"/);

console.log('report HTML column filters are wired');
