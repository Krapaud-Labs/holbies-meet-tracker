import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/database.js';

test('database is optional in local memory mode', () => {
  assert.equal(createDatabase(''), null);
});
