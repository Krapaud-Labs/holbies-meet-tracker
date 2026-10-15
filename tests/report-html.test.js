const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const popup = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

assert.match(popup, /data-sort-column="participant"/);
assert.match(popup, /data-sort-column="email"/);
assert.match(popup, /data-sort-column="status"/);
assert.match(popup, /data-sort-column="arrival"/);
assert.match(popup, /replace\('table-layout:fixed', 'table-layout:auto'\)/);
assert.match(popup, /replace\('th:nth-child\(3\)\{width:18%\}th:nth-child\(4\)\{width:18%\}', 'th:nth-child\(3\),th:nth-child\(4\)\{width:1%;white-space:nowrap\}'\)/);
assert.match(popup, /section\{[^}]*overflow-x:auto/);
assert.match(popup, /table\{[^}]*table-layout:fixed\}/);
assert.match(popup, /data-column="participant"/);
assert.match(popup, /data-column="email"/);
assert.match(popup, /data-column="status"/);
assert.match(popup, /data-column="arrival"/);
assert.match(popup, /id="print-report"/);
assert.match(popup, /window\.print\(\)/);
assert.match(popup, /@media print/);
assert.match(popup, /statusRank=\{'en retard':0,absent:1,'en attente':2,"à l'heure":3\}/);
assert.match(popup, /localeCompare\(rightValue,'fr',\{numeric:true\}\)/);
assert.match(popup, /setAttribute\('aria-sort'/);
assert.match(popup, /event\.key==='Enter'\|\|event\.key===' '/);
assert.match(popup, /Cliquez sur Participant, E-mail, Statut ou Arrivée pour trier/);
assert.match(popup, /findOrCreateSheetsFolder/);
assert.match(popup, /mimeType = 'application\/vnd\.google-apps\.folder'/);
assert.match(popup, /moveDriveFileToFolder/);
assert.match(popup, /drive\/v3\/files/);

console.log('report HTML row sorting is wired');
