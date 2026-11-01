import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  identifier,
  jobsCatalog,
  render,
  rowDigest,
  snapshotSql,
  teardownSql,
  triggerSql,
} from './phase-02-slice-12-dec194-probe-ownership-pg-catalog.mjs';
import {
  digest,
  openOwnershipManifest,
} from './phase-02-slice-12-dec194-probe-ownership-pg-manifest.mjs';
import { openOwnedProcesses } from './phase-02-slice-12-dec194-probe-ownership-pg-process.mjs';

export {
  literal,
  identifier,
  oid,
} from './phase-02-slice-12-dec194-probe-ownership-pg-catalog.mjs';
export const release = '2026-10-16-local-alt-pg-ownership';
const target = 'supabase_db_wejammin_ev';
const worktree = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';

export function openOwnershipKit(root) {
  assert.equal(
    fs.realpathSync(root),
    worktree,
    'Only the claimed non-primary worktree is allowed',
  );
  assert.equal(
    process.env.S12_DEC194_OWNERSHIP_ROOT_RELEASE,
    release,
    'Explicit root release required',
  );
  assert.equal(
    process.env.S12_DEC194_OWNERSHIP_DB_CONTAINER,
    target,
    'Exact ALT container required',
  );
  const nonce = randomBytes(6).toString('hex');
  const manifest = openOwnershipManifest({ nonce, target });
  const { record, fixtures } = manifest;
  const processes = openOwnedProcesses({
    target,
    nonce,
    record,
    isFixtureTrigger: (name) =>
      fixtures.some((f) => [f.trigger, f.extra].includes(name)),
  });
  const { query, run, start, poll, drain } = processes;
  const source = fs.readFileSync(
    path.join(
      root,
      'tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership.sqlinc',
    ),
    'utf8',
  );
  const parts = source.split('-- DEC194_ACTIVATE\n');
  assert.equal(parts.length, 2);
  const sections = parts[1].split('-- DEC194_CLEANUP\n');
  assert.equal(sections.length, 2);
  const fixtureSource = fs.readFileSync(
    path.join(
      root,
      'tests/postgrest/support/phase-02-slice-12-dec194-probe-ownership-pg-fixture.sqlinc',
    ),
    'utf8',
  );
  const snapshot = async (f) => query(snapshotSql(f), 'catalog snapshot');
  const remember = async (f, ownAbsent = false, changes = {}) =>
    manifest.remember(f, await snapshot(f), ownAbsent, changes);
  const captureBaseline = () => manifest.captureBaseline(query);
  const fixtureTeardownSql = (...args) =>
    teardownSql({ baseline: manifest.baseline, fixtures }, ...args);

  async function fixture(label) {
    assert.ok(manifest.baseline);
    const schema = identifier(`s12_dec194_pg_${nonce}_${fixtures.length + 1}`);
    const f = {
      label,
      schema,
      foreign: `${schema}_foreign`,
      trigger: `${schema}_jobs`,
      extra: `${schema}_extra`,
      state: null,
      triggers: [],
    };
    fixtures.push(f);
    record({
      kind: 'fixture-intent',
      schema: f.schema,
      foreign: f.foreign,
      trigger: f.trigger,
      extra: f.extra,
    });
    f.ids = await query(render(fixtureSource, f), `create ${label} fixture`);
    record({
      kind: 'fixture-created',
      schema: f.schema,
      foreign: f.foreign,
      ...f.ids,
    });
    await remember(f);
    return f;
  }
  const activate = async (f) => {
    const value = await query(render(sections[0], f), `activate ${f.label}`);
    assert.ok(Number(value.oid) > 0);
    assert.equal(Number(value.functionOid), Number(f.ids.functionOid));
    record({
      kind: 'actual-acquisition',
      schema: f.schema,
      trigger: f.trigger,
      oid: value.oid,
      functionOid: value.functionOid,
    });
    f.acquisition = value;
    return value;
  };
  const cleanupSql = (f, acquired) => render(sections[1], f, acquired);
  const guardedFixtureSql = (f, body, commit = true) =>
    fixtureTeardownSql([f], [], body, commit);
  async function removeFixtures(items = fixtures) {
    assert.ok(
      await drain(),
      'Owned clients not drained: fixture cleanup withheld',
    );
    await query(fixtureTeardownSql(items), 'guarded manifest fixture teardown');
    for (const f of items) {
      f.triggers = [];
      f.state = { own: null, foreign: null };
    }
    record({
      kind: 'fixture-teardown',
      schemas: items.flatMap((f) => [f.schema, f.foreign]),
    });
  }
  async function removeTriggers(f, names) {
    assert.ok(
      await drain(),
      'Owned clients not drained: trigger teardown withheld',
    );
    await query(
      fixtureTeardownSql([f], names),
      'guarded manifest trigger teardown',
    );
    await remember(f, false, { removed: names });
  }
  async function verifyRestored() {
    assert.ok(await drain(), 'Owned sessions remain');
    assert.deepEqual(
      await query(`select ${jobsCatalog};`, 'restored trigger catalog'),
      manifest.baseline.jobs,
    );
    assert.deepEqual(
      await query(rowDigest, 'restored job digest'),
      manifest.baseline.rows,
    );
    for (const f of fixtures) {
      const state = await snapshot(f);
      assert.equal(state.own, null);
      assert.equal(state.foreign, null);
    }
    record({
      kind: 'restored',
      triggerDigest: digest(manifest.baseline.jobs),
      jobRows: manifest.baseline.rows,
    });
  }
  return {
    record,
    fixture,
    activate,
    cleanupSql,
    triggerSql,
    query,
    run,
    start,
    poll,
    snapshot,
    snapshotSql,
    guardedFixtureSql,
    remember,
    captureBaseline,
    drain,
    removeFixtures,
    removeTriggers,
    verifyRestored,
    templatesSha256: createHash('sha256').update(source).digest('hex'),
    close() {
      processes.close();
      manifest.close();
    },
  };
}
