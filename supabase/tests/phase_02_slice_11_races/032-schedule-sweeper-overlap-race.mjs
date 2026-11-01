#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence, with an OVERLAP BARRIER, for two concurrent scheduled sweepers of CMS-03B-20
 * (`cms_claim_due_publication_schedules`; BE03b "Schedule execution": the claim runs `FOR UPDATE SKIP LOCKED`, so two
 * sweepers never claim or recover the same schedule and never wait for each other; tracker P2-S11-AC-084; review
 * finding A-M11).  013-schedule-claim-race.mjs starts its sweepers together with `Promise.all` and holds a raw
 * `FOR UPDATE` session for the skip case; neither parks a SWEEPER, so a serial execution produces the same outcome.
 * Here the first sweeper is parked INSIDE its transaction after it has claimed (or recovered) its rows, so the second
 * sweeper provably runs while the first still holds its row locks:
 *
 *   The gate is a test probe: an AFTER UPDATE FOR EACH STATEMENT trigger on cms_publication_schedules that parks a
 *   session whose application_name is `s11race-claimgate-<gateKey>-<label>` on a shared advisory lock, i.e. after the
 *   claim's UPDATE ran for every row it took and before the transaction commits.  The kit's closeGate / openGate /
 *   waitParked close, open and observe it.
 *
 *   D1  eight due schedules.  Sweeper A (batch 4) is parked after its UPDATE.  Witnesses while it is parked: its
 *       backend waits on the advisory gate; exactly four of the eight due rows are row-locked by it (a third session's
 *       FOR UPDATE SKIP LOCKED sees only the other four) and to every other session all eight are still `pending` at
 *       version 1 (nothing committed).  Sweeper B (batch 4) then runs and COMPLETES while A is still parked - it did not
 *       wait on A - claiming exactly the four rows A does not hold; a third sweeper C finds nothing and completes too.
 *       After the gate opens A commits its four: the two claim sets are disjoint, together they are all eight
 *       schedules, each under its own lease at version 2, A's set is exactly the set that was row-locked.
 *   D2  one executing schedule whose lease expired.  Sweeper A is parked after recovering it (the row lock is held,
 *       uncommitted).  Sweeper B runs and completes while A is parked: it SKIPS the locked row (no wait, no second
 *       recovery) and claims nothing.  After the gate opens the schedule is `failed_retryable` at attempt 1 with exactly
 *       one recovery audit record.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as raceKit from '../../../infra/database-races/race-kit.mjs';
import * as kit from '../../../infra/database-races/publication-kit.mjs';

const { check } = kit;
const ids = kit.buildPublicationFixture();
const GATE = 7721;
const sweeperApp = (label) => `s11race-claimgate-${GATE}-${label}`;

/** The claim gate trigger (a test probe; see the header). */
const installClaimGate = () =>
  raceKit.runScript(
    `
create or replace function public.s11race_claim_gate() returns trigger
language plpgsql security definer set search_path = ''
as $f$
declare
  app text := pg_catalog.current_setting('application_name', true);
begin
  if app like 's11race-claimgate-%' then
    perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.split_part(app, '-', 3)::bigint);
  end if;
  return null;
end;
$f$;
revoke all on function public.s11race_claim_gate() from public;
grant execute on function public.s11race_claim_gate() to public;
drop trigger if exists cms_publication_schedules_zz_s11race_claim_gate on platform_private.cms_publication_schedules;
create trigger cms_publication_schedules_zz_s11race_claim_gate
  after update on platform_private.cms_publication_schedules
  for each statement execute function public.s11race_claim_gate();
select '{}';
`,
    's11race-claimgate-install',
  );

/** The ids (comma list, sorted) of the given schedules that a third session CAN lock right now in the given state. */
const lockable = (tags, state) =>
  kit
    .runValue(
      `select coalesce(string_agg(id::text, ',' order by id), '') from (
       select id from platform_private.cms_publication_schedules
        where id in (${tags.map((tag) => kit.sql(ids.schedules[tag])).join(', ')}) and state = ${kit.sql(state)}
          for update skip locked) free;`,
    )
    .split(',')
    .filter(Boolean);

const idsOf = (tags) => tags.map((tag) => ids.schedules[tag]).sort();

try {
  installClaimGate();

  // ------------------------------------------------------------ D1 ----
  const due = Array.from({ length: 8 }, (_, index) => `cr-${index + 1}`);
  kit.makeDue(ids, due);
  await kit.closeGate(GATE);
  const appA = sweeperApp('a');
  const sweeperA = kit.claimAsync(4, appA);
  await kit.waitParked(appA);
  check(
    kit.waitEvent(appA) === 'Lock:advisory',
    'D1: sweeper A is parked inside its transaction on the gate, after its claim UPDATE and before its commit',
  );
  const free = lockable(due, 'pending');
  const heldByA = idsOf(due).filter((id) => !free.includes(id));
  check(
    free.length === 4 && heldByA.length === 4,
    `D1: while A is parked it row-locks exactly four of the eight due schedules (${heldByA.length} held, ${free.length} lockable by a third session)`,
  );
  check(
    due.every((tag) => kit.scheduleState(ids, tag) === 'pending/1/0/-/-'),
    'D1: to every other session all eight schedules are still pending at version 1: A has claimed nothing durable yet',
  );

  const sweeperB = kit.claimAsync(4, 's11race-claim-overlap-b');
  check(
    (await kit.blockedOrCompleted(
      's11race-claim-overlap-b',
      sweeperB.session,
    )) === 'completed',
    'D1: sweeper B runs and COMPLETES while sweeper A is parked holding its row locks: it does not wait for A (SKIP LOCKED)',
  );
  const claimedByB = await sweeperB.done;
  check(
    kit.waitEvent(appA) === 'Lock:advisory',
    'D1: A is STILL parked after B finished: the two sweepers genuinely overlapped',
  );
  const bIds = (claimedByB.response ?? [])
    .map((entry) => entry.scheduleId)
    .sort();
  check(
    claimedByB.code === 0 &&
      bIds.length === 4 &&
      JSON.stringify(bIds) === JSON.stringify([...free].sort()),
    `D1: B claimed exactly the four schedules A does not hold (${bIds.length} claimed)`,
  );
  check(
    heldByA.every(
      (id) =>
        kit.runValue(
          `select state || '/' || version from platform_private.cms_publication_schedules where id = ${kit.sql(id)};`,
        ) === 'pending/1',
    ) &&
      bIds.every(
        (id) =>
          kit.runValue(
            `select state || '/' || version from platform_private.cms_publication_schedules where id = ${kit.sql(id)};`,
          ) === 'executing/2',
      ),
    'D1: the four of sweeper B are committed executing at version 2 while the four of sweeper A are still pending at version 1',
  );
  const sweeperC = kit.claim(4, 's11race-claim-overlap-c');
  check(
    sweeperC.code === 0 &&
      Array.isArray(sweeperC.response) &&
      sweeperC.response.length === 0 &&
      kit.waitEvent(appA) === 'Lock:advisory',
    'D1: a third sweeper finds nothing to claim (the rows of A are locked, those of B claimed) and completes while A is still parked',
  );

  await kit.openGate(GATE);
  const claimedByA = await sweeperA.done;
  const aIds = (claimedByA.response ?? [])
    .map((entry) => entry.scheduleId)
    .sort();
  check(
    claimedByA.code === 0 &&
      aIds.length === 4 &&
      JSON.stringify(aIds) === JSON.stringify(heldByA),
    `D1: once the gate opens A commits exactly the four schedules it was holding (${aIds.length} claimed)`,
  );
  check(
    aIds.every((id) => !bIds.includes(id)) &&
      new Set([...aIds, ...bIds]).size === 8 &&
      due.every((tag) => [...aIds, ...bIds].includes(ids.schedules[tag])),
    'D1: the two claim sets are disjoint and together are all eight due schedules: none claimed twice, none lost',
  );
  const leases = [...claimedByA.response, ...claimedByB.response].map(
    (entry) => entry.leaseId,
  );
  check(
    new Set(leases).size === 8 &&
      due.every(
        (tag) => kit.scheduleState(ids, tag) === 'executing/2/0/-/lease',
      ),
    'D1: each of the eight schedules holds its own lease and is executing at version 2',
  );

  // ------------------------------------------------------------ D2 ----
  // One executing schedule whose lease expired: two overlapping sweepers recover it once.
  const crashed = ['cr-1'];
  kit.expireLease(ids, crashed[0]);
  await kit.closeGate(GATE);
  const appRecover = sweeperApp('r');
  const recoverer = kit.claimAsync(4, appRecover);
  await kit.waitParked(appRecover);
  check(
    kit.waitEvent(appRecover) === 'Lock:advisory' &&
      lockable(crashed, 'executing').length === 0 &&
      kit.scheduleState(ids, crashed[0]) === 'executing/2/0/-/lease',
    'D2: sweeper A is parked after recovering the expired lease: it row-locks the schedule (a third session cannot lock it) and nothing is committed (still executing at version 2)',
  );
  const overlapper = kit.claimAsync(4, 's11race-claim-overlap-recover-b');
  check(
    (await kit.blockedOrCompleted(
      's11race-claim-overlap-recover-b',
      overlapper.session,
    )) === 'completed',
    'D2: sweeper B runs and COMPLETES while A is parked holding the recovering row: it skips the locked row instead of waiting for it',
  );
  const overlapped = await overlapper.done;
  check(
    overlapped.code === 0 &&
      Array.isArray(overlapped.response) &&
      overlapped.response.length === 0 &&
      kit.waitEvent(appRecover) === 'Lock:advisory',
    'D2: B recovered and claimed nothing, and A is still parked: no second recovery of the same lease',
  );
  await kit.openGate(GATE);
  const recovered = await recoverer.done;
  check(
    recovered.code === 0 &&
      kit.scheduleState(ids, crashed[0]) === 'failed_retryable/3/1/-/-' &&
      kit.scheduleAudits(ids, crashed[0], 'cms.publication.schedule.retry') ===
        1,
    'D2: once the gate opens the lease is recovered exactly once: failed_retryable at attempt 1, version 3, one recovery audit record',
  );
  console.log(
    '# all sweeper-overlap race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
