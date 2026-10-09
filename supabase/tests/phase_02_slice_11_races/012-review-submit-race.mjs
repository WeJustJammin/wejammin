#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-05 `cms_submit_review` (BE03b "one open or approved
 * review per revision via the partial unique lock"; global lock order position 0: the entry row;
 * "Any changed draft creates a new immutable revision and invalidates affected review"; tracker
 * P2-S11-AC-005, AC-008, AC-085, AC-112).
 *
 *   C1  two submissions of ONE revision under different keys race: exactly one commits (a review,
 *       its dependency rows and one event); the other is the typed revision_not_submittable.
 *   C2  the same submission sent twice at once: both answer the same response and one review exists
 *       (the second waits on the idempotency reservation and replays).
 *   C3  a submit parked after taking the entry row FOR SHARE and its authority locks BLOCKS a
 *       revision append (CMS-03B-01, FOR UPDATE on the entry); the submit commits, then the append
 *       commits and invalidates the review revision_superseded: no deadlock, no stale live review.
 *   C4  an append parked while it holds the entry row FOR UPDATE BLOCKS a submit; once the append
 *       commits the submit is refused VERSION_MISMATCH and no review exists.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/review-kit.mjs';

const { check } = kit;
const ids = kit.buildReviewFixture();
kit.installGateTrigger();
const SUBMIT_GATE = 7601;
const APPEND_GATE = 7602;
const SUBMIT = 'cms_submit_review';
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');
const reviewsOf = (revisionId) =>
  kit.count(
    `select count(*) from platform_private.cms_editorial_reviews where revision_id = ${kit.sql(revisionId)};`,
  );
const dependenciesOf = (revisionId) =>
  kit.count(
    `select count(*) from platform_private.cms_editorial_review_dependencies dependency join platform_private.cms_editorial_reviews review on review.id = dependency.review_id where review.revision_id = ${kit.sql(revisionId)};`,
  );

try {
  // ------------------------------------------------------------ C1 ----
  const c1 = 'race-sub-1';
  const twins = [
    kit.callAsync(
      ids,
      SUBMIT,
      'owner',
      kit.submitRequest(ids, c1),
      's11race-c1-x',
    ),
    kit.callAsync(
      ids,
      SUBMIT,
      'owner',
      kit.submitRequest(ids, c1),
      's11race-c1-y',
    ),
  ];
  const [x, y] = await Promise.all(twins.map((entry) => entry.done));
  check(
    [x, y].filter((outcome) => outcome.code === 0).length === 1 &&
      [x, y].some((outcome) => outcome.token === 'revision_not_submittable'),
    `C1: two submissions of one revision commit exactly one; the other is revision_not_submittable (${tokens([x, y])})`,
  );
  const winner = x.code === 0 ? x : y;
  check(
    reviewsOf(ids.revisions[c1]) === 1 &&
      dependenciesOf(ids.revisions[c1]) > 0 &&
      kit.eventCount(winner.response.id) === 1 &&
      kit.reviewState(winner.response.id) === 'open/1/0/-',
    'C1: one open review, its dependency rows and one event',
  );

  // ------------------------------------------------------------ C2 ----
  const c2 = 'race-sub-three';
  const request = kit.submitRequest(ids, c2);
  const same = [
    kit.callAsync(ids, SUBMIT, 'owner', request, 's11race-c2-x'),
    kit.callAsync(ids, SUBMIT, 'owner', request, 's11race-c2-y'),
  ];
  const [p, q] = await Promise.all(same.map((entry) => entry.done));
  check(
    p.code === 0 &&
      q.code === 0 &&
      JSON.stringify(p.response) === JSON.stringify(q.response),
    `C2: the same submission sent twice at once answers the same response both times (${tokens([p, q])})`,
  );
  check(
    reviewsOf(ids.revisions[c2]) === 1 && kit.eventCount(p.response.id) === 1,
    'C2: one review and one event (the duplicate replayed)',
  );

  // ------------------------------------------------------------ C3 ----
  const c3 = 'race-sub-gate-a';
  await kit.closeGate(SUBMIT_GATE);
  const parkedApp = `s10race-reserve-${SUBMIT_GATE}-submit`;
  const parked = kit.spawnSession(
    parkedApp,
    kit.commandScript(ids, SUBMIT, kit.submitRequest(ids, c3), 'owner'),
  );
  await kit.waitParked(parkedApp);
  const appending = kit.callAsync(
    ids,
    'cms_create_revision',
    'owner',
    kit.appendRequest(ids, c3, 'Appended while a submit is in flight'),
    's11race-c3-append',
  );
  check(
    (await kit.blockedOrCompleted('s11race-c3-append', appending.session)) ===
      'blocked',
    'C3: a revision append BLOCKS behind a submit parked after taking the entry row FOR SHARE (a review never freezes a draft superseded in between)',
  );
  await kit.openGate(SUBMIT_GATE);
  const submitted = await parked.done;
  const appended = await appending.done;
  const submittedResponse = JSON.parse(
    submitted.stdout
      .split('\n')
      .filter((line) => line.startsWith('{') && !line.includes('|'))
      .at(-1),
  );
  check(
    submitted.code === 0 && appended.code === 0,
    `C3: the submit committed first and the append after it, with no deadlock (${submitted.stderr.trim() || appended.stderr.trim() || 'no error'})`,
  );
  check(
    kit.reviewState(submittedResponse.id) ===
      'invalidated/2/0/revision_superseded' &&
      kit.count(
        `select count(*) from platform_private.cms_entry_revisions where entry_id = ${kit.sql(ids.entries[c3])};`,
      ) === 2,
    `C3: the append then invalidated the review revision_superseded (${kit.reviewState(submittedResponse.id)}): no stale live review`,
  );

  // ------------------------------------------------------------ C4 ----
  const c4 = 'race-sub-gate-b';
  const submitBuilt = kit.submitRequest(ids, c4);
  await kit.closeGate(APPEND_GATE);
  const gatedApp = `s10race-gated-${APPEND_GATE}-append`;
  const gated = kit.spawnSession(
    gatedApp,
    kit.commandScript(
      ids,
      'cms_create_revision',
      kit.appendRequest(ids, c4, 'Appended first'),
      'owner',
    ),
  );
  await kit.waitParked(gatedApp);
  const late = kit.callAsync(
    ids,
    SUBMIT,
    'owner',
    submitBuilt,
    's11race-c4-submit',
  );
  check(
    (await kit.blockedOrCompleted('s11race-c4-submit', late.session)) ===
      'blocked',
    'C4: a submit BLOCKS behind an append holding the entry row FOR UPDATE',
  );
  await kit.openGate(APPEND_GATE);
  const appendedFirst = await gated.done;
  const lateOutcome = await late.done;
  check(
    appendedFirst.code === 0 &&
      lateOutcome.token === 'VERSION_MISMATCH' &&
      reviewsOf(ids.revisions[c4]) === 0,
    `C4: once the append commits the late submit is VERSION_MISMATCH and no review exists (${lateOutcome.token ?? 'ok'})`,
  );
  console.log(
    '# all review-submit race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
