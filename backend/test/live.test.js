import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStatus, isAllowedEmail, renderReportHtml, verifyGoogleAccessToken } from '../src/live.js';

test('only Holberton School emails are allowed', () => {
  assert.equal(isAllowedEmail('mentor@holbertonschool.com'), true);
  assert.equal(isAllowedEmail('mentor@gmail.com'), false);
  assert.equal(isAllowedEmail('mentor@holbertonstudents.com'), false);
});

test('calculates late status and minutes', () => {
  const result = calculateStatus('2026-10-13T09:14:00Z', '2026-10-13T09:00:00Z');
  assert.deepEqual(result, { status: 'late', lateMinutes: 14 });
});

test('keeps a small delay on time', () => {
  const result = calculateStatus('2026-10-13T09:02:00Z', '2026-10-13T09:00:00Z');
  assert.deepEqual(result, { status: 'on-time', lateMinutes: 0 });
});

test('renders a safe HTML report with late participants highlighted', () => {
  const html = renderReportHtml({ mentorEmail: 'mentor@holbertonschool.com', participants: [{ name: '<Alice>', status: 'late', lateMinutes: 8 }] });
  assert.match(html, /&lt;Alice&gt;/);
  assert.match(html, /class="late"/);
  assert.doesNotMatch(html, /<Alice>/);
});

test('accepts only a verified Google token from the allowed domain', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ email: 'mentor@holbertonschool.com', sub: 'subject-1' }) });
  assert.deepEqual(await verifyGoogleAccessToken('a-valid-token-with-enough-length', fetchImpl), { email: 'mentor@holbertonschool.com', subject: 'subject-1' });
});
