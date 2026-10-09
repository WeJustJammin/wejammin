#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-06 `cms_record_review_decision` (BE03b "Decision"
 * steps 1-10; DEC-157 lock order: authority rows (1), the schema version (4), then the review row
 * FOR UPDATE (5); "unique reviewer/review and review CAS; the first rejection ends the review";
 * tracker P2-S11-AC-014, AC-108 .. AC-110, AC-121).
 *
 *   B1  two reviewers approve a two-decision review at the same If-Match: exactly one commits, the
 *       other is VERSION_MISMATCH (the review CAS), one decision row; the loser retries at the new
 *       version and the review is approved.
 *   B2  an approve and a reject race on a one-decision review: exactly one commits, the other is
 *       refused by the review CAS (VERSION_MISMATCH, or review_not_open once the winner ended the
 *       review); one decision row, one event, a terminal review.
 *   B3  the same command (same Idempotency-Key) sent twice at once: both answer the same response,
 *       one decision row and one event (the second waits on the reservation and replays).
 *   B4  one reviewer under two keys at once: one decision row (UNIQUE reviewer/review), the other
 *       call is refused (VERSION_MISMATCH), never a raw unique violation.
 *   B5  the command takes the review row lock: with the row held FOR UPDATE a decision BLOCKS and
 *       completes once the holder ends.
 *   B6  authority revocation vs a decision, in the global lock order: a decision parked after its
 *       authority locks blocks the revoking UPDATE, commits, and only then does the revocation
 *       commit (invalidating the review reviewer_authority_changed): no deadlock; an in-flight lock
 *       on the reviewer's grant row blocks a decision, which completes when released.
 *   B7  a decision and the revoke of the reviewer's assignment race on one review (both wait on the
 *       review lock): exactly one commits; the other is refused with the typed outcome of its
 *       order (VERSION_MISMATCH after a decision, capability_missing after a revoke).
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/review-kit.mjs';

const { check } = kit;
const ids = kit.buildReviewFixture();
kit.installGateTrigger();
const AUTHORITY_GATE = 7501;
const DECIDE = 'cms_record_review_decision';
const ASSIGN = 'cms_assign_editorial_reviewer';
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');

try {
  // ------------------------------------------------------------ B1 ----
  const two = ids.reviews['race-dec-two'];
  const first = [
    kit.callAsync(
      ids,
      DECIDE,
      'rvA',
      kit.decisionRequest(ids, two, 'approve', 1),
      's11race-b1-a',
    ),
    kit.callAsync(
      ids,
      DECIDE,
      'rvB',
      kit.decisionRequest(ids, two, 'approve', 1),
      's11race-b1-b',
    ),
  ];
  const [a, b] = await Promise.all(first.map((entry) => entry.done));
  check(
    [a, b].filter((outcome) => outcome.code === 0).length === 1 &&
      [a, b].some((outcome) => outcome.token === 'VERSION_MISMATCH'),
    `B1: two approvals at one review version commit exactly one; the other is VERSION_MISMATCH (${tokens([a, b])})`,
  );
  check(
    kit.decisionCount(two) === 1 &&
      kit.reviewState(two) === 'open/2/1/-' &&
      kit.eventCount(two) === 1,
    'B1: one decision row, the review open at version 2 with one recorded decision, one event',
  );
  const loser = a.code === 0 ? 'rvB' : 'rvA';
  const retry = kit.call(
    ids,
    DECIDE,
    loser,
    kit.decisionRequest(ids, two, 'approve', 2),
  );
  check(
    retry.code === 0 &&
      kit.reviewState(two) === 'approved/3/2/-' &&
      kit.decisionCount(two) === 2,
    `B1: the loser retries at the new version and the review is approved at version 3 (${retry.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ B2 ----
  const one = ids.reviews['race-dec-one'];
  const split = [
    kit.callAsync(
      ids,
      DECIDE,
      'rvA',
      kit.decisionRequest(ids, one, 'approve', 1),
      's11race-b2-approve',
    ),
    kit.callAsync(
      ids,
      DECIDE,
      'rvB',
      kit.decisionRequest(ids, one, 'reject', 1),
      's11race-b2-reject',
    ),
  ];
  const [approve, reject] = await Promise.all(split.map((entry) => entry.done));
  check(
    [approve, reject].filter((outcome) => outcome.code === 0).length === 1 &&
      [approve, reject].some((outcome) =>
        ['VERSION_MISMATCH', 'review_not_open'].includes(outcome.token),
      ),
    `B2: an approve and a reject at one version commit exactly one; the other is refused by the review CAS (VERSION_MISMATCH, or review_not_open once the winner ended the review) (${tokens([approve, reject])})`,
  );
  check(
    kit.decisionCount(one) === 1 &&
      /^(approved|rejected)\/2\/1\/-$/u.test(kit.reviewState(one)) &&
      kit.eventCount(one) === 1,
    `B2: one decision row, a terminal review (${kit.reviewState(one)}) and one event`,
  );

  // ------------------------------------------------------------ B3 ----
  const replay = ids.reviews['race-dec-replay'];
  const request = kit.decisionRequest(ids, replay, 'approve', 1);
  const twins = [
    kit.callAsync(ids, DECIDE, 'rvA', request, 's11race-b3-x'),
    kit.callAsync(ids, DECIDE, 'rvA', request, 's11race-b3-y'),
  ];
  const [x, y] = await Promise.all(twins.map((entry) => entry.done));
  check(
    x.code === 0 &&
      y.code === 0 &&
      JSON.stringify(x.response) === JSON.stringify(y.response),
    `B3: the same command sent twice at once answers the same response both times (${tokens([x, y])})`,
  );
  check(
    kit.decisionCount(replay) === 1 &&
      kit.eventCount(replay) === 1 &&
      kit.reviewState(replay) === 'approved/2/1/-',
    'B3: one decision row and one event (the duplicate replayed)',
  );

  // ------------------------------------------------------------ B4 ----
  const dup = ids.reviews['race-dec-dup'];
  const same = [
    kit.callAsync(
      ids,
      DECIDE,
      'rvA',
      kit.decisionRequest(ids, dup, 'approve', 1),
      's11race-b4-x',
    ),
    kit.callAsync(
      ids,
      DECIDE,
      'rvA',
      kit.decisionRequest(ids, dup, 'approve', 1),
      's11race-b4-y',
    ),
  ];
  const [m, n] = await Promise.all(same.map((entry) => entry.done));
  check(
    [m, n].filter((outcome) => outcome.code === 0).length === 1 &&
      [m, n].every(
        (outcome) =>
          outcome.code === 0 ||
          outcome.token === 'VERSION_MISMATCH' ||
          outcome.token === 'duplicate_decision',
      ),
    `B4: one reviewer under two keys commits one decision; the other is a typed refusal, never a raw unique violation (${tokens([m, n])})`,
  );
  check(
    kit.decisionCount(dup) === 1 && kit.eventCount(dup) === 1,
    'B4: one decision row (unique reviewer per review) and one event',
  );

  // ------------------------------------------------------------ B5 ----
  const lock = ids.reviews['race-dec-lock'];
  const holder = await kit.holdReviewLock(lock, 'decide');
  const blocked = kit.callAsync(
    ids,
    DECIDE,
    'rvA',
    kit.decisionRequest(ids, lock, 'approve', 1),
    's11race-b5-decide',
  );
  check(
    (await kit.blockedOrCompleted('s11race-b5-decide', blocked.session)) ===
      'blocked',
    'B5: a decision BLOCKS behind a session holding the review row FOR UPDATE (the command takes the review lock)',
  );
  await holder.release();
  const completed = await blocked.done;
  check(
    completed.code === 0 && kit.reviewState(lock) === 'approved/2/1/-',
    `B5: once the lock is released the decision completes and approves the review (${completed.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ B6 ----
  const revoke = ids.reviews['race-dec-revoke'];
  const revokeGrant = (active) =>
    `begin; select set_config('app.cms_rpc', 'true', true); update identity_private.organization_actor_grant set active = ${active}, updated_at = clock_timestamp() where organization_id = ${kit.sql(ids.org)}::uuid and person_id = ${kit.sql(ids.actors.rvA.person)}::uuid and capability_code = 'cms.reviewer'; commit;`;
  await kit.closeGate(AUTHORITY_GATE);
  // The decision parks at its idempotency reservation: AFTER its authority locks (position 1).
  const parked = kit.spawnSession(
    `s10race-reserve-${AUTHORITY_GATE}-decide`,
    kit.commandScript(
      ids,
      DECIDE,
      kit.decisionRequest(ids, revoke, 'approve', 1),
      'rvA',
    ),
  );
  await kit.waitParked(`s10race-reserve-${AUTHORITY_GATE}-decide`);
  const revoking = kit.spawnSession('s11race-b6-revoke', revokeGrant(false));
  check(
    (await kit.blockedOrCompleted('s11race-b6-revoke', revoking)) === 'blocked',
    'B6: a revocation of the reviewer grant BLOCKS behind a decision parked after its authority locks (the decision holds the grant row FOR SHARE)',
  );
  await kit.openGate(AUTHORITY_GATE);
  const decided = await parked.done;
  const revoked = await revoking.done;
  check(
    decided.code === 0 && revoked.code === 0 && kit.decisionCount(revoke) === 1,
    `B6: the decision committed first and the revocation committed after it, with no deadlock (${decided.stderr.trim() || revoked.stderr.trim() || 'no error'})`,
  );
  check(
    kit.reviewState(revoke) === 'invalidated/3/1/reviewer_authority_changed',
    `B6: the revocation then invalidated the review: its counted approver lost the standing grant (${kit.reviewState(revoke)})`,
  );
  kit.value(
    `begin; select set_config('app.cms_rpc', 'true', true); update identity_private.organization_actor_grant set active = true, updated_at = clock_timestamp() where organization_id = ${kit.sql(ids.org)}::uuid and person_id = ${kit.sql(ids.actors.rvA.person)}::uuid and capability_code = 'cms.reviewer'; commit; select 'restored';`,
  );

  const holdGrant = kit.spawnSession(
    's11race-b6-holder',
    `begin; select 1 from identity_private.organization_actor_grant where organization_id = ${kit.sql(ids.org)}::uuid and person_id = ${kit.sql(ids.actors.rvB.person)}::uuid and capability_code = 'cms.reviewer' for update; select pg_catalog.pg_sleep(900);`,
  );
  await kit.waitFor(
    'the grant holder',
    () => kit.waitEvent('s11race-b6-holder') === 'Timeout:PgSleep',
  );
  const grantReview = ids.reviews['race-dec-grant'];
  const waiting = kit.callAsync(
    ids,
    DECIDE,
    'rvB',
    kit.decisionRequest(ids, grantReview, 'approve', 1),
    's11race-b6-waiting',
  );
  check(
    (await kit.blockedOrCompleted('s11race-b6-waiting', waiting.session)) ===
      'blocked',
    'B6: a decision BLOCKS on the reviewer authority rows while another session holds the grant row lock',
  );
  kit.value(
    `select count(pg_catalog.pg_terminate_backend(pid)) from pg_stat_activity where application_name = 's11race-b6-holder';`,
  );
  await holdGrant.done;
  const afterHold = await waiting.done;
  check(
    afterHold.code === 0 && kit.reviewState(grantReview) === 'approved/2/1/-',
    `B6: the decision completes once the lock is released (${afterHold.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ B7 ----
  const serial = ids.reviews['race-dec-serial'];
  const rvAAssignment = ids.assignments['race-dec-serial-rvA'];
  const gate = await kit.holdReviewLock(serial, 'serial');
  const racers = [
    kit.callAsync(
      ids,
      DECIDE,
      'rvA',
      kit.decisionRequest(ids, serial, 'approve', 1),
      's11race-b7-decide',
    ),
    kit.callAsync(
      ids,
      ASSIGN,
      'owner',
      kit.revokeRequest(ids, serial, 1, rvAAssignment),
      's11race-b7-revoke',
    ),
  ];
  check(
    (await kit.blockedOrCompleted('s11race-b7-decide', racers[0].session)) ===
      'blocked' &&
      (await kit.blockedOrCompleted('s11race-b7-revoke', racers[1].session)) ===
        'blocked',
    'B7: a decision and an assignment revoke both wait on the review row lock',
  );
  await gate.release();
  const [decideOutcome, revokeOutcome] = await Promise.all(
    racers.map((entry) => entry.done),
  );
  const decisionsAfter = kit.decisionCount(serial);
  const consistent =
    (decideOutcome.code === 0 &&
      decisionsAfter === 1 &&
      revokeOutcome.token === 'VERSION_MISMATCH') ||
    (revokeOutcome.code === 0 &&
      decisionsAfter === 0 &&
      decideOutcome.token === 'capability_missing');
  check(
    consistent,
    `B7: exactly one of the two commits and the other is refused for the order it lost (${tokens([decideOutcome, revokeOutcome])}; decisions ${decisionsAfter})`,
  );
  console.log(
    '# all review-decision race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
