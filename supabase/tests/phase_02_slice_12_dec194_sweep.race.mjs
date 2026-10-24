#!/usr/bin/env node
/** DEC-194 producer linearization. Standalone: NEVER import for syntax checking.
 * Runs in the canonical db:verify gate (WEJAMMIN_CANONICAL_RACE=1, infra/database-races/canonical-mode.mjs) or, by hand, in root's ALT mode
 * with its explicit release.
 * Needs a freshly reset database. No trigger, disabled guard or SQL sleep.
 * Direct PostgreSQL READ COMMITTED is asserted; hosted/PostgREST isolation is separate.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answer,
  blocked,
  cleanupSessions,
  commit,
  configureFixture,
  container,
  delta,
  holdReceipt,
  jsonb,
  outcome,
  query,
  ready,
  sql,
  start,
  testsDir,
  until,
} from './phase_02_slice_12_dec194_sweep/091-race-session-kit.mjs';
import {
  assertCanonicalTarget,
  assertRaceCheckout,
  canonicalContainer,
  isCanonicalRace,
} from '../../infra/database-races/canonical-mode.mjs';

const root = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
);
// DEC-225: the primary checkout is refused in ALT mode only (one rule, in the helper).
assertRaceCheckout({ root });
if (isCanonicalRace()) {
  // Canonical db:verify mode (set by infra/run-database-race-runners.mjs): the container
  // of the Slice 10 and 11 runners, after the gate's db:reset. No ALT release.
  assertCanonicalTarget({
    altEnvNames: [
      'S12_DEC194_RACE_ROOT_RELEASE',
      'S12_DEC194_RACE_ALT_CONTAINER',
    ],
  });
  assert.equal(
    container,
    canonicalContainer(),
    'canonical target must match the existing psql kit',
  );
} else {
  assert.equal(
    process.env.S12_DEC194_RACE_ROOT_RELEASE,
    '2026-10-16-native-red',
    'explicit root ALT release required',
  );
  assert.ok(
    process.env.S10_RACE_DB_CONTAINER,
    'default/fallback seeded database is forbidden',
  );
  assert.equal(
    container,
    process.env.S12_DEC194_RACE_ALT_CONTAINER,
    'explicit ALT target must match the existing psql kit',
  );
  assert.match(
    container,
    /^supabase_db_[a-z0-9_-]+$/iu,
    'named local Supabase ALT container required',
  );
  assert.notEqual(
    container.toLowerCase(),
    'supabase_db_wejammin',
    'primary/default seeded database is forbidden',
  );
}

const fragment = (p) => readFileSync(join(testsDir, p), 'utf8');
const base = [
  'phase_02_slice_09_dec108/00-helpers.sqlinc',
  'phase_02_slice_09_dec108/02-chain.sqlinc',
  'phase_02_slice_09_dec119/00-support.sqlinc',
];
const later = [
  'phase_02_slice_12_governed_assignment/000-world.sqlinc',
  'phase_02_slice_12_governed_activation/000-world.sqlinc',
  'phase_02_slice_12_taxonomy_terms/000-world.sqlinc',
  'phase_02_slice_12_dec194_sweep/000-helpers.sqlinc',
  'phase_02_slice_12_dec194_sweep/090-race-fixture.sqlinc',
];
const begin =
  "begin isolation level read committed; select set_config('app.cms_rpc', 'true', true);";
const helpers = [
  fragment('support/jwt-claims.sqlinc'),
  ...base.map(fragment),
  'insert into s09d_actor select * from public.s12dcr_actor; insert into s09d_ids select * from public.s12dcr_base;',
  fragment('phase_02_slice_12_governed_submit/000-fixtures.sqlinc'),
  'insert into s12gov_ids select * from public.s12dcr_gov on conflict (key) do update set value = excluded.value;',
  ...later.map(fragment),
].join('\n');
const tx = (body) => `${begin}\n${helpers}\n${body}`;
configureFixture(tx);
const hash = (value) =>
  `\\x${createHash('sha256').update(value).digest('hex')}`;

const stage = async (body) => JSON.parse(await query(body, true));
const snapshot = () => stage('select pg_temp.s12dcr_snapshot();');
async function prepared(label, failures = 1) {
  const ids = await stage(
    `select pg_temp.s12dcr_prepare(${sql(label)}, ${failures});`,
  );
  console.log(
    `ok - ${label} fixture: Q=${ids.q}; no live Job, idle >=20m, failed streak=${failures}, work=3, latest failed identity asserted`,
  );
  return ids;
}
const sweep = (label) =>
  start(
    label,
    `${begin} set local role service_role;
  select current_setting('transaction_isolation'); select platform_api.cms_reconcile_taxonomy_merge_converge();`,
    true,
  );
const ordinary = (ids, finish = null, old = false, extra = '') =>
  start(
    'ordinary',
    tx(
      `select pg_temp.s12dcr_ordinary(${jsonb(ids)}, ${finish === null ? 'null' : sql(finish)}, ${old}); ${extra}`,
    ),
    true,
  );
const transport = (claim) => `${begin} set local role service_role;
  select set_config('app.cms_rpc', '', true); select platform_api.cms_run_taxonomy_merge_converge(${jsonb(claim)}); commit;`;
const key = (kind, id) =>
  `cms.taxonomy.merge_converge${kind ? `.${kind}` : ''}:${id}`;
const receipt = async (ids, kind, id) => {
  const k = key(kind, id);
  return query(
    `select pg_temp.s12dcr_reserve(${sql(ids.actor)}::uuid, ${sql(k)},
    ${sql(`${k.slice(0, k.lastIndexOf(':'))}:${ids.party}:${id}`)});`,
    true,
  );
};
function accepted(
  state,
  jobId,
  ids,
  { correlation, idemKey, expectedState = 'queued' },
) {
  const j = state.jobs.find((row) => row.id === jobId);
  assert.ok(j, 'accepted Job exists');
  assert.deepEqual(
    [j.actor_id, j.acting_party_id, j.correlation_id, j.job_type, j.state],
    [
      ids.actor,
      ids.party,
      correlation,
      'cms.taxonomy.merge_converge',
      expectedState,
    ],
  );
  if (expectedState === 'queued')
    assert.equal(j.version, 1, 'fresh queued Job v1');
  const events = state.events.filter((e) => e.aggregate_id === jobId);
  assert.equal(events.length, 1, 'exactly one requested outbox event');
  assert.deepEqual(
    [
      events[0].id,
      events[0].aggregate_type,
      events[0].aggregate_version,
      events[0].schema_version,
      events[0].correlation_id,
      events[0].payload,
    ],
    [
      j.originating_event_id,
      'job',
      1,
      1,
      correlation,
      { jobId, jobType: 'cms.taxonomy.merge_converge' },
    ],
  );
  const audits = state.audit.filter((a) => a.target_id === jobId);
  assert.equal(audits.length, 1, 'exactly one acceptance audit');
  assert.deepEqual(
    [
      audits[0].actor_id,
      audits[0].acting_party_id,
      audits[0].correlation_id,
      audits[0].decision,
      audits[0].reason_code,
    ],
    [ids.actor, ids.party, correlation, 'allowed', 'JOB_ACCEPTED'],
  );
  assert.equal(audits[0].target_type, 'job');
  const receipts = state.receipts.filter(
    (r) => r.actor_id === ids.actor && r.key_hash === hash(idemKey),
  );
  assert.equal(receipts.length, 1, 'exactly one derived receipt');
  assert.equal(receipts[0].state, 'completed');
  assert.equal(
    receipts[0].request_hash,
    hash(
      `${idemKey.slice(0, idemKey.lastIndexOf(':'))}:${ids.party}:${idemKey.slice(idemKey.lastIndexOf(':') + 1)}`,
    ),
  );
  assert.deepEqual(receipts[0].response_ref, {
    status: 202,
    jobRef: jobId,
    resourceRef: `/api/v1/jobs/${jobId}`,
  });
}
const association = (q) =>
  query(
    `select coalesce(pg_temp.s12dc_assoc_job(${sql(q)}::uuid)::text, 'none');`,
    true,
  );
const claimed = (ids, seconds = 840) =>
  stage(`select pg_temp.s12dcr_claim(${jsonb(ids)}, ${seconds});`);
function conflict(result) {
  assert.notEqual(result.code, 0, 'stale continuation refuses');
  assert.match(
    result.stderr,
    /ERROR:\s+P0001:\s+CONFLICT\b/u,
    'typed claim conflict',
  );
  assert.ok(
    !result.stdout.split('\n').some((line) => line.startsWith('{')),
    'refusal exposes no result',
  );
}

let bootstrapOwned = false;
let primaryFailure;
try {
  assert.equal(
    await query("select current_setting('transaction_isolation');"),
    'read committed',
    'direct session isolation control',
  );
  assert.equal(
    await query(
      "select to_regclass('public.s12dcr_actor') is null and to_regclass('public.s12dcr_base') is null and to_regclass('public.s12dcr_gov') is null and to_regclass('public.s12dcr_cases') is null and not exists (select 1 from platform_private.cms_terms);",
    ),
    't',
    'fresh ALT fixture prerequisite',
  );
  const bootstrap = [
    fragment('support/jwt-claims.sqlinc'),
    begin,
    'create extension if not exists pgtap with schema extensions; select no_plan();',
    fragment(base[0]),
    fragment('phase_02_slice_09_dec108/01-actors.sqlinc'),
    ...base.slice(1).map(fragment),
    "select pg_temp.s09d_session('owner', 'authenticated');",
    fragment('phase_02_slice_12_governed_submit/000-fixtures.sqlinc'),
    fragment('phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc'),
    ...later.slice(0, 3).map(fragment),
    fragment('phase_02_slice_12_taxonomy_terms/010-setup.sqlinc'),
    fragment(later[3]),
    fragment(later[4]),
    'create table public.s12dcr_actor as table s09d_actor; create table public.s12dcr_base as table s09d_ids;',
    'create table public.s12dcr_gov as table s12gov_ids; create table public.s12dcr_cases(label text primary key, ids jsonb not null);',
    'revoke all on public.s12dcr_actor, public.s12dcr_base, public.s12dcr_gov, public.s12dcr_cases from public, anon, authenticated, service_role;',
    "select pg_temp.s12dcr_assert(pg_temp.s12tt_active(pg_temp.s12tt_lineage('vf')) = '1', 'real active vocabulary');",
    'commit;',
    "select 'fixture-built';",
  ].join('\n');
  bootstrapOwned = true;
  assert.equal(await query(bootstrap, false, true), 'fixture-built');

  // S1/S2: sweep has passed eligibility and entered the REAL acceptance receipt
  // FOR UPDATE. Its party mutex must exclude either competing producer until COMMIT.
  for (const competitor of ['ordinary', 'stale-continuation']) {
    const ids = await prepared(competitor === 'ordinary' ? 's1' : 's2');
    const r = await receipt(ids, 'reconcile', ids.q);
    const before = await snapshot();
    const holder = await holdReceipt(r);
    const recovery = sweep('sweep-first');
    await blocked(
      'sweep reaches exact reserved receipt FOR UPDATE after eligibility',
      recovery,
      holder,
      false,
    );
    const other =
      competitor === 'ordinary'
        ? ordinary(ids)
        : start('stale-continuation', transport(ids.staleClaim));
    await blocked(
      `${competitor} waits on sweep-held party advisory mutex`,
      other,
      recovery,
      true,
    );
    await commit(holder);
    await ready(recovery);
    assert.deepEqual(answer(recovery), { requested: 1 });
    assert.deepEqual(
      await snapshot(),
      before,
      'uncommitted recovery effects remain invisible together',
    );
    await commit(recovery);
    if (competitor === 'ordinary') await ready(other);
    else conflict(await outcome(other));
    const recoveryState = await snapshot();
    const [recovered] = delta(before, recoveryState, 1, {
      receiptCount: 0,
      mutable: [r],
    });
    accepted(recoveryState, recovered.id, ids, {
      correlation: ids.correlation,
      idemKey: key('reconcile', ids.q),
    });
    assert.equal(
      await association(ids.q),
      recovered.id,
      'one durable Q to R association commits with acceptance',
    );
    if (competitor === 'ordinary') {
      const ordinaryJob = answer(other).jobId;
      await commit(other);
      const final = await snapshot();
      delta(recoveryState, final, 1);
      accepted(final, ordinaryJob, ids, {
        correlation: ids.ordinaryCorrelation,
        idemKey: key('', ids.term),
      });
    }
  }

  // S3-S8: a producer is accepted but uncommitted when recovery starts. A shared
  // mutex must make recovery wait, then refresh EACH admission fact and failed Q.
  for (const mode of [
    'live',
    'fresh-failure',
    'latest-failure',
    'third-failure',
    'no-work',
    'cooldown',
  ]) {
    const ids = await prepared(
      `p${mode.split('-')[0]}`,
      mode === 'third-failure' ? 2 : 1,
    );
    const before = await snapshot();
    const finish =
      mode === 'live' ? null : mode === 'no-work' ? 'cancelled' : 'failed';
    const producer = ordinary(
      ids,
      finish,
      !['fresh-failure', 'cooldown'].includes(mode),
      mode === 'no-work'
        ? 'select pg_temp.s12dcr_drain();'
        : mode === 'cooldown'
          ? 'select pg_temp.s12dcr_cooldown();'
          : '',
    );
    await ready(producer);
    assert.deepEqual(
      await snapshot(),
      before,
      'producer acceptance is still uncommitted',
    );
    const recovery = sweep('producer-first');
    await blocked(
      `${mode}: recovery waits on producer-held party advisory mutex`,
      recovery,
      producer,
      true,
    );
    const ordinaryJob = answer(producer).jobId;
    if (mode === 'cooldown') {
      const cutoff = sql(answer(producer).eligibleAt);
      assert.equal(
        await query(`select clock_timestamp() < ${cutoff}::timestamptz;`),
        't',
        'sweep entered before the 15m cutoff',
      );
      await until(
        'actual 15m cooldown cutoff',
        async () =>
          (await query(
            `select clock_timestamp() >= ${cutoff}::timestamptz;`,
          )) === 't',
        [producer, recovery],
        12000,
      );
    }
    await commit(producer);
    const facts = await stage(
      `select pg_temp.s12dcr_facts(${sql(ids.party)}::uuid);`,
    );
    assert.equal(
      facts.live,
      mode === 'live' ? 1 : 0,
      `${mode}: live-job conjunct`,
    );
    assert.equal(
      facts.work,
      mode === 'no-work' ? 0 : 3,
      `${mode}: work conjunct`,
    );
    assert.equal(
      facts.streak,
      mode === 'third-failure' ? 3 : finish === 'failed' ? 2 : 0,
      `${mode}: failed-streak conjunct`,
    );
    assert.ok(
      mode === 'fresh-failure'
        ? facts.idle < 15
        : facts.idle >= (mode === 'cooldown' ? 15 : 20),
      `${mode}: activity conjunct`,
    );
    assert.equal(
      facts.head,
      finish === 'failed' ? ordinaryJob : ids.q,
      `${mode}: latest-failed identity`,
    );
    await ready(recovery);
    const expected = ['latest-failure', 'cooldown'].includes(mode) ? 1 : 0;
    assert.deepEqual(
      answer(recovery),
      { requested: expected },
      `${mode}: post-wait admission`,
    );
    await commit(recovery);
    const final = await snapshot();
    const added = delta(before, final, 1 + expected, {
      stores: mode !== 'no-work',
    });
    accepted(final, ordinaryJob, ids, {
      correlation: ids.ordinaryCorrelation,
      idemKey: key('', ids.term),
      expectedState: finish ?? 'queued',
    });
    assert.equal(
      await association(ids.q),
      'none',
      'old Q was not recovered from a stale candidate',
    );
    if (expected) {
      const r = added.find((j) => j.id !== ordinaryJob);
      accepted(final, r.id, ids, {
        correlation: ids.ordinaryCorrelation,
        idemKey: key('reconcile', ordinaryJob),
      });
      assert.equal(
        await association(ordinaryJob),
        r.id,
        'post-wait latest failed Q is the recovery identity',
      );
    }
    if (mode === 'no-work')
      assert.equal(
        await query(
          `select pg_temp.s12tt_work(${sql(ids.party)}::uuid);`,
          true,
        ),
        '0',
      );
  }

  // S9: real fenced continuation is the first producer. Its own receipt pauses
  // after one assignment; recovery waits then sees the live committed chain.
  const ids = await prepared('cfirst');
  const claim = await claimed(ids);
  const continuationId = claim.claimedJob.jobId;
  const r = await receipt(ids, 'continuation', continuationId);
  const before = await snapshot();
  const holder = await holdReceipt(r);
  const continuation = start('continuation-first', transport(claim));
  await blocked(
    'continuation reaches its real receipt FOR UPDATE',
    continuation,
    holder,
    false,
  );
  // The continuation took the party mutex before its domain locks (20261014190040), so it holds it here.
  assert.equal(
    await query(`select exists (select 1 from pg_locks l
      where l.pid = ${continuation.pid} and l.locktype = 'advisory' and l.granted
        and l.mode = 'ExclusiveLock' and l.objsubid = 1
        and l.classid = ((k.key >> 32) & 4294967295)::oid
        and l.objid = (k.key & 4294967295)::oid)
      from (select pg_catalog.hashtextextended('cms.taxonomy.merge.enqueue:' || ${sql(ids.party)}::uuid::text, 0) as key) k;`),
    't',
    'continuation holds the party enqueue mutex at its receipt wait',
  );
  // PREMISE CORRECTION (was: recovery waits on the continuation-held mutex). The claimed continuation Job is
  // committed and 'running', and the sweep's lock-free routing scan excludes every party with a queued or running
  // Job of the type before it takes any mutex (20261014190050, review R2-03; BE03c "Merge convergence recovery":
  // "has no queued or running Job of the type"). The sweep therefore completes at once while the continuation
  // still holds the mutex and waits on its receipt. A sweep that DOES wait on the mutex is the sweep-first and
  // producer-held scenarios above/below (their Job is not yet committed or not yet running).
  const recovery = sweep('after-continuation');
  await ready(recovery);
  assert.ok(
    !continuation.settled,
    'recovery completed while the continuation still held the mutex and its receipt wait',
  );
  console.log(
    'ok - recovery routes past a party with a running continuation Job without waiting on the mutex it holds',
  );
  await commit(holder);
  const result = await outcome(continuation);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(answer(continuation).converged, 1);
  assert.equal(answer(continuation).remaining, 2);
  await ready(recovery);
  assert.deepEqual(answer(recovery), { requested: 0 });
  await commit(recovery);
  const final = await snapshot();
  delta(before, final, 1, { receiptCount: 0, mutable: [r], stores: false });
  const source = final.jobs.find((j) => j.id === continuationId);
  accepted(final, answer(continuation).continuationJobId, ids, {
    correlation: source.correlation_id,
    idemKey: key('continuation', continuationId),
  });
  assert.equal(await association(ids.q), 'none');

  // S10-S12: a valid claim waits behind an ordinary producer. BE00 may finish,
  // expire or reclaim it meanwhile; the stale delivery must write nothing.
  for (const mode of ['terminal', 'expired', 'reclaimed']) {
    const ids = await prepared(`f${mode}`);
    const claim = await claimed(ids, mode === 'terminal' ? 840 : 8);
    const producer = ordinary(ids);
    await ready(producer);
    const delivery = start(`fence-${mode}`, transport(claim));
    await blocked(
      `${mode}: valid continuation waits on party mutex`,
      delivery,
      producer,
      true,
    );
    const c = claim.claimedJob;
    assert.equal(
      await query(`select state = 'running' and version = ${c.version} and lease_token = ${sql(c.leaseToken)}::uuid
      and lease_until > clock_timestamp() from platform_private.jobs where id = ${sql(c.jobId)}::uuid;`),
      't',
      'claim was valid at the observed wait',
    );
    if (mode === 'terminal')
      assert.equal(
        await query(`begin; set local role service_role;
      select platform_api.apply_job_outcome(${sql(c.jobId)}::uuid, ${c.version}, ${sql(c.leaseToken)}::uuid, 'cancelled', null, 'S12_RACE_TERMINAL', false); commit;`),
        't',
      );
    else {
      await until(
        'actual lease expiration',
        async () =>
          (await query(
            `select lease_until <= clock_timestamp() from platform_private.jobs where id = ${sql(c.jobId)}::uuid;`,
          )) === 't',
        [delivery, producer],
        12000,
      );
      if (mode === 'reclaimed')
        assert.equal(
          await query(`begin; set local role service_role;
        select count(*) from platform_api.claim_job(${sql(c.jobId)}::uuid, ${c.version}, ${sql(randomUUID())}::uuid, 840); commit;`),
          '1',
        );
    }
    const before = await snapshot();
    const ordinaryJob = answer(producer).jobId;
    await commit(producer);
    conflict(await outcome(delivery));
    const final = await snapshot();
    delta(before, final, 1);
    accepted(final, ordinaryJob, ids, {
      correlation: ids.ordinaryCorrelation,
      idemKey: key('', ids.term),
    });
    assert.equal(
      final.association,
      before.association,
      'stale delivery creates no association',
    );
  }
} catch (error) {
  primaryFailure = error;
} finally {
  const errors = await cleanupSessions(
    bootstrapOwned
      ? 'set client_min_messages = warning; drop table if exists public.s12dcr_cases, public.s12dcr_gov, public.s12dcr_base, public.s12dcr_actor;'
      : null,
  );
  if (primaryFailure || errors.length)
    throw new AggregateError(
      [primaryFailure, ...errors].filter(Boolean),
      'DEC-194 race/cleanup failed',
    );
}
console.log(
  '# DEC-194 race witnesses passed; reset the database before reusing the fixture',
);
