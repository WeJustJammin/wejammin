// ROOT-RELEASED DB-ONLY DIAGNOSTIC. Not Vitest, RPC isolation, Auth, or hosted proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  openOwnershipKit,
  oid,
} from './support/phase-02-slice-12-dec194-probe-ownership-pg-kit.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const kit = openOwnershipKit(root);
const completed = [];
let stage = 'baseline';
let failed = false;
const location = (error) =>
  String(error?.stack ?? '')
    .split('\n')
    .find((line) => /^\s+at /.test(line) && line.includes(root))
    ?.trim() ?? 'unavailable';

function acquired(f, value) {
  assert.ok(Number(value.oid) > 0);
  assert.equal(Number(value.functionOid), Number(f.ids.functionOid));
  assert.equal(value.functionSchema, f.schema);
  assert.equal(value.functionName, 'observe_job');
  return value;
}
const trigger = (state, name) => state.jobs.find((t) => t.row.tgname === name);
function preservationOracle(result, before, after) {
  assert.notEqual(
    result.code,
    0,
    'Rebound foreign trigger must refuse cleanup',
  );
  assert.equal(result.state, 'P0001');
  assert.equal(result.ownershipRefusal, true);
  assert.deepEqual(
    after,
    before,
    'Refusal must preserve full fixture and jobs catalogs',
  );
}
async function actualCleanup(f, value) {
  const result = await kit.run(
    kit.cleanupSql(f, value),
    `actual cleanup ${f.label}`,
  );
  assert.equal(
    result.code,
    0,
    `Actual cleanup failed (${result.state ?? 'unknown'})`,
  );
  const state = await kit.remember(f, true, {
    removed: Number(value.oid) ? [f.trigger] : [],
  });
  assert.equal(state.own, null);
  return state;
}
async function finishCase(id, f, evidence) {
  await kit.removeFixtures([f]);
  await kit.verifyRestored();
  completed.push(id);
  kit.record({
    kind: 'case-pass',
    id,
    evidence,
    boundary: 'ownership-only real PostgreSQL; no RPC',
  });
}
async function installForeign(f, replace = false) {
  const created = await kit.query(
    kit.guardedFixtureSql(f, kit.triggerSql(f, f.trigger, true, replace)),
    'install harness-owned foreign hook',
  );
  return kit.remember(f, false, { created: [created.createdTrigger] });
}
async function reboundFixture(label) {
  const f = await kit.fixture(label);
  const value = acquired(f, await kit.activate(f));
  await kit.remember(f);
  const before = await installForeign(f, true);
  const rebound = trigger(before, f.trigger);
  assert.equal(
    Number(rebound.row.oid),
    Number(value.oid),
    'Same-OID replacement premise must be observed',
  );
  assert.notEqual(Number(rebound.row.tgfoid), Number(value.functionOid));
  assert.equal(Number(rebound.row.tgfoid), Number(f.ids.foreignFunctionOid));
  assert.equal(rebound.functionSchema, f.foreign);
  return { f, value, before };
}

try {
  await kit.captureBaseline();
  kit.record({
    kind: 'templates',
    ownershipSha256: kit.templatesSha256,
    note: 'Positive cases execute actual frozen ACTIVATE/CLEANUP sections without rewriting',
  });

  stage = 'PGOWN001';
  {
    const f = await kit.fixture('normal acquired cleanup');
    const value = acquired(f, await kit.activate(f));
    await kit.remember(f);
    const state = await actualCleanup(f, value);
    assert.equal(trigger(state, f.trigger), undefined);
    await finishCase(
      stage,
      f,
      'Actual acquired OIDs; unchanged activation and cleanup succeed',
    );
  }

  stage = 'PGOWN002';
  {
    const f = await kit.fixture('fixture-only zero acquisition');
    const before = await kit.snapshot(f);
    const state = await actualCleanup(f, { oid: 0, functionOid: 0 });
    assert.deepEqual(state.jobs, before.jobs);
    assert.deepEqual(state.foreign, before.foreign);
    await finishCase(
      stage,
      f,
      'Zero acquired OIDs remove only own fixture schema',
    );
  }

  stage = 'PGOWN003';
  {
    const f = await kit.fixture('duplicate preexisting foreign hook');
    const before = await installForeign(f);
    const foreign = trigger(before, f.trigger);
    assert.equal(Number(foreign.row.tgfoid), Number(f.ids.foreignFunctionOid));
    await assert.rejects(() => kit.activate(f), /SQL failed \(42710\)/);
    assert.deepEqual(await kit.snapshot(f), before);
    const after = await actualCleanup(f, { oid: 0, functionOid: 0 });
    assert.deepEqual(after.jobs, before.jobs);
    assert.deepEqual(after.foreign, before.foreign);
    assert.deepEqual(trigger(after, f.trigger), foreign);
    await finishCase(
      stage,
      f,
      'Actual CREATE refuses preexisting foreign trigger; zero-acquisition cleanup preserves it',
    );
  }

  stage = 'PGOWN004';
  {
    const { f, value, before } = await reboundFixture(
      'same-OID foreign replacement',
    );
    const result = await kit.run(
      kit.cleanupSql(f, value),
      'same-OID actual cleanup',
    );
    preservationOracle(result, before, await kit.snapshot(f));
    await finishCase(
      stage,
      f,
      'Observed unchanged trigger OID with changed function; actual guard preserves all state',
    );
  }

  stage = 'PGOWN005';
  {
    const f = await kit.fixture('unowned-to-helper dependent trigger');
    const value = acquired(f, await kit.activate(f));
    await kit.remember(f);
    const created = await kit.query(
      kit.guardedFixtureSql(f, kit.triggerSql(f, f.extra)),
      'install harness-owned dependency',
    );
    const before = await kit.remember(f, false, {
      created: [created.createdTrigger],
    });
    const own = trigger(before, f.trigger),
      dependent = trigger(before, f.extra);
    assert.ok(own && dependent);
    assert.notEqual(Number(own.row.oid), Number(dependent.row.oid));
    assert.equal(Number(dependent.row.tgfoid), Number(value.functionOid));
    const result = await kit.run(
      kit.cleanupSql(f, value),
      'dependency actual cleanup',
    );
    assert.notEqual(result.code, 0);
    assert.equal(result.state, '2BP01');
    const after = await kit.snapshot(f);
    assert.deepEqual(
      after,
      before,
      'Function RESTRICT failure must roll back prior trigger drop and all schema changes',
    );
    assert.deepEqual(trigger(after, f.trigger), own);
    assert.deepEqual(trigger(after, f.extra), dependent);
    await kit.removeTriggers(f, [f.extra]);
    await actualCleanup(f, value);
    await finishCase(
      stage,
      f,
      'Actual dependency error restores both triggers/full schema; rerun succeeds after guarded fixture removal',
    );
  }

  stage = 'PGOWN006';
  {
    const f = await kit.fixture('observed two-client jobs DDL barrier');
    const value = acquired(f, await kit.activate(f));
    const previous = await kit.remember(f);
    const a = kit.start(
      kit.guardedFixtureSql(
        f,
        `${kit.triggerSql(f, f.trigger, true, true)}
      ${kit.snapshotSql(f)}
      select jsonb_build_object('ready',true);`,
        false,
      ),
      'A uncommitted foreign rebind',
      true,
    );
    await kit.poll(async () => {
      assert.equal(a.settled, false, 'A closed before barrier');
      return a.rows.some((row) => row?.ready) && a.pid;
    }, 'A ready');
    const expected = a.rows.find(
      (row) => row?.jobs && Object.hasOwn(row, 'own'),
    );
    const created = a.rows.find((row) => row?.createdTrigger)?.createdTrigger;
    assert.ok(
      expected,
      'A must expose its actual uncommitted post-rebind catalog',
    );
    assert.ok(
      created,
      'A must expose the exact harness-created replacement identity',
    );
    assert.equal(
      Number(created.row.oid),
      Number(value.oid),
      'Same-OID premise must hold before B starts',
    );
    assert.equal(Number(created.row.tgfoid), Number(f.ids.foreignFunctionOid));
    assert.equal(created.functionSchema, f.foreign);
    assert.deepEqual(expected.own, previous.own);
    assert.deepEqual(expected.foreign, previous.foreign);
    const b = kit.start(kit.cleanupSql(f, value), 'B actual blocked cleanup');
    await kit.poll(async () => b.pid, 'B PID');
    const witness = await kit.poll(async () => {
      assert.equal(
        b.settled,
        false,
        'Cleanup completed before the observed DDL barrier',
      );
      const row = await kit.query(
        `select jsonb_build_object(
        'a',${oid(a.pid)},'b',${oid(b.pid)},
        'blocking',${oid(a.pid)}=any(pg_blocking_pids(${oid(b.pid)})),
        'waiting',exists(select 1 from pg_locks l where l.pid=${oid(b.pid)}
          and l.locktype='relation' and l.relation='platform_private.jobs'::regclass
          and l.mode='AccessExclusiveLock' and not l.granted),
        'held',exists(select 1 from pg_locks l where l.pid=${oid(a.pid)}
          and l.locktype='relation' and l.relation='platform_private.jobs'::regclass
          and l.mode='AccessExclusiveLock' and l.granted),
        'active',exists(select 1 from pg_stat_activity s where s.pid=${oid(b.pid)}
          and s.state='active' and s.wait_event_type='Lock'));`,
        'observe actual jobs DDL wait',
      );
      return row.blocking && row.waiting && row.held && row.active ? row : null;
    }, 'B actually blocked by A');
    assert.equal(b.settled, false);
    kit.record({ kind: 'ddl-barrier-observed', ...witness });
    a.end('\ncommit;\n');
    const aResult = await a.done;
    assert.equal(aResult.code, 0);
    const result = await b.done;
    const after = await kit.remember(f, false, { created: [created] });
    const rebound = trigger(after, f.trigger);
    assert.equal(Number(rebound.row.oid), Number(value.oid));
    assert.equal(Number(rebound.row.tgfoid), Number(f.ids.foreignFunctionOid));
    assert.equal(rebound.functionSchema, f.foreign);
    // Compare against the committed A result, not the pre-rebind helper acquisition.
    preservationOracle(result, expected, after);
    await finishCase(
      stage,
      f,
      'Observed pg_locks + pg_blocking_pids + activity before A COMMIT; actual B rechecks/refuses afterward',
    );
  }

  stage = 'PGOWN007';
  {
    const { f, value, before } = await reboundFixture(
      'memory-only guard-removal mutation',
    );
    const actual = kit.cleanupSql(f, value);
    const guard =
      / {4}if not exists \([\s\S]*?raise exception 'DEC194_PROBE_OWNERSHIP_CHANGED';\n {4}end if;\n/g;
    const matches = [...actual.matchAll(guard)];
    assert.equal(
      matches.length,
      1,
      'Mutation must remove exactly the ownership guard',
    );
    const mutant = actual.replace(guard, '');
    assert.notEqual(mutant, actual);
    const result = await kit.run(
      mutant,
      'synthetic-target guard-removal mutant',
    );
    const after = await kit.snapshot(f);
    assert.equal(
      result.code,
      0,
      'Mutant must actually execute, not fail for setup reasons',
    );
    assert.equal(
      trigger(after, f.trigger),
      undefined,
      'Mutant must delete the synthetic foreign trigger',
    );
    assert.equal(after.own, null);
    assert.deepEqual(after.foreign, before.foreign);
    assert.throws(() => preservationOracle(result, before, after), {
      code: 'ERR_ASSERTION',
    });
    await kit.remember(f, true, { removed: [f.trigger] });
    kit.record({
      kind: 'mutation-killed',
      id: stage,
      mutantSha256: createHash('sha256').update(mutant).digest('hex'),
      note: 'In-memory actual cleanup guard removed; no source edits/CASCADE; synthetic foreign-preservation oracle fails',
    });
    await finishCase(
      stage,
      f,
      'Actual SQL mutation executes and is killed by the same foreign-preservation oracle; not positive helper proof',
    );
  }
} catch (error) {
  failed = true;
  process.exitCode = 1;
  kit.record({
    kind: 'failure',
    stage,
    assertion: error?.code ?? error?.name ?? 'Error',
    source: location(error),
    note: 'No raw database error/catalog or credentials emitted',
  });
} finally {
  try {
    assert.ok(
      await kit.drain(),
      'Owned clients did not drain; no fixture teardown permitted',
    );
    await kit.removeFixtures();
    await kit.verifyRestored();
    kit.record({
      kind: 'result',
      status: failed ? 'FAIL' : 'PASS',
      cases: completed,
      acceptance:
        'DB-only ownership fixture evidence; API/RPC/isolation/hosted gates unchanged',
    });
    kit.close();
  } catch (error) {
    process.exitCode = 1;
    kit.record({
      kind: 'residual-fixtures',
      stage,
      assertion: error?.code ?? error?.name ?? 'Error',
      source: location(error),
      action:
        'Stop; root must inspect durable manifest; no broad cleanup or unrelated session termination',
    });
    if (await kit.drain()) kit.close();
  }
}
