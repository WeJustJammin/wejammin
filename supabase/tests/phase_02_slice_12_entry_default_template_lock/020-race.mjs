import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bounded,
  cleanup,
  edge,
  hold,
  image,
  nowait,
  observer,
  prepare,
  Session,
  startCreate,
} from './030-race-fixture.mjs';
import {
  stored,
  publicSuccess,
  literalRows,
  order,
} from './060-race-assertions.mjs';

// Importing support modules starts no process, database call, service or fixture.
// Only these explicitly released test callbacks may operate on the exact ALT.
function capture(errors, assertion) {
  try {
    assertion();
  } catch (error) {
    errors.push(error);
  }
}

async function finish(before, errors, works = []) {
  let drained = true;
  try {
    await cleanup();
  } catch (error) {
    errors.push(error);
    drained = false;
  }
  try {
    await bounded(
      Promise.allSettled(works),
      'producer callbacks did not drain',
      5_000,
    );
  } catch (error) {
    errors.push(error);
    drained = false;
  }
  if (!drained || !before) return;
  try {
    const probe = await observer('post-image');
    const after = await image(probe);
    assert.deepEqual(
      Object.keys(after),
      Object.keys(before),
      'complete store inventory unchanged',
    );
    assert.deepEqual(
      after,
      before,
      'all complete CMS/idempotency/audit/outbox rows restored, no target exclusions or timestamp stripping',
    );
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
}

function fail(errors, label) {
  if (errors.length)
    throw new AggregateError(errors, label, { cause: errors[0] });
}

function diagnose(context, errors, stage) {
  if (!errors.length) return;
  const type = errors[0]?.code === 'ERR_ASSERTION' ? 'assertion' : 'error';
  context.diagnostic(`first-cause stage=${stage} type=${type}`);
}

async function control(context, fixture) {
  const errors = [];
  const works = [];
  let before;
  let stage = 'control-setup';
  try {
    const probe = await observer('control-observer');
    before = await image(probe);
    const caller = await Session.open('control-create');
    const { body, work } = startCreate(caller, fixture, 'CONTROL');
    works.push(work);
    const result = await bounded(
      work,
      'unblocked authorized control did not complete',
    );
    stage = 'control-oracle';
    publicSuccess(result, body);
    const actual = await stored(caller, fixture, result.response, 'CONTROL');
    context.diagnostic(
      JSON.stringify({
        case: 'CONTROL',
        observedPin: actual.revision.template_version_id,
      }),
    );
    literalRows(actual, fixture, result.response, 'CONTROL', before);
    // Existing76 retains the exact T1 pin oracle. The unblocked control establishes
    // authority/fixture viability without preventing the old NULL body reaching RED.
  } catch (error) {
    errors.push(error);
  } finally {
    if (!errors.length) stage = 'cleanup';
    await finish(before, errors, works);
  }
  diagnose(context, errors, stage);
  fail(errors, 'EDTL-C00 setup/public-control or rollback failure');
}

async function gate(session, caller, holder, work) {
  const state = { completed: false };
  work.then(
    (result) => Object.assign(state, { completed: true, result }),
    (error) => Object.assign(state, { completed: true, error }),
  );
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const witness = await edge(session, caller, holder);
    if (witness.blocked) return { kind: 'blocked', witness };
    if (state.completed) {
      if (state.error) throw state.error;
      return { kind: 'completed', result: state.result, witness };
    }
  }
  throw new Error(
    'SETUP/BARRIER: no exact owned edge or completed command before deadline',
  );
}

async function runOrder(context, fixture, mode) {
  const errors = [];
  const works = [];
  const heldKind = mode === 'A' ? 'target' : 'template';
  const table = mode === 'A' ? 'cms_content_entries' : 'cms_template_versions';
  let before;
  let observation;
  let stage = 'holder-setup';
  try {
    const probe = await observer(`${mode}-observer`);
    before = await image(probe);
    const holder = await Session.open(`${mode}-holder`);
    const tuple = await hold(holder, fixture, heldKind);
    assert.equal(tuple.id, fixture[heldKind]);
    assert.match(tuple.tuple_id, /^\(\d+,\d+\)$/u, 'actual held tuple CTID');
    const expectedOid = (
      await probe.query(`select 'platform_private.${table}'::regclass::oid;`)
    ).at(-1);
    for (const value of [tuple.table_oid, expectedOid])
      assert.match(
        value,
        /^[1-9][0-9]*$/u,
        'catalog OID is canonical decimal text',
      );
    assert.equal(
      tuple.table_oid,
      expectedOid,
      'held tuple belongs to the exact expected catalog relation',
    );
    assert.equal(
      await nowait(probe, fixture, heldKind),
      '55P03',
      'holder established before create',
    );
    assert.equal(
      await nowait(probe, fixture, 'schema'),
      'free',
      'no preexisting schema blocker',
    );
    assert.equal(
      await nowait(probe, fixture, mode === 'A' ? 'template' : 'target'),
      'free',
      'no preexisting later/earlier dependency blocker',
    );
    const caller = await Session.open(`${mode}-create`);
    const { body, work } = startCreate(caller, fixture, mode);
    works.push(work);
    stage = 'order-evidence';
    const reached = await gate(probe, caller, holder, work);
    observation = {
      case: mode,
      tuple,
      holderName: holder.name,
      callerName: caller.name,
      gate: reached,
      held: await nowait(probe, fixture, heldKind),
      target: await nowait(probe, fixture, 'target'),
      template: await nowait(probe, fixture, 'template'),
      schema: await nowait(probe, fixture, 'schema'),
      after: await edge(probe, caller, holder),
    };
    // Preserve the actual edge/completion and all NOWAIT results before assertions.
    context.diagnostic(
      JSON.stringify({ phase: 'before-release', ...observation }),
    );
    await holder.query('rollback;');
    const result = await bounded(
      work,
      'create did not drain after releasing exact holder',
    );
    context.diagnostic(
      JSON.stringify({ case: mode, phase: 'after-release', result }),
    );
    stage = 'post-release-oracle';
    if (reached.kind === 'completed' && result.state !== '00000') {
      errors.push(
        new Error(
          `SETUP/COMMAND: early refusal is not lock-order proof: ${result.message}`,
        ),
      );
    } else capture(errors, () => order(observation, mode));
    capture(errors, () => publicSuccess(result, body));
    if (
      result.state === '00000' &&
      result.response?.entry?.id &&
      result.response?.revision?.id
    ) {
      const actual = await stored(caller, fixture, result.response, mode);
      context.diagnostic(
        JSON.stringify({ case: mode, phase: 'stored', actual }),
      );
      capture(errors, () =>
        literalRows(actual, fixture, result.response, mode, before),
      );
      // Independent post-release pin oracle remains even when order was already RED.
      capture(errors, () =>
        assert.equal(
          actual.revision.template_version_id,
          fixture.template,
          'PIN: actual first revision must independently store exact governed T1',
        ),
      );
    }
  } catch (error) {
    errors.push(error);
  } finally {
    if (!errors.length) stage = 'cleanup';
    await finish(before, errors, works);
  }
  diagnose(context, errors, stage);
  fail(errors, `EDTL-${mode}: order evidence and independent post-release pin`);
}

await test(
  'DEC-202 real public create relation2/default3/schema4',
  { timeout: 360_000 },
  async (context) => {
    let fixture;
    let controlPassed = false;
    try {
      fixture = await prepare((manifest) =>
        context.diagnostic(JSON.stringify(manifest)),
      );
      await cleanup();
      await context.test(
        'EDTL-C00 unblocked authorized literal relation control',
        { timeout: 75_000 },
        async (child) => {
          await control(child, fixture);
          controlPassed = true;
          // node:test prints "ok 1 - name"; the race gate counts "ok - " receipts.
          console.log(`ok - ${child.name}`);
        },
      );
      assert.equal(
        controlPassed,
        true,
        'SETUP: both order cases require a passing actual public control',
      );
      await context.test(
        'EDTL-A held relation2 leaves exact default3/schema4 free',
        { timeout: 75_000 },
        async (child) => {
          await runOrder(child, fixture, 'A');
          console.log(`ok - ${child.name}`);
        },
      );
      await context.test(
        'EDTL-B held exact default3 leaves schema4 free',
        { timeout: 75_000 },
        async (child) => {
          await runOrder(child, fixture, 'B');
          console.log(`ok - ${child.name}`);
        },
      );
    } finally {
      await cleanup();
    }
  },
);
