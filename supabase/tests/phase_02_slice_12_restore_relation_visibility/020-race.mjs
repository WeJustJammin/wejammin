import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignmentRow,
  blockedBy,
  bounded,
  cleanup,
  facts,
  ids,
  image,
  lastJson,
  mutation,
  nowait,
  observer,
  prepare,
  requireAltRelease,
  schemaRow,
  Session,
  sourceImage,
  startRestore,
  targetRow,
} from './030-race-fixture.mjs';
import { FIELD, jsonb, sql } from '../../../infra/database-races/race-kit.mjs';

// No top-level setup, driver import, subprocess, database call, or implicit target.
// Every operation, including the visible public control, runs inside a test.
let controlPassed = false;

function visiblePremise(value) {
  assert.deepEqual(
    value,
    {
      sourceAuthority: true,
      visible: true,
      lifecycle: 'active',
      targetVersion: '1',
      assignment: 'active',
      pins: [null],
    },
    'source authority, target visibility and unpinned source relation are independently established',
  );
}

function refusal(result) {
  assert.equal(
    result.role,
    'service_role',
    'actual SQL service-role public transport',
  );
  assert.equal(result.state, 'P0001', 'whole restore refused');
  assert.equal(
    result.message,
    'migration_chain_incomplete',
    'existing restore token, no target disclosure',
  );
  assert.equal(result.response, undefined, 'no partial success resource');
}

async function unchanged(probe, fixture, before, sourceBefore) {
  const after = await image(probe, fixture);
  assert.deepEqual(
    Object.keys(after),
    Object.keys(before),
    'complete durable store inventory unchanged',
  );
  for (const [store, hash] of Object.entries(before)) {
    assert.equal(
      after[store],
      hash,
      `${store}: complete durable rows unchanged, not counts alone`,
    );
  }
  assert.equal(
    await sourceImage(probe, fixture),
    sourceBefore,
    'immutable source readback unchanged',
  );
}

async function success(probe, fixture, result, sourceBefore) {
  assert.equal(result.role, 'service_role');
  assert.equal(
    result.state,
    '00000',
    `visible public restore succeeds: ${result.message ?? ''}`,
  );
  const resource = result.response.resource;
  assert.equal(resource.entryId, fixture.entryId);
  assert.equal(resource.entryVersion, '3');
  assert.equal(resource.revisionNumber, '3');
  assert.notEqual(resource.id, fixture.sourceId);
  assert.deepEqual(result.response.restoreVerification.request, {
    entryId: fixture.entryId,
    revisionId: fixture.sourceId,
    migrationChainId: fixture.request.migrationChainId,
    expectedVersion: '2',
  });
  const rows = lastJson(
    await probe.query(`select jsonb_build_object(
    'entryVersion', (select version::text from platform_private.cms_content_entries
      where id = ${sql(fixture.entryId)}::uuid),
    'pointer', (select current_draft_revision_id from platform_private.cms_content_entries
      where id = ${sql(fixture.entryId)}::uuid),
    'contentHash', platform_private.cms_jcs_sha256(${jsonb({ [FIELD.title]: `RRV source ${fixture.label}` })}),
    'relations', (select jsonb_agg(jsonb_build_array(field_id::text, target_kind,
      target_id::text, expected_target_version, position) order by position)
      from platform_private.cms_entry_relations where revision_id = ${sql(resource.id)}::uuid));`),
  );
  assert.equal(rows.entryVersion, '3', 'one committed aggregate CAS advance');
  assert.equal(
    rows.pointer,
    resource.id,
    'committed pointer equals returned revision',
  );
  assert.equal(
    resource.contentHash,
    rows.contentHash,
    'independent literal field hash',
  );
  assert.deepEqual(
    rows.relations,
    [[FIELD.related, 'content', fixture.targetId, null, 0]],
    'one exact carried unpinned relation, independent of public output',
  );
  assert.equal(
    await sourceImage(probe, fixture),
    sourceBefore,
    'source full row image remains immutable',
  );
}

async function refuseWithoutWaiting(
  context,
  probe,
  caller,
  holder,
  fixture,
  work,
) {
  const deadline = Date.now() + 8_000;
  while (caller.pending) {
    const edge = lastJson(
      await probe.query(`select jsonb_build_object(
      'waiterPid', ${caller.pid}, 'holderPid', ${holder.pid}, 'blocked', exists (
        select 1 from pg_stat_activity w, pg_stat_activity h
        where w.pid = ${caller.pid} and w.application_name = ${sql(caller.name)}
          and h.pid = ${holder.pid} and h.application_name = ${sql(holder.name)}
          and h.pid = any(pg_blocking_pids(w.pid))));`),
    );
    if (edge.blocked) {
      const rowProbe = await nowait(probe, targetRow(fixture));
      context.diagnostic(JSON.stringify({ ...edge, rowProbe }));
      assert.equal(rowProbe, '55P03', 'exact invisible target remains locked');
      assert.fail(
        'actual restore backend waits behind the invisible target holder',
      );
    }
    assert.ok(
      Date.now() < deadline,
      'no completed refusal or exact blocker observed',
    );
  }
  // Completion, not elapsed time, is the success condition. The deadline above
  // bounds synchronization only; an unclassified timeout is not a defect proof.
  return bounded(work, 'restore outcome missing after command completion');
}

async function visibleControl() {
  if (controlPassed) return;
  requireAltRelease();
  const fixture = prepare('race-control');
  const probe = await observer();
  visiblePremise(await facts(probe, fixture));
  const sourceBefore = await sourceImage(probe, fixture);
  const caller = await Session.open('control');
  const result = await startRestore(caller, fixture);
  await caller.query('commit;');
  await success(probe, fixture, result, sourceBefore);
  await cleanup();
  controlPassed = true;
}

async function scenario(name, body) {
  await test(name, { timeout: 75_000 }, async (context) => {
    let primary;
    try {
      await visibleControl();
      await body(context);
    } catch (error) {
      primary = error;
    }
    try {
      await cleanup();
    } catch (error) {
      if (primary)
        throw new AggregateError(
          [primary, error],
          'test and owned cleanup failed',
          { cause: error },
        );
      throw error;
    }
    if (primary) throw primary;
    // node:test prints "ok 1 - name"; the race gate counts "ok - " receipts.
    console.log(`ok - ${name}`);
  });
}

await scenario(
  'RRV-R1 invisible target refuses while its exact row lock is still held',
  async (context) => {
    const fixture = prepare('no-lock-lever');
    const probe = await observer();
    visiblePremise(await facts(probe, fixture));
    const mutator = await Session.open('revoke');
    await mutator.query(`begin; select set_config('app.cms_rpc', 'true', true);
    ${mutation(fixture, 'unassign')} commit;`);
    const expected = {
      sourceAuthority: true,
      visible: false,
      lifecycle: 'active',
      targetVersion: '1',
      assignment: 'revoked',
      pins: [null],
    };
    assert.deepEqual(
      await facts(probe, fixture),
      expected,
      'only caller target assignment was revoked',
    );
    const before = await image(probe, fixture);
    const sourceBefore = await sourceImage(probe, fixture);
    const holder = await Session.open('holder');
    await holder.query(`begin; ${targetRow(fixture)} for update;`);
    assert.equal(
      await nowait(probe, targetRow(fixture)),
      '55P03',
      'known invisible target is locked before restore',
    );
    const caller = await Session.open('restore');
    const result = await refuseWithoutWaiting(
      context,
      probe,
      caller,
      holder,
      fixture,
      startRestore(caller, fixture),
    );
    refusal(result);
    assert.equal(
      await nowait(probe, targetRow(fixture)),
      '55P03',
      'refusal finished while target lock remains held',
    );
    await caller.query('commit;');
    await unchanged(probe, fixture, before, sourceBefore);
    assert.deepEqual(
      await facts(probe, fixture),
      expected,
      'refusal did not mutate the separate target',
    );
    await holder.query('rollback;');
  },
);

for (const kind of ['unassign', 'archive']) {
  await scenario(
    `RRV-R2-${kind} target-first wait precedes schema and rechecks caller visibility`,
    async (context) => {
      const fixture = prepare(`target-first-${kind}`);
      const probe = await observer();
      visiblePremise(await facts(probe, fixture));
      const before = await image(probe, fixture);
      const sourceBefore = await sourceImage(probe, fixture);
      const holder = await Session.open('holder');
      await holder.query(`begin; ${targetRow(fixture)} for update;`);
      assert.equal(
        await nowait(probe, targetRow(fixture)),
        '55P03',
        'exact target tuple locked first',
      );
      const caller = await Session.open('restore');
      const work = startRestore(caller, fixture);
      await blockedBy(probe, caller, holder, targetRow(fixture));
      // This is an actual NOWAIT row acquisition, not a source-token/order assertion.
      // It happens after A is observed waiting on B and BEFORE B mutates/commits.
      const schemaAvailability = await nowait(probe, schemaRow());
      await holder.query(`select set_config('app.cms_rpc', 'true', true);
      ${mutation(fixture, kind)} commit;`);
      const result = await bounded(
        work,
        'restore did not finish after exact target holder committed',
      );
      context.diagnostic(
        JSON.stringify({
          kind,
          schemaAvailability,
          state: result.state,
          message: result.message,
        }),
      );
      assert.equal(
        schemaAvailability,
        'free',
        'active schema is not locked before relation-target position 2',
      );
      refusal(result);
      // A wrong success/order leaves the caller open for owned cleanup rollback.
      await caller.query('commit;');
      await unchanged(probe, fixture, before, sourceBefore);
      assert.deepEqual(
        await facts(probe, fixture),
        {
          sourceAuthority: true,
          visible: false,
          lifecycle: kind === 'archive' ? 'archived' : 'active',
          targetVersion: '1',
          assignment: kind === 'unassign' ? 'revoked' : 'active',
          pins: [null],
        },
        'one legitimate target mutation is separate from the refused restore effects',
      );
    },
  );
}

await scenario(
  'RRV-R3 caller-first holds both target lifecycle and caller assignment writers until commit',
  async () => {
    const fixture = prepare('caller-first');
    const probe = await observer();
    visiblePremise(await facts(probe, fixture));
    const sourceBefore = await sourceImage(probe, fixture);
    const caller = await Session.open('restore');
    const result = await startRestore(caller, fixture);
    assert.equal(
      result.state,
      '00000',
      'public restore completes before rival writers are launched',
    );
    // A remains idle IN its original open transaction. No test trigger or provider
    // substitute establishes these locks; only the actual public restore can do so.
    const lifecycle = await Session.open('lifecycle');
    const assignment = await Session.open('assignment');
    const lifecycleWork =
      lifecycle.query(`begin; select set_config('app.cms_rpc', 'true', true);
    ${mutation(fixture, 'archive')}`);
    const assignmentWork =
      assignment.query(`begin; select set_config('app.cms_rpc', 'true', true);
    ${mutation(fixture, 'unassign')}`);
    lifecycleWork.catch(() => {});
    assignmentWork.catch(() => {});
    await blockedBy(probe, lifecycle, caller, targetRow(fixture));
    await blockedBy(probe, assignment, caller, assignmentRow(fixture));
    // Both independent wait edges have been observed before releasing A.
    await caller.query('commit;');
    await bounded(
      lifecycleWork,
      'lifecycle writer did not resume after restore commit',
    );
    await bounded(
      assignmentWork,
      'assignment writer did not resume after restore commit',
    );
    await lifecycle.query('commit;');
    await assignment.query('commit;');
    await success(probe, fixture, result, sourceBefore);
    assert.deepEqual(
      await facts(probe, fixture),
      {
        sourceAuthority: true,
        visible: false,
        lifecycle: 'archived',
        targetVersion: '1',
        assignment: 'revoked',
        pins: [null],
      },
      'both actual guarded target mutations commit only after the successful restore',
    );
    assert.equal(
      ids().creatorAuth.length,
      36,
      'fixture uses the real bound auth actor, not a person UUID substitute',
    );
  },
);
