import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const repository = new URL('../../../', import.meta.url);
const fixture = new URL('./20261122123828_massa_appypay_test_harness.sql', import.meta.url);
export const harnessManifest = JSON.parse(readFileSync(new URL('./harness.sources.json', import.meta.url), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readSource = path => readFileSync(new URL(path, repository), 'utf8');

// No connection, credentials, deployment command or network operation exists in
// this helper. It reads the fixture and the actual repository migrations only.
export function readHarnessParts() {
  const baseline = readFileSync(fixture, 'utf8');
  for (const item of harnessManifest.dependencies) {
    const source = readSource(item.path);
    if (sha256(source) !== item.source_sha256) throw new Error(`Harness source changed: ${item.path}`);
    const start = item.start_marker === null ? 0 : source.indexOf(item.start_marker);
    const end = item.end_marker === null ? source.length : source.indexOf(item.end_marker, start);
    if (start < 0 || end < start) throw new Error(`Harness source boundary missing: ${item.path}`);
    let extract = `${source.slice(start, end).trim()}\n`;
    if (item.strip_trailing_whitespace) extract = extract.replace(/[\t ]+$/gm, '');
    if (sha256(extract) !== item.extract_sha256) throw new Error(`Harness extraction changed: ${item.path}`);
    const expected = `-- BEGIN SOURCE ${item.path}\n-- Full source SHA-256: ${item.source_sha256}\n${extract}-- END SOURCE ${item.path}`;
    if (!baseline.includes(expected)) throw new Error(`Harness DDL differs from its source: ${item.path}`);
  }
  const originals = harnessManifest.wallet_migrations.map(item => {
    const sql = readSource(item.path);
    if (sha256(sql) !== item.source_sha256) throw new Error(`Wallet migration changed: ${item.path}`);
    return { path: item.path, sql, sha256: item.source_sha256 };
  });
  return [{ path: 'tests/massa-appypay/fixtures/20261122123828_massa_appypay_test_harness.sql', sql: baseline, sha256: sha256(baseline) }, ...originals];
}

// For review or a single explicitly targeted database transaction. Never records
// the extracted historical files as applied Supabase migrations.
export function buildHarnessSql() {
  const parts = readHarnessParts();
  return `begin;\nset local massa.harness_project = '${harnessManifest.target_project}';\n`
    + parts.map(part => `\n-- Applying complete file: ${part.path}\n${part.sql}\n`).join('')
    + '\ncommit;\n';
}

// Used by the PGlite test. A caller must supply the database explicitly.
export async function applyHarness(db) {
  const parts = readHarnessParts();
  await db.exec('begin');
  try {
    await db.query("select set_config('massa.harness_project',$1,true)", [harnessManifest.target_project]);
    for (const part of parts) await db.exec(part.sql);
    await db.exec('commit');
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
