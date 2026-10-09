#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-18 `cms_assign_editorial_reviewer` (BE03b
 * "Review scopes, reviewer assignment and decision evaluation (DEC-136)", DEC-157: assignment
 * serializes on the review row FOR UPDATE with an exact review-version check, the review version
 * does not advance, the <= 16 active count is checked under that lock, and the partial unique
 * (review_id, reviewer) where active is the backstop; tracker P2-S11-AC-070, AC-071, AC-119).
 *
 *   A1  two creates of ONE reviewer under different keys race: exactly one commits, the other is
 *       the typed assignment_exists (never a raw unique violation), one row, one event.
 *   A2  a review with fifteen active assignments and two creates for two different eligible
 *       reviewers: the count is checked under the review lock, so exactly one commits and the
 *       other is assignment_limit (sixteen rows, never seventeen).
 *   A3  two revokes of ONE assignment race: exactly one commits (200), the other is CONFLICT; the
 *       assignment is revoked at version 2 and the review version never moved.
 *   A4  the command takes the review row lock: with the row held FOR UPDATE by another session a
 *       create BLOCKS, and once the holder ends it completes with its normal result.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/review-kit.mjs';

const { check } = kit;
const ids = kit.buildReviewFixture();
kit.installGateTrigger();

try {
  // ------------------------------------------------------------ A1 ----
  const a1 = ids.reviews['race-assign-1'];
  const twins = [
    kit.callAsync(
      ids,
      'cms_assign_editorial_reviewer',
      'owner',
      kit.assignRequest(ids, a1, 1),
      's11race-a1-x',
    ),
    kit.callAsync(
      ids,
      'cms_assign_editorial_reviewer',
      'owner',
      kit.assignRequest(ids, a1, 1),
      's11race-a1-y',
    ),
  ];
  const [x, y] = await Promise.all(twins.map((twin) => twin.done));
  const winners = [x, y].filter((outcome) => outcome.code === 0);
  check(
    winners.length === 1 &&
      [x, y].some((outcome) => outcome.token === 'assignment_exists'),
    `A1: two creates of one reviewer commit exactly one assignment; the other is assignment_exists (${[x, y].map((o) => o.token ?? 'ok').join(',')})`,
  );
  check(
    kit.activeAssignments(a1) === 1 &&
      kit.eventCount(a1) === 1 &&
      kit.reviewState(a1) === 'open/1/0/-',
    'A1: one active row, one review-changed event and the review untouched at version 1',
  );

  // ------------------------------------------------------------ A2 ----
  const a2 = ids.reviews['race-assign-limit'];
  const limit = [
    kit.callAsync(
      ids,
      'cms_assign_editorial_reviewer',
      'owner',
      kit.assignRequest(ids, a2, 1, {
        reviewerPersonId: ids.actors.rvA.person,
      }),
      's11race-a2-x',
    ),
    kit.callAsync(
      ids,
      'cms_assign_editorial_reviewer',
      'owner',
      kit.assignRequest(ids, a2, 1, {
        reviewerPersonId: ids.actors.rvB.person,
      }),
      's11race-a2-y',
    ),
  ];
  const [p, q] = await Promise.all(limit.map((entry) => entry.done));
  check(
    [p, q].filter((outcome) => outcome.code === 0).length === 1 &&
      [p, q].some((outcome) => outcome.token === 'assignment_limit'),
    `A2: with one slot left two creates race: exactly one commits and the other is assignment_limit (${[p, q].map((o) => o.token ?? 'ok').join(',')})`,
  );
  check(
    kit.activeAssignments(a2) === 16 && kit.eventCount(a2) === 1,
    'A2: sixteen active assignments (never seventeen) and one event',
  );

  // ------------------------------------------------------------ A3 ----
  const a3 = ids.reviews['race-assign-revoke'];
  const assignment = ids.assignments['race-revoke-asg'];
  const revokes = [
    kit.callAsync(
      ids,
      'cms_assign_editorial_reviewer',
      'owner',
      kit.revokeRequest(ids, a3, 1, assignment),
      's11race-a3-x',
    ),
    kit.callAsync(
      ids,
      'cms_assign_editorial_reviewer',
      'owner',
      kit.revokeRequest(ids, a3, 1, assignment),
      's11race-a3-y',
    ),
  ];
  const [m, n] = await Promise.all(revokes.map((entry) => entry.done));
  check(
    [m, n].filter((outcome) => outcome.code === 0).length === 1 &&
      [m, n].some((outcome) => outcome.token === 'CONFLICT'),
    `A3: two revokes of one assignment commit exactly one; the other is CONFLICT (${[m, n].map((o) => o.token ?? 'ok').join(',')})`,
  );
  check(
    kit.value(
      `select state || '/' || version from platform_private.cms_editorial_review_assignments where id = ${kit.sql(assignment)};`,
    ) === 'revoked/2' &&
      kit.reviewState(a3) === 'open/1/0/-' &&
      kit.eventCount(a3) === 1,
    'A3: the assignment is revoked at version 2, the review version never moved and one event was emitted',
  );

  // ------------------------------------------------------------ A4 ----
  const a4 = ids.reviews['race-assign-lock'];
  const holder = await kit.holdReviewLock(a4, 'assign');
  const blocked = kit.callAsync(
    ids,
    'cms_assign_editorial_reviewer',
    'owner',
    kit.assignRequest(ids, a4, 1),
    's11race-a4-create',
  );
  check(
    (await kit.blockedOrCompleted('s11race-a4-create', blocked.session)) ===
      'blocked',
    'A4: a create BLOCKS behind a session holding the review row FOR UPDATE (the command takes the review lock)',
  );
  await holder.release();
  const released = await blocked.done;
  check(
    released.code === 0 &&
      kit.activeAssignments(a4) === 1 &&
      kit.reviewState(a4) === 'open/1/0/-',
    `A4: once the lock is released the create completes normally (${released.token ?? 'ok'}) and the review is untouched`,
  );
  console.log(
    '# all review-assignment race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
