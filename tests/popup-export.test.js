const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popupSource = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

function response(status, payload, options = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (options.invalidJson) throw new SyntaxError('invalid-json');
      return payload;
    },
    async text() { return options.text || ''; },
  };
}

function createHarness({ fetchImpl, authImpl } = {}) {
  const elements = new Map();
  const downloads = [];
  const calls = [];
  const timerDelays = [];
  const makeElement = () => ({
    hidden: false,
    disabled: false,
    checked: false,
    textContent: '',
    innerHTML: '',
    value: '',
    href: '',
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) {
      this.listeners ||= {};
      this.listeners[name] = callback;
    },
    removeEventListener() {},
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    append() {},
    appendChild() {},
    replaceChildren() {},
    contains() { return false; },
    focus() {},
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; },
  });
  const getElement = (key) => {
    if (!elements.has(key)) elements.set(key, makeElement());
    return elements.get(key);
  };
  const document = {
    querySelector: getElement,
    querySelectorAll: () => [],
    createElement: () => makeElement(),
    addEventListener() {},
    removeEventListener() {},
    body: makeElement(),
    documentElement: makeElement(),
  };
  const defaultFetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('sheets.googleapis.com/v4/spreadsheets/')) return response(200, {});
    if (String(url).includes('sheets.googleapis.com/v4/spreadsheets')) return response(200, { spreadsheetId: 'sheet-1', sheets: [{ properties: { title: 'Sheet1' } }] });
    if (String(url).includes('/drive/v3/files?q=')) return response(200, { files: [{ id: 'folder-1' }] });
    if (String(url).includes('/drive/v3/files/sheet-1?fields=id,parents')) return response(200, { id: 'sheet-1', parents: ['root'] });
    if (String(url).includes('/drive/v3/files/sheet-1?')) return response(200, { id: 'sheet-1', parents: ['folder-1'] });
    return response(500, {}, { text: 'unexpected request' });
  };
  const context = vm.createContext({
    console,
    document,
    URL,
    URLSearchParams,
    Blob,
    Date,
    TextEncoder,
    fetch: async (url, options) => (fetchImpl || defaultFetch)(url, options, calls),
    chrome: {
      identity: { getAuthToken: authImpl || (async ({ interactive }) => {
        if (interactive) return 'sheets-token';
        throw new Error('no-cached-token');
      }) },
      runtime: { getManifest: () => ({ oauth2: { scopes: ['openid'] } }) },
      storage: { local: { get: async () => ({}) } },
      downloads: { download: (item) => downloads.push(item) },
      tabs: { create: async () => {} },
    },
    setTimeout(callback, delay) {
      timerDelays.push(delay);
      if (delay === 750) return setImmediate(callback);
      return { unref() {} };
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  });
  vm.runInContext(popupSource, context, { filename: 'popup.js' });
  return { context, elements, calls, downloads, timerDelays };
}

function setExportState(context, { token = 'calendar-token', rows = [{ firstName: 'Ada', lastName: 'Lovelace', date: '19/02/1970', meeting: 'Check-in', arrival: '09:00', departure: '09:30', status: 'à l’heure' }], consent = true } = {}) {
  vm.runInContext(`currentAccessToken = ${JSON.stringify(token)}; currentAttendanceRows = ${JSON.stringify(rows)}; exportConsent.checked = ${consent};`, context);
}

test('export Sheets success follows the manual as-built flow and writes the seven columns', async () => {
  const h = createHarness();
  setExportState(h.context);
  await vm.runInContext('exportAttendanceToSheets()', h.context);

  assert.deepEqual(h.calls.map(({ options }) => options.method || 'GET'), ['POST', 'GET', 'GET', 'PATCH', 'PUT']);
  assert.match(h.calls[0].url, /sheets\.googleapis\.com\/v4\/spreadsheets$/);
  assert.match(h.calls[1].url, /drive\/v3\/files\?q=/);
  assert.match(h.calls[3].url, /addParents=folder-1/);
  const body = JSON.parse(h.calls[4].options.body);
  assert.equal(body.range, 'Sheet1!A1:G2');
  assert.deepEqual(body.values[0], ['Prénom', 'Nom', 'Date', 'Réunion', 'Arrivée', 'Départ', 'Statut']);
  assert.deepEqual(body.values[1], ['Ada', 'Lovelace', '19/02/1970', 'Check-in', '09:00', '09:30', 'à l’heure']);
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer sheets-token');
  assert.equal(h.elements.get('#attendance-status').dataset.state, 'success');
  assert.equal(h.elements.get('#export-button')['aria-busy'], 'false');
});

test('Sheets export guard sends no requests without current token, rows, or consent', async (t) => {
  for (const state of [
    { token: '', rows: undefined, consent: true },
    { token: 'token', rows: [], consent: true },
    { token: 'token', rows: undefined, consent: false },
  ]) {
    await t.test(JSON.stringify(state), async () => {
      const h = createHarness();
      setExportState(h.context, state);
      await vm.runInContext('exportAttendanceToSheets()', h.context);
      assert.equal(h.calls.length, 0);
    });
  }
});

test('CSV fallback quotes fields, doubles quotes, includes BOM and uses saveAs', () => {
  const h = createHarness();
  setExportState(h.context, { rows: [{ firstName: 'Ada', lastName: '"Countess"', date: '19/02/1970', meeting: 'Check-in;\nevening', arrival: null, departure: undefined, status: 'à l’heure' }] });
  vm.runInContext('downloadLocalCsv()', h.context);
  assert.equal(h.downloads.length, 1);
  const download = h.downloads[0];
  assert.equal(download.saveAs, true);
  assert.match(download.filename, /^holbies-meet-presences-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = decodeURIComponent(download.url.split(',')[1]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Prénom";"Nom";"Date";"Réunion";"Arrivée";"Départ";"Statut"/);
  assert.match(csv, /"Ada";"""Countess""";"19\/02\/1970";"Check-in;\nevening";"";"";"à l’heure"/);
});

test('retry performs at most two attempts separated by 750ms, including HTTP failures', async () => {
  let spreadsheetAttempts = 0;
  const h = createHarness({ fetchImpl: async (url, options, calls) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('sheets.googleapis.com/v4/spreadsheets') && !String(url).includes('/values/')) {
      spreadsheetAttempts += 1;
      if (spreadsheetAttempts === 1) return response(503, {}, { text: 'temporary' });
      return response(200, { spreadsheetId: 'sheet-1', sheets: [{ properties: { title: 'Sheet1' } }] });
    }
    return response(200, String(url).includes('/values/') ? {} : String(url).includes('drive/v3/files?q=') ? { files: [{ id: 'folder-1' }] } : { id: 'sheet-1', parents: ['root'] });
  } });
  setExportState(h.context);
  await vm.runInContext('exportAttendanceToSheets()', h.context);
  assert.equal(spreadsheetAttempts, 2);
  assert.ok(h.timerDelays.includes(750));
  assert.equal(h.elements.get('#attendance-status').dataset.state, 'success');
});

test('characterizes the Bearer header sent when the current OAuth session has no token', async () => {
  const observedHeaders = [];
  const h = createHarness({
    authImpl: async ({ interactive }) => interactive ? {} : Promise.reject(new Error('no-cached-token')),
    fetchImpl: async (url, options, calls) => {
      calls.push({ url: String(url), options });
      observedHeaders.push(options.headers?.Authorization);
      if (options.headers?.Authorization === 'Bearer undefined') return response(401, {}, { text: 'invalid token' });
      return response(200, {});
    },
  });
  setExportState(h.context);
  await vm.runInContext('exportAttendanceToSheets()', h.context);
  assert.deepEqual(observedHeaders, ['Bearer undefined', 'Bearer undefined']);
  assert.equal(h.elements.get('#attendance-status').dataset.state, 'unavailable');
  assert.equal(h.elements.get('#local-export-button').hidden, false);
});

test('failed HTTP or network attempts stop after two tries and expose fallback', async (t) => {
  for (const kind of ['HTTP failure', 'network failure']) {
    await t.test(kind, async () => {
      let attempts = 0;
      const h = createHarness({ fetchImpl: async (url, options, calls) => {
        calls.push({ url: String(url), options });
        attempts += 1;
        if (kind === 'network failure') throw new Error('network-down');
        return response(503, {}, { text: 'temporary' });
      } });
      setExportState(h.context);
      await vm.runInContext('exportAttendanceToSheets()', h.context);
      assert.equal(attempts, 2);
      assert.equal(h.timerDelays.filter((delay) => delay === 750).length, 1);
      assert.equal(h.elements.get('#attendance-status').dataset.state, 'unavailable');
      assert.equal(h.elements.get('#local-export-button').hidden, false);
    });
  }
});

test('OAuth rejection and Sheets or Drive failures expose the local fallback and clear busy state', async (t) => {
  const cases = [
    ['OAuth rejection', async () => createHarness({ authImpl: async () => { throw new Error('auth-denied'); } })],
    ['spreadsheet HTTP failure', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); return String(url).includes('sheets.googleapis.com/v4/spreadsheets') ? response(500, {}, { text: 'failure' }) : response(200, {}); } })],
    ['spreadsheet JSON failure', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); return String(url).includes('sheets.googleapis.com/v4/spreadsheets') ? response(200, {}, { invalidJson: true }) : response(200, {}); } })],
    ['spreadsheet ID missing', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); return String(url).includes('sheets.googleapis.com/v4/spreadsheets') ? response(200, {}) : response(200, {}); } })],
    ['Drive folder lookup failure', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); return String(url).includes('/drive/v3/files?q=') ? response(500, {}, { text: 'failure' }) : response(200, String(url).includes('spreadsheets') ? { spreadsheetId: 'sheet-1' } : {}); } })],
    ['Drive folder create missing ID', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); if (String(url).includes('/drive/v3/files?q=')) return response(200, { files: [] }); if (String(url).includes('/drive/v3/files?fields=id,name')) return response(200, {}); return response(200, { spreadsheetId: 'sheet-1' }); } })],
    ['Drive metadata failure', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); if (String(url).includes('fields=id,parents')) return response(500, {}, { text: 'failure' }); return response(200, String(url).includes('spreadsheets') ? { spreadsheetId: 'sheet-1' } : { files: [{ id: 'folder-1' }] }); } })],
    ['Drive move failure', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); if (options.method === 'PATCH') return response(500, {}, { text: 'failure' }); return response(200, String(url).includes('spreadsheets') ? { spreadsheetId: 'sheet-1' } : String(url).includes('/files?q=') ? { files: [{ id: 'folder-1' }] } : { parents: ['root'] }); } })],
    ['Sheets value update failure', async () => createHarness({ fetchImpl: async (url, options, calls) => { calls.push({ url: String(url), options }); if (String(url).includes('/values/')) return response(500, {}, { text: 'failure' }); return response(200, String(url).includes('spreadsheets') ? { spreadsheetId: 'sheet-1' } : String(url).includes('/files?q=') ? { files: [{ id: 'folder-1' }] } : { parents: ['root'] }); } })],
  ];
  for (const [name, makeHarness] of cases) {
    await t.test(name, async () => {
      const h = await makeHarness();
      setExportState(h.context);
      await vm.runInContext('exportAttendanceToSheets()', h.context);
      assert.equal(h.elements.get('#attendance-status').dataset.state, 'unavailable');
      assert.match(h.elements.get('#attendance-status').textContent, /Export Google Sheets impossible/);
      assert.equal(h.elements.get('#local-export-button').hidden, false);
      assert.equal(h.elements.get('#export-button')['aria-busy'], 'false');
      if (name === 'spreadsheet HTTP failure') {
        h.elements.get('#local-export-button').listeners.click();
        assert.equal(h.downloads.length, 1);
        assert.equal(h.downloads[0].saveAs, true);
      }
    });
  }
});
