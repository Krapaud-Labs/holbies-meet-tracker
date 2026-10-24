const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const MeetAttendance = require('../attendance.js');
const HolbiesCalendar = require('../calendar-filter.js');

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
    MeetAttendance,
    HolbiesCalendar,
    URL,
    URLSearchParams,
    AbortController,
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
    requestAnimationFrame: (callback) => setImmediate(callback),
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  });
  vm.runInContext(popupSource, context, { filename: 'popup.js' });
  return { context, elements, calls, downloads, timerDelays };
}

function setExportState(context, { token = 'calendar-token', rows = [{ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@holbertonstudents.com', date: '19/02/1970', meeting: 'Check-in', arrival: '09:00', departure: '09:30', status: 'à l’heure' }], consent = true, collectionComplete = true } = {}) {
  vm.runInContext(`currentAccessToken = ${JSON.stringify(token)}; currentAttendanceRows = ${JSON.stringify(rows)}; currentReportFilenameDate = ${JSON.stringify(rows?.[0]?.date || '')}; currentCollectionComplete = ${collectionComplete}; exportConsent.checked = ${consent};`, context);
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
  assert.equal(body.range, 'Sheet1!A1:G5');
  assert.deepEqual(body.values[0], ['Rapport COMPLET', '', '', '', '', '', '']);
  assert.deepEqual(body.values[1], ['Identités à vérifier : 0', '', '', '', '', '', '']);
  assert.deepEqual(body.values[2], ['', '', '', '', '', '', '']);
  assert.deepEqual(body.values[3], ['Prénom', 'Nom', 'Date', 'Réunion', 'Arrivée', 'Départ', 'Statut']);
  assert.deepEqual(body.values[4], ['Ada', 'Lovelace', '19/02/1970', 'Check-in', '09:00', '09:30', 'à l’heure']);
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer sheets-token');
  assert.equal(h.elements.get('#attendance-status').dataset.state, 'success');
  assert.equal(h.elements.get('#export-button')['aria-busy'], 'false');
});

test('complete pagination allows a clearly labeled PARTIEL Sheets and CSV report without counting uncertain identities', async () => {
  const rows = [
    { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@holbertonstudents.com', date: '19/02/1970', meeting: 'Check-in', arrival: '09:00', departure: '09:30', status: 'à l’heure' },
    { firstName: 'Participant', lastName: 'inconnu', email: 'unknown@holbertonstudents.com', date: '19/02/1970', meeting: 'Check-in', arrival: '', departure: '', status: 'à vérifier' },
  ];
  const h = createHarness();
  setExportState(h.context, { rows, collectionComplete: true });
  vm.runInContext('renderAttendanceRows(currentAttendanceRows)', h.context);
  assert.equal(h.elements.get('#summary-on-time').textContent, '1');
  assert.equal(h.elements.get('#summary-late').textContent, '0');
  assert.equal(h.elements.get('#summary-absent').textContent, '0');
  assert.equal(h.elements.get('#summary-waiting').textContent, '0');

  await vm.runInContext('exportAttendanceToSheets()', h.context);
  const createBody = JSON.parse(h.calls[0].options.body);
  const updateBody = JSON.parse(h.calls.at(-1).options.body);
  assert.equal(createBody.properties.title, 'Check-in - 19/02/1970');
  assert.deepEqual(updateBody.values[0], ['Rapport PARTIEL', '', '', '', '', '', '']);
  assert.deepEqual(updateBody.values[1], ['Identités à vérifier : 1', '', '', '', '', '', '']);
  assert.deepEqual(updateBody.values[2], ['', '', '', '', '', '', '']);
  assert.deepEqual(updateBody.values[3], ['Prénom', 'Nom', 'Date', 'Réunion', 'Arrivée', 'Départ', 'Statut']);
  assert.deepEqual(updateBody.values[4], ['Participant', 'inconnu', '19/02/1970', 'Check-in', '', '', 'à vérifier']);
  assert.match(h.elements.get('#attendance-status').textContent, /Rapport PARTIEL exporté/);

  vm.runInContext('downloadLocalCsv()', h.context);
  const csv = decodeURIComponent(h.downloads[0].url.split(',')[1]);
  assert.match(csv, /"Rapport PARTIEL"/);
  assert.match(csv, /"Identités à vérifier : 1"/);
  assert.match(csv, /"Participant";"inconnu";"19\/02\/1970";"Check-in";"";"";"à vérifier"/);
});

test('Sheets export stays blocked until the complete collection flag is set', async () => {
  const h = createHarness();
  setExportState(h.context, { collectionComplete: false });
  await vm.runInContext('exportAttendanceToSheets()', h.context);
  assert.equal(h.calls.length, 0);
  assert.match(h.elements.get('#attendance-status').textContent, /fin complète de la collecte Meet/i);
});

test('Meet pagination collects every page and rejects a failed later page', async (t) => {
  await t.test('all pages collected before report can be marked complete', async () => {
    const requestedUrls = [];
    const h = createHarness({ fetchImpl: async (url, options, calls) => {
      const pageUrl = new URL(String(url));
      requestedUrls.push(pageUrl);
      calls.push({ url: String(url), options });
      if (!pageUrl.searchParams.has('pageToken')) return response(200, { participants: [{ name: 'participant-1' }], nextPageToken: 'page-2' });
      return response(200, { participants: [{ name: 'participant-2' }] });
    } });
    const participants = await vm.runInContext('fetchAllMeetPages("https://meet.googleapis.com/v2/conferenceRecords/c1/participants?pageSize=250", "participants", "calendar-token")', h.context);
    assert.deepEqual(Array.from(participants, ({ name }) => name), ['participant-1', 'participant-2']);
    assert.equal(requestedUrls.length, 2);
    assert.equal(requestedUrls[1].searchParams.get('pageToken'), 'page-2');
  });

  await t.test('a failed later page rejects collection instead of returning a partial array', async () => {
    let requests = 0;
    const h = createHarness({ fetchImpl: async (url, options, calls) => {
      calls.push({ url: String(url), options });
      requests += 1;
      return requests === 1
        ? response(200, { participants: [{ name: 'participant-1' }], nextPageToken: 'page-2' })
        : response(503, {}, { text: 'temporary' });
    } });
    await assert.rejects(vm.runInContext('fetchAllMeetPages("https://meet.googleapis.com/v2/conferenceRecords/c1/participants?pageSize=250", "participants", "calendar-token")', h.context), /meet-request-failed-503/);
    assert.equal(requests, 2);
  });
});

test('Meet report becomes complete only after valid endTime and successful pagination; uncertain Agenda identities stay PARTIEL', async (t) => {
  const event = {
    summary: 'Check-in',
    start: { dateTime: '2026-10-13T09:00:00.000Z' },
    end: { dateTime: '2026-10-13T10:00:00.000Z' },
    hangoutLink: 'https://meet.google.com/abc-mnop-xyz',
    attendees: [
      { email: 'ada@holbertonstudents.com', displayName: 'Ada Lovelace' },
      { email: 'absent@holbertonstudents.com', displayName: 'Absent Student' },
      { displayName: 'Guest without email' },
      { email: 'not-an-email', displayName: 'Guest with invalid email' },
    ],
  };
  const makeMeetFetch = (settings = {}) => {
    const { ended = true, failSessionsPage = false, omitParticipants = false, includeUnknownParticipant = false, includeConflictingEmailParticipant = false, malformedParticipant = false, malformedParticipantName = false, reservedParticipantId = '' } = settings;
    const recordName = settings.malformedRecordName ? 'other/record/target' : `conferenceRecords/${settings.reservedRecordId || 'target'}`;
    return async (url, options, calls) => {
    const pageUrl = new URL(String(url));
    calls.push({ url: String(url), options });
    if (pageUrl.pathname === '/v2/conferenceRecords') {
      if (!pageUrl.searchParams.has('pageToken')) return response(200, { conferenceRecords: [], nextPageToken: 'records-2' });
      return response(200, { conferenceRecords: [{ name: recordName, startTime: event.start.dateTime, ...(ended ? { endTime: '2026-10-13T10:00:00.000Z' } : {}) }] });
    }
    if (pageUrl.pathname.endsWith('/participants') && !pageUrl.pathname.endsWith('/participantSessions')) {
      if (!pageUrl.searchParams.has('pageToken')) return response(200, { participants: [], nextPageToken: 'participants-2' });
      if (omitParticipants) return response(200, { nextPageToken: null });
      return response(200, { participants: [
        { name: `${recordName}/participants/p1`, signedinUser: { displayName: 'Ada Lovelace', email: 'ada@holbertonstudents.com' } },
        ...(includeUnknownParticipant ? [{ name: `${recordName}/participants/p2`, anonymousUser: { displayName: 'Absent Student' } }] : []),
        ...(includeConflictingEmailParticipant ? [{ name: `${recordName}/participants/p3`, signedinUser: { displayName: 'Absent Student', email: 'different@holbertonstudents.com' } }] : []),
        ...(malformedParticipant ? [{ signedinUser: { displayName: 'Malformed participant' } }] : []),
        ...(malformedParticipantName ? [{ name: 'other/path/p4', signedinUser: { displayName: 'Malformed resource', email: 'malformed@holbertonstudents.com' } }] : []),
        ...(reservedParticipantId ? [{ name: `${recordName}/participants/${reservedParticipantId}`, signedinUser: { displayName: 'Encoded Resource', email: 'encoded@holbertonstudents.com' } }] : []),
      ] });
    }
    if (pageUrl.pathname.endsWith('/participantSessions')) {
      if (!pageUrl.searchParams.has('pageToken')) return response(200, { participantSessions: [], nextPageToken: 'sessions-2' });
      if (failSessionsPage) return response(503, {}, { text: 'temporary' });
      return response(200, { participantSessions: [{ startTime: '2026-10-13T09:01:00.000Z', endTime: '2026-10-13T09:30:00.000Z' }] });
    }
    return response(500, {}, { text: `unexpected ${pageUrl}` });
  };
  };

  await t.test('valid end time plus all pages permits a PARTIEL report and confirms a certain absence', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), true);
    const rows = JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context));
    assert.equal(rows.length, 4);
    assert.equal(rows.find(({ name }) => name === 'Ada Lovelace').status, 'à l’heure');
    assert.equal(rows.find(({ name }) => name === 'Absent Student').status, 'absent');
    assert.equal(rows.filter(({ email }) => !email).length, 2);
    assert.equal(h.elements.get('#summary-on-time').textContent, '1');
    assert.equal(h.elements.get('#summary-late').textContent, '0');
    assert.equal(h.elements.get('#summary-absent').textContent, '1');
    assert.equal(h.elements.get('#summary-waiting').textContent, '0');
    const values = JSON.parse(vm.runInContext('JSON.stringify(exportValues())', h.context));
    assert.deepEqual(values[0], ['Rapport PARTIEL', '', '', '', '', '', '']);
    assert.deepEqual(values[1], ['Identités à vérifier : 2', '', '', '', '', '', '']);
    assert.deepEqual(values.slice(4).map((row) => row.at(-1)).sort(), ['à vérifier', 'à vérifier', 'à l’heure', 'absent'].sort());
  });

  await t.test('anonymous Meet participant prevents an absent conclusion based on name', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, includeUnknownParticipant: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    const rows = JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context));
    assert.equal(rows.find(({ name }) => name === 'Absent Student').status, 'à vérifier');
    assert.equal(rows.filter(({ email }) => !email).length, 3);
    assert.equal(h.elements.get('#summary-absent').textContent, '0');
    const values = JSON.parse(vm.runInContext('JSON.stringify(exportValues())', h.context));
    assert.deepEqual(values[0], ['Rapport PARTIEL', '', '', '', '', '', '']);
  });

  await t.test('different email with the same normalized name keeps the invite at verification', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, includeConflictingEmailParticipant: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    const rows = JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context));
    assert.equal(rows.find(({ name }) => name === 'Absent Student').status, 'à vérifier');
    assert.equal(rows.find(({ email }) => email === 'different@holbertonstudents.com').status, 'à vérifier');
    assert.equal(h.elements.get('#summary-absent').textContent, '0');
  });

  await t.test('attendeesOmitted prevents absence claims from an incomplete Agenda roster', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true }) });
    const eventWithOmittedAttendees = { ...event, attendeesOmitted: true };
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(eventWithOmittedAttendees)})`, h.context);
    const rows = JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context));
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), true);
    assert.equal(rows.find(({ name }) => name === 'Absent Student').status, 'à vérifier');
    assert.equal(h.elements.get('#summary-absent').textContent, '0');
    const values = JSON.parse(vm.runInContext('JSON.stringify(exportValues())', h.context));
    assert.deepEqual(values[0], ['Rapport PARTIEL', '', '', '', '', '', '']);
  });

  await t.test('attendeesOmitted labels an otherwise matched roster as PARTIEL', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true }) });
    const eventWithVisibleRoster = { ...event, attendees: [event.attendees[0]], attendeesOmitted: true };
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(eventWithVisibleRoster)})`, h.context);
    const rows = JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context));
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), true);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'à l’heure');
    const values = JSON.parse(vm.runInContext('JSON.stringify(exportValues())', h.context));
    assert.deepEqual(values[0], ['Rapport PARTIEL', '', '', '', '', '', '']);
    assert.match(values[2][0], /Roster Agenda incomplet/);
    const html = vm.runInContext('createLocalReportHtml(currentAttendanceRows)', h.context);
    assert.match(html, /Rapport PARTIEL/);
    assert.match(html, /Roster Agenda incomplet/);
  });

  await t.test('missing Meet end time leaves collection incomplete and blocks Sheets export', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: false }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), false);
    const rows = JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context));
    assert.equal(rows.find(({ name }) => name === 'Absent Student').status, 'à vérifier');
    await vm.runInContext('exportAttendanceToSheets()', h.context);
    assert.equal(h.calls.some(({ url }) => String(url).includes('sheets.googleapis.com') || String(url).includes('drive/v3')), false);
  });

  await t.test('failed later session page clears the report and never marks collection complete', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, failSessionsPage: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), false);
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context)), []);
    assert.equal(h.calls.some(({ url }) => String(url).includes('sheets.googleapis.com') || String(url).includes('drive/v3')), false);
  });

  await t.test('missing participants collection clears the report and blocks Sheets and CSV exports', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, omitParticipants: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), false);
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context)), []);
    await vm.runInContext('exportAttendanceToSheets()', h.context);
    vm.runInContext('downloadLocalCsv()', h.context);
    assert.equal(h.calls.some(({ url }) => String(url).includes('sheets.googleapis.com') || String(url).includes('drive/v3')), false);
    assert.equal(h.downloads.length, 0);
  });

  await t.test('malformed Meet participant row blocks the report and all exports', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, malformedParticipant: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), false);
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context)), []);
    await vm.runInContext('exportAttendanceToSheets()', h.context);
    vm.runInContext('downloadLocalCsv()', h.context);
    assert.equal(h.calls.some(({ url }) => String(url).includes('sheets.googleapis.com') || String(url).includes('drive/v3')), false);
    assert.equal(h.downloads.length, 0);
  });

  await t.test('participant resource name outside the selected record blocks the report', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, malformedParticipantName: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), false);
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context)), []);
    assert.equal(h.calls.some(({ url }) => String(url).includes('/participants/p4/participantSessions')), false);
  });

  await t.test('malformed conference record resource blocks participant requests', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, malformedRecordName: true }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    assert.equal(vm.runInContext('currentCollectionComplete', h.context), false);
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(currentAttendanceRows)', h.context)), []);
    assert.equal(h.calls.some(({ url }) => new URL(String(url)).pathname.includes('/participants')), false);
  });

  await t.test('conference record ID reserved characters stay encoded in the URL path', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, reservedRecordId: 'record?4#frag' }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    const participantsRequest = h.calls.find(({ url }) => String(url).includes('/conferenceRecords/record%3F4%23frag/participants'));
    const sessionsRequest = h.calls.find(({ url }) => String(url).includes('/conferenceRecords/record%3F4%23frag/participants/p1/participantSessions'));
    assert.ok(participantsRequest);
    assert.ok(sessionsRequest);
    assert.equal(new URL(String(participantsRequest.url)).hash, '');
    assert.equal(new URL(String(sessionsRequest.url)).searchParams.get('pageSize'), '250');
  });

  await t.test('participant ID reserved characters stay inside one encoded URL segment', async () => {
    const h = createHarness({ fetchImpl: makeMeetFetch({ ended: true, reservedParticipantId: 'p?4#frag' }) });
    setExportState(h.context, { rows: [], collectionComplete: false });
    await vm.runInContext(`analyzeMeeting(${JSON.stringify(event)})`, h.context);
    const sessionRequest = h.calls.find(({ url }) => String(url).includes('p%3F4%23frag/participantSessions'));
    assert.ok(sessionRequest, 'the opaque participant ID must be encoded as one path segment');
    const parsed = new URL(String(sessionRequest.url));
    assert.equal(parsed.searchParams.get('pageSize'), '250');
    assert.equal(parsed.hash, '');
  });
});

test('popup OAuth sinks reject invalid tokens before requests, state changes, or token exposure', async (t) => {
  const invalidTokens = [null, undefined, '', '  ', false, 0, {}, []];
  for (const invalidToken of invalidTokens) {
    await t.test(String(invalidToken), async () => {
      const h = createHarness({ fetchImpl: async (url, options, calls) => {
        calls.push({ url: String(url), options });
        return response(200, {});
      } });
      setExportState(h.context, { token: 'trusted-calendar-token' });
      h.elements.get('#auth-status').dataset.state = 'existing';
      h.elements.get('#auth-status').textContent = 'Compte de test connecté';
      const previousToken = vm.runInContext('currentAccessToken', h.context);
      const statusBefore = { state: h.elements.get('#auth-status').dataset.state, text: h.elements.get('#auth-status').textContent };
      const invalidSession = invalidToken === undefined ? '{}' : `{ token: ${JSON.stringify(invalidToken)} }`;

      assert.throws(() => vm.runInContext(`finishGoogleConnection(${invalidSession})`, h.context), /google-auth-required/);
      await assert.rejects(vm.runInContext(`fetchConnectedAccount(${JSON.stringify(invalidToken)})`, h.context), /google-auth-required/);
      await assert.rejects(vm.runInContext('loadCalendarEvents(" ")', h.context), /google-auth-required/);
      await assert.rejects(vm.runInContext('fetchWithRetry("https://example.invalid", { headers: {} })', h.context), /google-auth-required/);

      assert.equal(h.calls.length, 0);
      assert.equal(vm.runInContext('currentAccessToken', h.context), previousToken);
      assert.deepEqual({ state: h.elements.get('#auth-status').dataset.state, text: h.elements.get('#auth-status').textContent }, statusBefore);
      assert.doesNotMatch(h.elements.get('#auth-status').textContent, /Bearer|undefined|null|\[object Object\]/i);
    });
  }
});

test('Meet and Agenda pagination reject invalid/repeated tokens and stop at the page cap', async (t) => {
  const invalidPageTokens = ['', ' padded ', false, 1, {}, 'bad\u0001token', 'x'.repeat(4097)];

  async function runMeetPages(pagePayload) {
    let calls = 0;
    const h = createHarness({ fetchImpl: async (url, options, recordedCalls) => {
      recordedCalls.push({ url: String(url), options });
      calls += 1;
      return response(200, pagePayload(calls));
    } });
    try {
      await vm.runInContext('fetchAllMeetPages("https://meet.googleapis.com/v2/conferenceRecords/c1/participants?pageSize=250", "participants", "calendar-token")', h.context);
      return { calls, h };
    } catch (error) {
      return { calls, h, error };
    }
  }

  async function runAgendaPages(pagePayload) {
    let eventCalls = 0;
    const h = createHarness({ fetchImpl: async (url, options, recordedCalls) => {
      const parsed = new URL(String(url));
      recordedCalls.push({ url: String(url), options });
      if (parsed.pathname.endsWith('/calendarList')) return response(200, { items: [{ id: 'primary', selected: true }] });
      if (parsed.pathname.endsWith('/events')) {
        eventCalls += 1;
        return response(200, pagePayload(eventCalls));
      }
      return response(500, {}, { text: 'unexpected request' });
    } });
    try {
      await vm.runInContext('loadCalendarEvents("calendar-token")', h.context);
      return { calls: eventCalls, h };
    } catch (error) {
      return { calls: eventCalls, h, error };
    }
  }

  for (const pageToken of invalidPageTokens) {
    await t.test(`Meet rejects malformed token ${String(pageToken).slice(0, 20)}`, async () => {
      const result = await runMeetPages(() => ({ participants: [], nextPageToken: pageToken }));
      assert.match(result.error?.message || '', /pagination.*invalid.*token/i);
    });
    await t.test(`Agenda rejects malformed token ${String(pageToken).slice(0, 20)}`, async () => {
      const result = await runAgendaPages(() => ({ items: [], nextPageToken: pageToken }));
      assert.match(result.error?.message || '', /pagination.*invalid.*token/i);
    });
  }

  await t.test('Meet repeated page token fails closed', async () => {
    const result = await runMeetPages(() => ({ participants: [], nextPageToken: 'same-page' }));
    assert.match(result.error?.message || '', /pagination.*token.*loop/i);
    assert.equal(result.calls, 2);
  });
  await t.test('Agenda repeated page token fails closed', async () => {
    const result = await runAgendaPages(() => ({ items: [], nextPageToken: 'same-page' }));
    assert.match(result.error?.message || '', /pagination.*token.*loop/i);
    assert.equal(result.calls, 2);
  });

  await t.test('Meet page missing the requested collection key fails closed', async () => {
    const result = await runMeetPages(() => ({ nextPageToken: null }));
    assert.match(result.error?.message || '', /google-pagination-invalid-collection/);
  });
  await t.test('Calendar page missing items fails closed', async () => {
    const result = await runAgendaPages(() => ({ nextPageToken: null }));
    assert.match(result.error?.message || '', /calendar-pagination-invalid-collection/);
  });

  await t.test('Meet page limit is bounded', async () => {
    const result = await runMeetPages((calls) => ({ participants: [], nextPageToken: `page-${calls + 1}` }));
    assert.match(result.error?.message || '', /pagination.*page.*limit/i);
    assert.equal(result.calls, 100);
  });
  await t.test('Agenda page limit is bounded', async () => {
    const result = await runAgendaPages((calls) => ({ items: [], nextPageToken: `page-${calls + 1}` }));
    assert.match(result.error?.message || '', /pagination.*page.*limit/i);
    assert.equal(result.calls, 100);
  });
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
  setExportState(h.context, { rows: [{ firstName: 'Ada', lastName: '"Countess"', email: 'ada@holbertonstudents.com', date: '19/02/1970', meeting: 'Check-in;\nevening', arrival: null, departure: undefined, status: 'à l’heure' }] });
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

test('CSV prefixes formula-like values from names and meeting fields, including after controls and whitespace', () => {
  const h = createHarness();
  const formulas = ['=SUM(1,1)', '+SUM(1,1)', '-SUM(1,1)', '@SUM(1,1)', ' \t=SUM(1,1)', '\u0001@SUM(1,1)'];
  const formatted = JSON.parse(vm.runInContext(`JSON.stringify(${JSON.stringify(formulas)}.map(formatCsvCell))`, h.context));
  assert.deepEqual(formatted, formulas.map((value) => `"'${value}"`));

  setExportState(h.context, { rows: [{
    firstName: '=SUM(1,1)',
    lastName: '+SUM(1,1)',
    email: '@SUM(1,1)',
    date: '\u0001=SUM(1,1)',
    meeting: '-SUM(1,1)',
    arrival: '',
    departure: '',
    status: 'à l’heure',
  }] });
  vm.runInContext('downloadLocalCsv()', h.context);
  const csv = decodeURIComponent(h.downloads[0].url.split(',')[1]);
  assert.match(csv, /"'=SUM\(1,1\)";"'\+SUM\(1,1\)";"'\u0001=SUM\(1,1\)";"'-SUM\(1,1\)"/);
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

test('invalid OAuth sessions cause no request, preserve the current token, and expose no token value', async (t) => {
  const invalidTokens = [null, undefined, '', '   ', false, 0, {}, []];
  for (const invalidToken of invalidTokens) {
    await t.test(String(invalidToken), async () => {
      const h = createHarness({ authImpl: async ({ interactive }) => {
        if (!interactive) throw new Error('no-cached-token');
        return invalidToken === undefined ? {} : { token: invalidToken };
      } });
      setExportState(h.context, { token: 'calendar-token' });
      await vm.runInContext('exportAttendanceToSheets()', h.context);
      assert.equal(h.calls.length, 0, 'invalid OAuth result must be rejected before fetch');
      assert.equal(vm.runInContext('currentAccessToken', h.context), 'calendar-token');
      assert.equal(h.elements.get('#attendance-status').dataset.state, 'unavailable');
      assert.equal(h.elements.get('#local-export-button').hidden, false);
      assert.doesNotMatch(h.elements.get('#attendance-status').textContent, /Bearer|undefined|null|\[object Object\]/i);
    });
  }
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
