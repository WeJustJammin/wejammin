#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-09 `cms_publish_revision` and CMS-03B-20
 * `cms_execute_publication_schedule` (BE03b "Publication lineage (E3)": two commands racing on one lineage never
 * commit a duplicate or a gap, and the loser of the race is 409 publication_conflict with nothing committed - each
 * command carries the head it OBSERVED before the earliest shared serialization point (before the entry, authority,
 * schema and review locks) and the lineage append compares it with the head under the lineage lock; global lock
 * order positions 0, 1, 4, 5, 6, 7; exactly one cms.publication.changed.v1 per appended row; DEC-157; tracker
 * P2-S11-AC-032, AC-080, AC-083, AC-084, AC-092, AC-114, AC-116).
 *
 *   E1  the SAME claimed schedule executed by two workers at once: one `completed`, one `already_completed`
 *       naming the same lineage row; one row, one event, one audit record (outbox dedupe).
 *   E2  a manual and a scheduled publish of the same lineage: with the scheduled execution parked right before
 *       its lineage insert (every lock held, head observed absent) and the manual publish started meanwhile
 *       (head observed absent, BLOCKED by the execution on the review row), the execution commits version 1 and the
 *       manual publish is `publication_conflict` with nothing committed (E2a); with the manual publish parked
 *       instead, the execution BLOCKS on the review row, the manual publish commits version 1 and the execution is
 *       `failed_retryable` (E2b); the retried execution, a genuinely later command, then completes as version 2.
 *   E3  two manual publishes of one lineage under different keys, BOTH parked at the actual reservation insert while
 *       the head is unchanged: released together, exactly one commits version 1 and the other is
 *       `publication_conflict` with no committed reservation, row, event or audit record; the winner's key replays
 *       its original resource with no new effect; a later publish under a new key succeeds as version 2.
 *   E4  the SAME publish under one key sent twice at once: one row, one event, the same answer twice.
 *   E5  a publish parked after taking the entry row FOR SHARE and its authority locks BLOCKS a revision
 *       append; the publish commits, then the append commits and invalidates the review
 *       (revision_superseded): no deadlock, the publication is not lost.
 *   E6  an append parked holding the entry row FOR UPDATE BLOCKS a publish; once it commits the publish is
 *       VERSION_MISMATCH (the review moved) and no lineage row exists.
 *   E7  a schedule execution parked after taking every lock (entry, authority, schema, review, schedule,
 *       lineage) right before its lineage insert BLOCKS a revision append; both commit, no deadlock, the
 *       completed schedule is untouched by the later invalidation.
 *   E8  the settings advisory lock has one leaf position (finding 5): with the owner's settings key HELD by a third
 *       session for the whole scenario, an approving decision parked holding the review row, a second reviewer's
 *       decision and a publish with expectedVersion 2 both queue on that review row without ever waiting on the
 *       settings key; once the first decision commits the stale decision is `review_not_open` (rolled back, its key
 *       reusable) and the publish commits version 1: no deadlock, only the first decision remains.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/publication-kit.mjs';

const { check } = kit;
const ids = kit.buildPublicationFixture();
kit.installGateTrigger();
kit.installLineageGate();
const PUBLISH_GATE = 7701;
const APPEND_GATE = 7702;
const LINEAGE_GATE = 7703;
const RESERVE_GATE = 7704;
const DECISION_GATE = 7705;
const PUBLISH = 'cms_publish_revision';
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');
/** Terminates the backends of one application name (a session holding a lock or a sleep). */
const runTerminate = (app) =>
  kit.runValue(
    `select count(pg_catalog.pg_terminate_backend(pid)) from pg_stat_activity where application_name = ${kit.sql(app)};`,
  );
/** Committed CMS-03B-09 idempotency reservations (a refused command rolls its reservation back). */
const publishReservations = () =>
  Number(
    kit.runValue(
      "select count(*) from platform_private.idempotency_records where operation = 'CMS-03B-09';",
    ),
  );

try {
  // ------------------------------------------------------------ E1 ----
  kit.makeDue(ids, ['ex-twice']);
  const claimed = kit
    .claim(25, 's11race-claim-e1')
    .response.find((entry) => entry.scheduleId === ids.schedules['ex-twice']);
  const twins = [0, 1].map((n) =>
    kit.executeAsync(
      kit.executeRequest(claimed, kit.proofFor(ids, 'ex-twice')),
      `s11race-exec-e1-${n}`,
    ),
  );
  const [t0, t1] = await Promise.all(twins.map((entry) => entry.done));
  const outcomes = [t0, t1].map((outcome) => outcome.response?.outcome).sort();
  check(
    t0.code === 0 &&
      t1.code === 0 &&
      outcomes.join(',') === 'already_completed,completed' &&
      t0.response.publicationVersionId === t1.response.publicationVersionId,
    `E1: two workers executing one claimed schedule: one completed, one already_completed, the same lineage row (${outcomes.join(',')})`,
  );
  check(
    kit.lineage(ids, 'ex-twice') === '1:publish:active' &&
      kit.publicationEvents(ids, 'ex-twice') === 1 &&
      kit.publicationAudits(ids, 'ex-twice') === 1 &&
      kit.scheduleState(ids, 'ex-twice') === 'completed/3/0/-/-',
    'E1: one lineage row, one cms.publication.changed.v1, one audit record, the schedule completed once',
  );

  // ------------------------------------------------------------ E2a ----
  // The scheduled execution is parked right before its lineage insert (it holds every lock, head observed absent).
  const reservedBeforeE2a = publishReservations();
  kit.makeDue(ids, ['pe-1']);
  const peClaim = kit
    .claim(25, 's11race-claim-e2')
    .response.find((entry) => entry.scheduleId === ids.schedules['pe-1']);
  await kit.closeGate(LINEAGE_GATE);
  const execParked = `s11race-lineage-${LINEAGE_GATE}-exec-e2a`;
  const scheduled = kit.executeAsync(
    kit.executeRequest(peClaim, kit.proofFor(ids, 'pe-1')),
    execParked,
  );
  await kit.waitParked(execParked);
  const manualApp = 's11race-publish-e2a';
  const manual = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'pe-1'),
    manualApp,
  );
  check(
    (await kit.blockedOrCompleted(manualApp, manual.session)) === 'blocked' &&
      kit.blockedBy(manualApp).includes(execParked) &&
      kit.lineage(ids, 'pe-1') === '-',
    'E2a: a manual publish started while the execution is parked (head observed absent) BLOCKS on the review row the execution holds; no row exists yet',
  );
  await kit.openGate(LINEAGE_GATE);
  const [se, ma] = await Promise.all([scheduled.done, manual.done]);
  check(
    se.code === 0 &&
      se.response.outcome === 'completed' &&
      ma.token === 'publication_conflict' &&
      kit.lineage(ids, 'pe-1') === '1:publish:active',
    `E2a: the execution commits version 1; the manual publish that observed an absent head is publication_conflict (${tokens([se, ma])}; ${kit.lineage(ids, 'pe-1')})`,
  );
  check(
    kit.publicationEvents(ids, 'pe-1') === 1 &&
      kit.publicationAudits(ids, 'pe-1') === 1 &&
      kit.scheduleState(ids, 'pe-1') === 'completed/3/0/-/-' &&
      publishReservations() === reservedBeforeE2a,
    'E2a: one event, one audit record, the schedule completed once, and the losing publish committed no reservation',
  );

  // ------------------------------------------------------------ E2b ----
  // The manual publish is parked right before its lineage insert; the execution starts meanwhile.
  kit.makeDue(ids, ['pe-2']);
  const peClaim2 = kit
    .claim(25, 's11race-claim-e2b')
    .response.find((entry) => entry.scheduleId === ids.schedules['pe-2']);
  await kit.closeGate(LINEAGE_GATE);
  const manualParked = `s11race-lineage-${LINEAGE_GATE}-manual-e2b`;
  const manualFirst = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'pe-2'),
    manualParked,
  );
  await kit.waitParked(manualParked);
  const lateExecApp = 's11race-exec-e2b';
  const scheduledLate = kit.executeAsync(
    kit.executeRequest(peClaim2, kit.proofFor(ids, 'pe-2')),
    lateExecApp,
  );
  check(
    (await kit.blockedOrCompleted(lateExecApp, scheduledLate.session)) ===
      'blocked' && kit.blockedBy(lateExecApp).includes(manualParked),
    'E2b: an execution started while the manual publish is parked (head observed absent) BLOCKS on the review row the publish holds',
  );
  await kit.openGate(LINEAGE_GATE);
  const [maFirst, seLate] = await Promise.all([
    manualFirst.done,
    scheduledLate.done,
  ]);
  check(
    maFirst.code === 0 &&
      seLate.code === 0 &&
      seLate.response.outcome === 'failed_retryable' &&
      kit.lineage(ids, 'pe-2') === '1:publish:active' &&
      kit.scheduleState(ids, 'pe-2') === 'failed_retryable/3/1/-/-',
    `E2b: the manual publish commits version 1; the execution that observed an absent head is failed_retryable (its retry ladder, attempt 1), no second row (${seLate.response?.outcome}; ${kit.lineage(ids, 'pe-2')})`,
  );
  check(
    kit.publicationEvents(ids, 'pe-2') === 1 &&
      kit.publicationAudits(ids, 'pe-2') === 1,
    'E2b: exactly one event and one audit record for the one appended row',
  );
  kit.retryDue(ids, 'pe-2');
  const retryClaim = kit
    .claim(25, 's11race-claim-e2b-retry')
    .response.find((entry) => entry.scheduleId === ids.schedules['pe-2']);
  const retried = kit.execute(
    kit.executeRequest(retryClaim, kit.proofFor(ids, 'pe-2')),
    's11race-exec-e2b-retry',
  );
  check(
    retried.code === 0 &&
      retried.response.outcome === 'completed' &&
      kit.lineage(ids, 'pe-2') === '1:publish:active,2:publish:active' &&
      kit.publicationEvents(ids, 'pe-2') === 2,
    `E2b: the retried execution, a genuinely later command that observes the published head, completes as version 2 (${retried.response?.outcome})`,
  );

  // ------------------------------------------------------------ E3 ----
  // Two manual publishes under different keys, both parked at the ACTUAL reservation insert (before the review lock),
  // with the head unchanged.
  const reservedBeforeE3 = publishReservations();
  await kit.closeGate(RESERVE_GATE);
  const dualRequests = [
    kit.publishRequest(ids, 'dp-1'),
    kit.publishRequest(ids, 'dp-1'),
  ];
  const dualApps = [
    `s10race-reserve-${RESERVE_GATE}-a`,
    `s10race-reserve-${RESERVE_GATE}-b`,
  ];
  const dual = dualApps.map((app, n) =>
    kit.spawnSession(
      app,
      kit.commandScript(ids, PUBLISH, dualRequests[n], 'pub'),
    ),
  );
  await Promise.all(dualApps.map((app) => kit.waitParked(app)));
  check(
    kit.lineage(ids, 'dp-1') === '-' &&
      publishReservations() === reservedBeforeE3,
    'E3: both publishes are parked at their reservation insert while the lineage head is unchanged (absent) and nothing is reserved',
  );
  await kit.openGate(RESERVE_GATE);
  const dualOutcomes = (await Promise.all(dual.map((entry) => entry.done))).map(
    (outcome) => ({
      ...outcome,
      conflict: outcome.stderr.includes('publication_conflict'),
    }),
  );
  const winners = dualOutcomes.filter((outcome) => outcome.code === 0);
  const losers = dualOutcomes.filter((outcome) => outcome.conflict);
  check(
    winners.length === 1 &&
      losers.length === 1 &&
      kit.lineage(ids, 'dp-1') === '1:publish:active',
    `E3: exactly one of two racing publishes commits version 1; the other is publication_conflict (${dualOutcomes.map((outcome) => (outcome.code === 0 ? 'ok' : outcome.conflict ? 'publication_conflict' : outcome.stderr.trim())).join(',')})`,
  );
  check(
    kit.publicationEvents(ids, 'dp-1') === 1 &&
      kit.publicationAudits(ids, 'dp-1') === 1 &&
      publishReservations() === reservedBeforeE3 + 1,
    'E3: the loser left no committed reservation, row, event or audit record: one of each for the winner',
  );
  const winnerIndex = dualOutcomes.findIndex((outcome) => outcome.code === 0);
  const replay = kit.call(
    ids,
    PUBLISH,
    'pub',
    dualRequests[winnerIndex],
    's11race-publish-e3-replay',
  );
  check(
    replay.code === 0 &&
      replay.response !== null &&
      kit.publicationEvents(ids, 'dp-1') === 1 &&
      kit.lineage(ids, 'dp-1') === '1:publish:active',
    "E3: the winner's key replays its original resource after the head moved, with no new effect",
  );
  const later = kit.call(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'dp-1'),
    's11race-publish-e3-later',
  );
  check(
    later.code === 0 &&
      kit.lineage(ids, 'dp-1') === '1:publish:active,2:publish:active' &&
      kit.publicationEvents(ids, 'dp-1') === 2,
    `E3: a genuinely later command under a new key observes the new head and commits version 2 (${later.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ E4 ----
  const same = kit.publishRequest(ids, 'dp-2');
  const replayed = [
    kit.callAsync(ids, PUBLISH, 'pub', same, 's11race-publish-e4-a'),
    kit.callAsync(ids, PUBLISH, 'pub', same, 's11race-publish-e4-b'),
  ];
  const [r0, r1] = await Promise.all(replayed.map((entry) => entry.done));
  check(
    r0.code === 0 &&
      r1.code === 0 &&
      JSON.stringify(r0.response) === JSON.stringify(r1.response) &&
      kit.lineage(ids, 'dp-2') === '1:publish:active' &&
      kit.publicationEvents(ids, 'dp-2') === 1,
    `E4: the same publish sent twice at once answers the same resource twice: one row, one event (${tokens([r0, r1])})`,
  );

  // ------------------------------------------------------------ E5 ----
  await kit.closeGate(PUBLISH_GATE);
  const parkedApp = `s10race-reserve-${PUBLISH_GATE}-publish`;
  const parked = kit.spawnSession(
    parkedApp,
    kit.commandScript(ids, PUBLISH, kit.publishRequest(ids, 'gt-a'), 'pub'),
  );
  await kit.waitParked(parkedApp);
  const appending = kit.callAsync(
    ids,
    'cms_create_revision',
    'owner',
    kit.appendRequest(ids, 'gt-a', 'Appended while a publish is in flight'),
    's11race-e5-append',
  );
  check(
    (await kit.blockedOrCompleted('s11race-e5-append', appending.session)) ===
      'blocked',
    'E5: a revision append BLOCKS behind a publish parked after taking the entry row FOR SHARE and its authority locks',
  );
  await kit.openGate(PUBLISH_GATE);
  const published = await parked.done;
  const appended = await appending.done;
  check(
    published.code === 0 && appended.code === 0,
    `E5: the publish committed first and the append after it, with no deadlock (${published.stderr.trim() || appended.stderr.trim() || 'no error'})`,
  );
  check(
    kit.lineage(ids, 'gt-a') === '1:publish:active' &&
      kit.reviewState(ids.reviews['gt-a']) ===
        'invalidated/3/1/revision_superseded' &&
      kit.publicationEvents(ids, 'gt-a') === 1,
    `E5: the publication is kept and the append then invalidated the review revision_superseded (${kit.reviewState(ids.reviews['gt-a'])})`,
  );

  // ------------------------------------------------------------ E6 ----
  const late = kit.publishRequest(ids, 'gt-b');
  await kit.closeGate(APPEND_GATE);
  const gatedApp = `s10race-gated-${APPEND_GATE}-append`;
  const gated = kit.spawnSession(
    gatedApp,
    kit.commandScript(
      ids,
      'cms_create_revision',
      kit.appendRequest(ids, 'gt-b', 'Appended first'),
      'owner',
    ),
  );
  await kit.waitParked(gatedApp);
  const lateCall = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    late,
    's11race-e6-publish',
  );
  check(
    (await kit.blockedOrCompleted('s11race-e6-publish', lateCall.session)) ===
      'blocked',
    'E6: a publish BLOCKS behind an append holding the entry row FOR UPDATE',
  );
  await kit.openGate(APPEND_GATE);
  const appendedFirst = await gated.done;
  const lateOutcome = await lateCall.done;
  check(
    appendedFirst.code === 0 &&
      lateOutcome.token === 'VERSION_MISMATCH' &&
      kit.lineage(ids, 'gt-b') === '-',
    `E6: once the append commits the late publish is VERSION_MISMATCH and no lineage row exists (${lateOutcome.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ E7 ----
  kit.makeDue(ids, ['ex-lock']);
  const lockClaim = kit
    .claim(25, 's11race-claim-e7')
    .response.find((entry) => entry.scheduleId === ids.schedules['ex-lock']);
  await kit.closeGate(LINEAGE_GATE);
  const execApp = `s11race-lineage-${LINEAGE_GATE}-exec`;
  const executing = kit.executeAsync(
    kit.executeRequest(lockClaim, kit.proofFor(ids, 'ex-lock')),
    execApp,
  );
  await kit.waitParked(execApp);
  const behind = kit.callAsync(
    ids,
    'cms_create_revision',
    'owner',
    kit.appendRequest(ids, 'ex-lock', 'Appended while a schedule executes'),
    's11race-e7-append',
  );
  check(
    (await kit.blockedOrCompleted('s11race-e7-append', behind.session)) ===
      'blocked',
    'E7: a revision append BLOCKS behind a schedule execution parked right before its lineage insert (it holds the entry row FOR SHARE)',
  );
  await kit.openGate(LINEAGE_GATE);
  const [done, appendDone] = await Promise.all([executing.done, behind.done]);
  check(
    done.code === 0 &&
      appendDone.code === 0 &&
      done.response.outcome === 'completed' &&
      kit.scheduleState(ids, 'ex-lock') === 'completed/3/0/-/-' &&
      kit.lineage(ids, 'ex-lock') === '1:publish:active' &&
      kit.reviewState(ids.reviews['ex-lock']) ===
        'invalidated/3/1/revision_superseded',
    `E7: the execution committed first, then the append invalidated the review; the completed schedule and its publication are untouched (${tokens([done, appendDone])})`,
  );

  // ------------------------------------------------------------ E8 ----
  // DEC-157 / finding 5: the owner settings advisory key is a leaf of the ordinary write tails; the decision and
  // publication commands never wait on it.  A third session HOLDS the real key for the whole scenario.
  const reviewId = ids.reviews['lk-1'];
  const settingsKey = `pg_catalog.hashtextextended('cms.settings_snapshot:' || ${kit.sql(ids.org)}, 0)`;
  const settingsApp = 's11race-lk-settings';
  const settingsHolder = kit.spawnSession(
    settingsApp,
    `select pg_catalog.pg_advisory_lock(${settingsKey}); select pg_catalog.pg_sleep(900);`,
  );
  await kit.waitFor(
    'the settings key holder',
    () => kit.waitEvent(settingsApp) === 'Timeout:PgSleep',
  );
  await kit.closeGate(DECISION_GATE);
  const gateHolder = `s10race-gateholder-${DECISION_GATE}`;
  const approveA = kit.decisionRequest(ids, reviewId, 'approve', 1);
  const aApp = 's11race-lk-a';
  const sessionA = kit.spawnSession(
    aApp,
    `begin; ${kit.actorSettings(ids, 'rvA')} select platform_api.cms_record_review_decision(${kit.jsonb(approveA)}); select pg_catalog.pg_advisory_xact_lock_shared(${DECISION_GATE}); commit;`,
  );
  await kit.waitParked(aApp);
  check(
    kit.blockedBy(aApp).join(',') === gateHolder,
    "E8: the first reviewer's approval is parked holding the review row, waiting on its own gate and NOT on the settings key (open to approved, uncommitted)",
  );
  const approveD = kit.decisionRequest(ids, reviewId, 'approve', 1);
  const dApp = 's11race-lk-d';
  const sessionD = kit.callAsync(
    ids,
    'cms_record_review_decision',
    'rvB',
    approveD,
    dApp,
  );
  check(
    (await kit.blockedOrCompleted(dApp, sessionD.session)) === 'blocked' &&
      kit.blockedBy(dApp).includes(aApp) &&
      !kit.blockedBy(dApp).includes(settingsApp),
    "E8: the second reviewer's decision (passed its open check, dependency rebuild done) queues on the review row held by the first, not on the settings key",
  );
  const publishApp = 's11race-lk-p';
  const sessionP = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'lk-1', { expectedVersion: '2', ifMatch: '2' }),
    publishApp,
  );
  // The row lock queues: the second waiter (the publish) waits on the tuple lock held by the first waiter (the
  // stale decision) as well as on the transaction of the first reviewer, so its blockers are those two sessions.
  const publishBlockers = async () => {
    const state = await kit.blockedOrCompleted(publishApp, sessionP.session);
    return { state, blockers: kit.blockedBy(publishApp) };
  };
  const queued = await publishBlockers();
  check(
    queued.state === 'blocked' &&
      queued.blockers.length > 0 &&
      queued.blockers.every((app) => app === aApp || app === dApp) &&
      !queued.blockers.includes(settingsApp),
    "E8: the publisher's publish (expectedVersion 2) queues on the same review row (behind the first reviewer and the stale decision), never on the settings key",
  );
  const effectsOf = () =>
    kit.runValue(
      `select md5(
         coalesce((select string_agg(to_jsonb(review)::text, '|') from platform_private.cms_editorial_reviews review where review.id = ${kit.sql(reviewId)}), '')
         || coalesce((select string_agg(to_jsonb(decision)::text, '|' order by decision.id) from platform_private.cms_editorial_decisions decision where decision.review_id = ${kit.sql(reviewId)}), '')
         || coalesce((select string_agg(to_jsonb(event)::text, '|' order by event.id) from platform_private.outbox_events event where event.aggregate_id = ${kit.sql(reviewId)}), '')
         || coalesce((select string_agg(to_jsonb(audit)::text, '|' order by audit.id) from audit_private.audit_events audit where audit.target_id = ${kit.sql(reviewId)}), ''));`,
    );
  await kit.openGate(DECISION_GATE);
  const [outA, outD, outP] = await Promise.all([
    sessionA.done,
    sessionD.done,
    sessionP.done,
  ]);
  check(
    outA.code === 0 &&
      outD.token === 'review_not_open' &&
      outP.code === 0 &&
      kit.lineage(ids, 'lk-1') === '1:publish:active' &&
      kit.publicationEvents(ids, 'lk-1') === 1,
    `E8: no deadlock: the first approval commits, the stale decision is review_not_open and the publish commits version 1 (${outA.stderr.trim() || 'a ok'}; ${outD.token ?? 'ok'}; ${outP.token ?? 'ok'})`,
  );
  check(
    kit.decisionCount(reviewId) === 1 &&
      kit.reviewState(reviewId) === 'approved/2/1/-' &&
      kit.eventCount(reviewId) === 1,
    "E8: only the first reviewer's decision remains: the review is approved at version 2 with one decision and one review-changed event",
  );
  const afterRace = effectsOf();
  const retryD = kit.call(
    ids,
    'cms_record_review_decision',
    'rvB',
    approveD,
    's11race-lk-d-retry',
  );
  check(
    retryD.token === 'review_not_open' && effectsOf() === afterRace,
    'E8: the stale decision rolled back completely and its idempotency key is reusable: the same key again is the same review_not_open with no row, event or audit change',
  );
  check(
    kit.waitEvent(settingsApp) === 'Timeout:PgSleep',
    'E8: the settings key was held by the third session for the whole scenario and no command waited on it',
  );
  runTerminate(settingsApp);
  await settingsHolder.done;
  console.log(
    '# all publication / execution race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  runTerminate('s11race-lk-settings');
  await kit.openAllGates();
}
