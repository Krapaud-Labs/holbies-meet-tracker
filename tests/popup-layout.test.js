const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');

// The Chrome extension popup must not collapse to a narrow intrinsic width.
assert.match(css, /html\s*,\s*body\s*\{[\s\S]*?width:\s*720px\s*;/,
  'document must define an explicit desktop popup width');
assert.match(css, /html\s*,\s*body\s*\{[\s\S]*?min-width:\s*720px\s*;/,
  'document must keep the Chrome popup from collapsing below the desktop width');
assert.match(css, /\.popup-shell\s*\{[\s\S]*?width:\s*100%\s*;/,
  'popup shell must fill the explicit document width');
assert.match(css, /@media\s*\(max-width:\s*719px\)[\s\S]*?html\s*\{[\s\S]*?width:\s*720px\s*;/,
  'Chrome popup width must remain fixed when the browser reports a narrow viewport');

// Responsive behavior remains explicit: cards stack at the compact breakpoint.
assert.match(
  css,
  /@media\s*\(max-width:\s*680px\)[\s\S]*?\.dashboard-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*;/,
  'dashboard cards must stack on compact viewports'
);

// Horizontal overflow must be clipped at the document boundary, while the
// agenda list keeps its intended vertical scrolling behavior.
assert.match(css, /html\s*,\s*body\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/);
assert.match(css, /\.event-list\s*\{[\s\S]*?overflow-y:\s*auto\s*;/);

// The three functional regions must remain present and independently labelled.
for (const id of ['setup-title', 'calendar-title', 'attendance-title']) {
  assert.match(html, new RegExp(`aria-labelledby="${id}"`));
}

console.log('popup layout contracts passed');
