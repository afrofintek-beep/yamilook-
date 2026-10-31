import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAdminPages, matchesAdminUser } from '../../src/lib/admin-user-search.ts';

test('finds an older account beyond the first 100 profiles with or without @', async () => {
  const profiles = Array.from({ length: 120 }, (_, i) => ({ username: `user${i}` }));
  profiles[105] = { username: 'lauzinho' };
  const ranges = [];
  const loaded = await loadAdminPages(async (from, to) => {
    ranges.push([from, to]);
    return { data: profiles.slice(from, to + 1), error: null };
  });
  assert.equal(loaded.length, 120);
  assert.deepEqual(ranges, [[0, 99], [100, 199], [120, 219]]);
  for (const query of ['lauzinho', '@lauzinho', ' @LAUZINHO ']) {
    assert.deepEqual(loaded.filter(user => matchesAdminUser(user, query)), [profiles[105]]);
  }
});

test('handles smaller server page caps without silently truncating', async () => {
  const rows = Array.from({ length: 120 }, (_, i) => i);
  assert.deepEqual(await loadAdminPages(async from => ({ data: rows.slice(from, from + 40), error: null })), rows);
});

test('fails the entire load when a later page fails', async () => {
  await assert.rejects(loadAdminPages(async from => from === 0
    ? { data: [1], error: null }
    : { data: null, error: new Error('permission denied') }), /permission denied/);
});

test('empty result terminates', async () => {
  assert.deepEqual(await loadAdminPages(async () => ({ data: [], error: null })), []);
});

test('supports names, email, blanks, null fields and absent users', () => {
  const user = { display_name: 'Estanislau Baptista', username: 'lauzinho', email: 'example@test.invalid' };
  for (const query of ['Baptista', ' example@test.invalid ', '', '  ', '@']) assert.equal(matchesAdminUser(user, query), true);
  assert.equal(matchesAdminUser(user, '@Baptista'), false);
  assert.equal(matchesAdminUser(user, 'missing'), false);
  assert.equal(matchesAdminUser({ display_name: null }, 'lauzinho'), false);
});
