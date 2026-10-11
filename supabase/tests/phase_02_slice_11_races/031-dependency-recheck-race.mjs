#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for the dependency recheck job (BE03b "Review invalidation / Dependency recheck",
 * Write-path lock order; tracker P2-S11-AC-113): `platform_api.cms_dependency_recheck_run` selects the live reviews the
 * dependency index names under (kind, refId), decides from plain reads which no longer hold and invalidates those
 * `dependency_changed` through the one invalidation core, which takes the review row `FOR UPDATE` (lock position 5) in
 * ascending review id and treats a review that is no longer open or approved as an idempotent no-op.  The queue delivers
 * a source event at least once and a job message can be redelivered, so two runs for the same event can overlap; this
 * runner proves that every affected review is invalidated EXACTLY ONCE and no audit record or outbox event is duplicated.
 *
 * The fixture (supabase/tests/phase_02_slice_11_recheck_race/090-race-fixture.sqlinc) is real data written through the
 * data-model guards: reviews frozen from the real manifest of their own revision, whose composed block was then
 * WITHDRAWN (so the rebuilt manifest is equal and the frozen identity is no longer current).  Nothing is stubbed; the
 * runs are the production RPC, one committed `psql` session each.
 *
 *   R1  two runs for one event over four stale reviews (three open, one approved).  A session holds the lowest review's
 *       row lock FOR UPDATE; both runs are observed waiting on exactly that holder (neither has committed, all four
 *       reviews are still live, nothing is emitted), then the holder lets go.  Exactly one run invalidates all four
 *       (the other examines four, invalidates none): each review is `invalidated`/`dependency_changed` at its next
 *       version (open v2, approved v3), has ONE `cms.entry.review-changed.v1` and ONE audit record, both carrying the
 *       source event's correlation id; the dependency rows are retained; no error or deadlock surfaces.
 *   R2  four runs for one event over eight stale reviews, all four parked behind the same row-lock holder, then released:
 *       the four answers' `invalidated` counts sum to eight, every review is invalidated once at version 2 with one event
 *       and one audit record, and the control reviews are untouched.
 *   R3  idempotency after the races: two more runs for each of the two events concurrently answer `{ examined: 0,
 *       invalidated: 0, nextCursor: null }` and emit nothing.
 *   R4  control: two concurrent runs naming the block whose reviews still hold (a forged or stale job) examine both
 *       reviews and invalidate none; no event, audit record or version change.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/recheck-kit.mjs';

const {
  check,
  clean,
  failure,
  startRun,
  runRequest,
  holdReviewLock,
  blockedBy,
  waitFor,
  isLockWaiting,
  reviewState,
  reviewChangedEvents,
  invalidationAudits,
  reviewAudits,
  eventCount,
  eventCorrelations,
  auditCorrelations,
  dependencyRows,
} = kit;

const ids = kit.buildRecheckFixture();
const NONE = { examined: 0, invalidated: 0, nextCursor: null };
const sortKeys = (value) =>
  Array.isArray(value)
    ? value.map(sortKeys)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sortKeys(value[key])]),
        )
      : value;
/** Deep equality that ignores member order (the RPC answers jsonb, whose key order is its own). */
const same = (left, right) =>
  JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
const live = (id) => /^(open|approved)\//u.test(reviewState(id));

/**
 * Starts `names` runs for one event, each in its own session, and waits until every one waits for a lock.  PostgreSQL
 * queues waiters for one row: the first waits on the transaction holding it, the next ones on the first waiter's tuple
 * lock.  So every run must wait on the holder or on another run and on nothing else, and at least one directly on the
 * holder.
 */
const parkBehind = async (holder, names, request) => {
  const runs = names.map((name) => startRun(`s11race-rc-${name}`, request));
  for (const run of runs)
    await waitFor(`${run.app} to wait for a lock`, () =>
      isLockWaiting(run.app),
    );
  const apps = runs.map((run) => run.app);
  const blockers = runs.map((run) => blockedBy(run.app));
  return {
    runs,
    onlyOnHolderOrEachOther:
      blockers.every(
        (list) =>
          list.length > 0 &&
          list.every((app) => app === holder.app || apps.includes(app)),
      ) && blockers.some((list) => list.includes(holder.app)),
  };
};

const baselineEvents = reviewChangedEvents();
const baselineAudits = invalidationAudits();
const eventsAdded = () => reviewChangedEvents() - baselineEvents;
const auditsAdded = () => invalidationAudits() - baselineAudits;
check(
  ids.p1.length === 4 && ids.p2.length === 8 && ids.control.length === 2,
  'fixture: four stale reviews of block A (three open, one approved), eight stale reviews of block B and two control reviews of block C',
);
check(
  [...ids.p1, ...ids.p2, ...ids.control].every(live),
  'fixture: every review is still live (open or approved) before any run',
);
check(
  eventsAdded() === 0 && auditsAdded() === 0,
  'fixture: no invalidation event or audit record exists before the first run',
);
const dependenciesP1 = dependencyRows(ids.p1);
const dependenciesP2 = dependencyRows(ids.p2);
check(
  dependenciesP1 > 0 && dependenciesP2 > 0,
  `fixture: the stale reviews carry dependency index rows (${dependenciesP1} / ${dependenciesP2})`,
);

const request = (event, block) =>
  runRequest(ids.events[event], 'block', ids.blocks[block]);

try {
  // ------------------------------------------------------------ R1 ----
  const holder1 = await holdReviewLock(ids.p1[0], 'rc1');
  const parked1 = await parkBehind(holder1, ['1a', '1b'], request('a', 'a'));
  check(
    parked1.onlyOnHolderOrEachOther,
    'R1: both runs wait for the lowest review row, held FOR UPDATE by another session: only on that holder or on each other, one of them directly on the holder',
  );
  check(
    ids.p1.every(live) && eventsAdded() === 0 && auditsAdded() === 0,
    'R1: nothing is committed while both runs wait: all four reviews are live, no event, no audit record',
  );
  await holder1.release();
  const [r1a, r1b] = await Promise.all(parked1.runs.map((run) => run.done));
  check(
    clean(r1a) && clean(r1b),
    `R1: both runs commit and no error or deadlock surfaces (${failure(r1a)} / ${failure(r1b)})`,
  );
  check(
    r1a.response.examined === 4 && r1b.response.examined === 4,
    `R1: both runs examined the four reviews they selected (${r1a.response.examined} / ${r1b.response.examined})`,
  );
  check(
    [r1a.response.invalidated, r1b.response.invalidated].sort().join() ===
      '0,4' &&
      r1a.response.nextCursor === null &&
      r1b.response.nextCursor === null,
    `R1: exactly one run invalidated the four reviews, the other none (${r1a.response.invalidated} / ${r1b.response.invalidated}), no continuation`,
  );
  const expectedP1 = ids.p1.map((id) =>
    id === ids.p1Approved
      ? 'invalidated/3/1/dependency_changed'
      : 'invalidated/2/0/dependency_changed',
  );
  check(
    same(ids.p1.map(reviewState), expectedP1),
    `R1: every review is invalidated dependency_changed once - open at version 2, the approved one at version 3 (${ids.p1.map(reviewState).join(' ')})`,
  );
  check(
    ids.p1.every((id) => eventCount(id) === 1) && eventsAdded() === 4,
    `R1: one cms.entry.review-changed.v1 per review and four in all (${eventsAdded()} new)`,
  );
  check(
    ids.p1.every((id) => reviewAudits(id) === 1) && auditsAdded() === 4,
    `R1: one audit record per review and four in all (${auditsAdded()} new)`,
  );
  check(
    ids.p1.every(
      (id) =>
        eventCorrelations(id) === ids.correlations.a &&
        auditCorrelations(id) === ids.correlations.a,
    ),
    "R1: every event and audit record carries the source event's correlation id",
  );
  check(
    dependencyRows(ids.p1) === dependenciesP1,
    'R1: the dependency rows of the invalidated reviews are retained as history',
  );

  // ------------------------------------------------------------ R2 ----
  const holder2 = await holdReviewLock(ids.p2[0], 'rc2');
  const parked2 = await parkBehind(
    holder2,
    ['2a', '2b', '2c', '2d'],
    request('b', 'b'),
  );
  check(
    parked2.onlyOnHolderOrEachOther,
    'R2: all four runs wait for the lowest review row, held FOR UPDATE by another session: only on that holder or on each other, one of them directly on the holder',
  );
  check(
    ids.p2.every(live) && eventsAdded() === 4 && auditsAdded() === 4,
    'R2: nothing of block B is committed while the four runs wait: all eight reviews are live and the event and audit totals are those of R1',
  );
  await holder2.release();
  const burst = await Promise.all(parked2.runs.map((run) => run.done));
  check(
    burst.every(clean),
    `R2: all four runs commit and no error or deadlock surfaces (${burst.map(failure).join(' / ')})`,
  );
  check(
    burst.every((outcome) => outcome.response.examined === 8) &&
      burst.reduce((sum, outcome) => sum + outcome.response.invalidated, 0) ===
        8 &&
      burst.every((outcome) => outcome.response.nextCursor === null),
    `R2: every run examined the eight reviews and the invalidated counts sum to eight, not more (${burst.map((outcome) => outcome.response.invalidated).join(' + ')})`,
  );
  check(
    ids.p2.every(
      (id) => reviewState(id) === 'invalidated/2/0/dependency_changed',
    ),
    `R2: every review is invalidated dependency_changed once, at version 2 (${ids.p2.map(reviewState).join(' ')})`,
  );
  check(
    ids.p2.every(
      (id) =>
        eventCount(id) === 1 &&
        reviewAudits(id) === 1 &&
        eventCorrelations(id) === ids.correlations.b &&
        auditCorrelations(id) === ids.correlations.b,
    ) &&
      eventsAdded() === 12 &&
      auditsAdded() === 12,
    `R2: one event and one audit record per review, each with the source event's correlation id; twelve of each in all (${eventsAdded()} / ${auditsAdded()})`,
  );
  check(
    dependencyRows(ids.p2) === dependenciesP2,
    'R2: the dependency rows of the invalidated reviews are retained as history',
  );
  check(
    ids.control.every((id) => reviewState(id) === 'open/1/0/-'),
    'R2: the control reviews of the supported block are untouched',
  );

  // ------------------------------------------------------------ R3 ----
  const replays = [
    startRun('s11race-rc-3a', request('a', 'a')),
    startRun('s11race-rc-3b', request('a', 'a')),
    startRun('s11race-rc-3c', request('b', 'b')),
    startRun('s11race-rc-3d', request('b', 'b')),
  ];
  const replayed = await Promise.all(replays.map((run) => run.done));
  check(
    replayed.every((outcome) => clean(outcome) && same(outcome.response, NONE)),
    `R3: two more concurrent runs per event select no live review and answer examined 0, invalidated 0 (${replayed.map((outcome) => JSON.stringify(outcome.response)).join(' ')})`,
  );
  check(
    eventsAdded() === 12 && auditsAdded() === 12,
    'R3: the replays emit no second event and write no second audit record',
  );

  // ------------------------------------------------------------ R4 ----
  const forged = [
    startRun('s11race-rc-4a', request('a', 'c')),
    startRun('s11race-rc-4b', request('a', 'c')),
  ];
  const forgedDone = await Promise.all(forged.map((run) => run.done));
  check(
    forgedDone.every(
      (outcome) =>
        clean(outcome) &&
        outcome.response.examined === 2 &&
        outcome.response.invalidated === 0 &&
        outcome.response.nextCursor === null,
    ),
    `R4: two concurrent runs naming the supported block examine its two reviews and invalidate none (${forgedDone.map((outcome) => JSON.stringify(outcome.response)).join(' ')})`,
  );
  check(
    ids.control.every(
      (id) =>
        reviewState(id) === 'open/1/0/-' &&
        eventCount(id) === 0 &&
        reviewAudits(id) === 0,
    ) &&
      eventsAdded() === 12 &&
      auditsAdded() === 12,
    'R4: a review that still holds keeps its version and state and emits nothing, whatever the job names',
  );
  console.log(
    '# all dependency recheck race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  kit.terminateRunnerSessions();
}
