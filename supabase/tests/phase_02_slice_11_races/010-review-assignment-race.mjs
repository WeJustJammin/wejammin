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
 *       reviewers: a holder session owns the review row FOR UPDATE, so BOTH creates are observed
 *       parked on that lock (each before its first write to the assignments table, i.e. on the
 *       command's own review lock and not on the insert guard) before it is released; then
 *       exactly one commits and the other is assignment_limit (sixteen rows, never seventeen).
 *   A3  two revokes of ONE assignment race: exactly one commits (200), the other is CONFLICT; the
 *       assignment is revoked at version 2 and the review version never moved.
 *   A4  the command takes the review row lock: with the row held FOR UPDATE by another session a
 *       create BLOCKS, and once the holder ends it completes with its normal result.
 *   A5  grantor authority is re-proved under the position 1 locks (BE03b "Write-path lock order and
 *       authority fencing" rule 1, CMS-03B-18 "grantor authority end"): a create passes its unlocked
 *       check on the still-committed owner cms.editor grant and then BLOCKS on the authority rows
 *       that a revoking session holds uncommitted; once the revocation commits the create is
 *       403 capability_missing and nothing is written, and the same request (same key) succeeds
 *       after the grant is restored.
 *   A6  the owner scope is re-proved the same way: a revoke blocked behind the owner's membership
 *       tenure end is NOT_FOUND (concealed) once the tenure end commits; the assignment stays active.
 *   A7  control for A5/A6: a REVOKE needs the owner receipt only, so a revoke blocked behind the
 *       revocation of the owner's cms.editor grant still commits (200).
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/review-kit.mjs';

const { check } = kit;
const ids = kit.buildReviewFixture();
kit.installGateTrigger();
const AUTHORITY_GATE = 7511;
const ASSIGN = 'cms_assign_editorial_reviewer';

/**
 * Starts an authority-loss transaction that has executed its UPDATE (row locks held) and then
 * waits, uncommitted, on the closed gate.  `commit` opens the gate, so the loss commits; it
 * resolves the revoking session's outcome.
 */
const parkAuthorityLoss = async (label, statement) => {
  const app = `s11race-${label}`;
  await kit.closeGate(AUTHORITY_GATE);
  const session = kit.spawnSession(
    app,
    kit.revokerScript(statement, AUTHORITY_GATE),
  );
  await kit.waitParked(app);
  return {
    app,
    commit: async () => {
      await kit.openGate(AUTHORITY_GATE);
      return session.done;
    },
  };
};

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
  // A holder owns the review row FOR UPDATE, so both creates are forced to overlap: neither can
  // finish before the other has started.  Each is observed parked before it has written anything to
  // the assignments table, which places the wait on the command's own review lock (the independent
  // insert guard of 20261005017020 locks the review row and recounts too, but only AFTER an insert).
  const a2 = ids.reviews['race-assign-limit'];
  const slot = await kit.holdReviewLock(a2, 'limit');
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
  const parked = await Promise.all([
    kit.blockedOrCompleted('s11race-a2-x', limit[0].session),
    kit.blockedOrCompleted('s11race-a2-y', limit[1].session),
  ]);
  check(
    parked.every((state) => state === 'blocked'),
    `A2: both creates are parked behind a session holding the review row FOR UPDATE, so the two callers genuinely overlap (${parked.join(',')})`,
  );
  const waiting = ['s11race-a2-x', 's11race-a2-y'];
  const blockers = waiting.map((app) => kit.blockedBy(app));
  check(
    blockers.every(
      (list, index) =>
        list.length > 0 &&
        list.every(
          (app) =>
            app !== waiting[index] && [slot.app, ...waiting].includes(app),
        ),
    ) && blockers.some((list) => list.includes(slot.app)),
    `A2: each parked create waits only on the holder or on the other create, and the holder blocks the queue (${blockers.map((list) => list.join('+')).join(' | ')})`,
  );
  check(
    waiting.every(
      (app) =>
        !kit.holdsWriteLock(
          app,
          'platform_private.cms_editorial_review_assignments',
        ),
    ),
    "A2: neither parked create has written the assignments table yet: both wait on the command's own review lock, not on the insert guard",
  );
  await slot.release();
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

  // ------------------------------------------------------------ A5 ----
  // BE03b "Write-path lock order and authority fencing" rule 1: the capability is re-proved under
  // the position 1 locks.  The loss of the grantor authority is committed WHILE the create waits for
  // those locks: the create passes its unlocked check on the still-committed grant, then blocks on
  // the authority rows an uncommitted revocation holds.
  const reservations = kit.assignmentReservations();
  const editorEvents = kit.eventCount(a4);
  const editorLoss = await parkAuthorityLoss(
    'a5-revoke-editor',
    kit.grantUpdate(ids, 'owner', 'cms.editor', false),
  );
  const staleCreate = kit.assignRequest(ids, a4, 1, {
    reviewerPersonId: ids.actors.rvB.person,
  });
  const creating = kit.callAsync(
    ids,
    ASSIGN,
    'owner',
    staleCreate,
    's11race-a5-create',
  );
  check(
    (await kit.blockedOrCompleted('s11race-a5-create', creating.session)) ===
      'blocked' && kit.blockedBy('s11race-a5-create').join() === editorLoss.app,
    'A5: a create whose unlocked check passes on the still-committed cms.editor grant BLOCKS on the authority rows held by an uncommitted revocation of that grant',
  );
  const editorLost = await editorLoss.commit();
  const refusedCreate = await creating.done;
  check(
    editorLost.code === 0 && refusedCreate.token === 'capability_missing',
    `A5: once the revocation commits, the waiting create re-proves the grantor under its locks and is refused capability_missing (${refusedCreate.token ?? 'ok'})`,
  );
  check(
    kit.activeAssignments(a4) === 1 &&
      kit.eventCount(a4) === editorEvents &&
      kit.reviewState(a4) === 'open/1/0/-' &&
      kit.assignmentReservations() === reservations,
    'A5: the refused create wrote no assignment, event or idempotency reservation and left the review at version 1',
  );
  kit.commitStatement(kit.grantUpdate(ids, 'owner', 'cms.editor', true));
  const retried = kit.call(
    ids,
    ASSIGN,
    'owner',
    staleCreate,
    's11race-a5-retry',
  );
  check(
    retried.code === 0 && kit.activeAssignments(a4) === 2,
    `A5: the very same request (same key) succeeds once the grant is restored, so the refusal was the revoked grant alone and reserved nothing (${retried.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ A6 ----
  // The owner scope is re-proved the same way: the owner's membership tenure ends while a revoke
  // waits for the authority locks, so the review is concealed (NOT_FOUND) once the end commits.
  const target = kit.value(
    `select id from platform_private.cms_editorial_review_assignments where review_id = ${kit.sql(a1)}::uuid and state = 'active';`,
  );
  const tenureEvents = kit.eventCount(a1);
  const tenureReservations = kit.assignmentReservations();
  const tenureLoss = await parkAuthorityLoss(
    'a6-end-tenure',
    kit.tenureUpdate(ids, 'owner', true),
  );
  const lateRevoke = kit.callAsync(
    ids,
    ASSIGN,
    'owner',
    kit.revokeRequest(ids, a1, 1, target),
    's11race-a6-revoke',
  );
  check(
    (await kit.blockedOrCompleted('s11race-a6-revoke', lateRevoke.session)) ===
      'blocked' && kit.blockedBy('s11race-a6-revoke').join() === tenureLoss.app,
    'A6: a revoke whose unlocked owner check passes BLOCKS on the authority rows held by an uncommitted end of the owner membership tenure',
  );
  const tenureEnded = await tenureLoss.commit();
  const concealed = await lateRevoke.done;
  check(
    tenureEnded.code === 0 && concealed.token === 'NOT_FOUND',
    `A6: once the tenure end commits, the waiting revoke re-proves the owner scope under its locks and the review is concealed NOT_FOUND (${concealed.token ?? 'ok'})`,
  );
  check(
    kit.value(
      `select state || '/' || version from platform_private.cms_editorial_review_assignments where id = ${kit.sql(target)}::uuid;`,
    ) === 'active/1' &&
      kit.eventCount(a1) === tenureEvents &&
      kit.reviewState(a1) === 'open/1/0/-' &&
      kit.assignmentReservations() === tenureReservations,
    'A6: the concealed revoke left the assignment active at version 1 and wrote no event or idempotency reservation',
  );
  kit.commitStatement(kit.tenureUpdate(ids, 'owner', false));

  // ------------------------------------------------------------ A7 ----
  // Control: a revoke needs the owner receipt only, so the loss of the cms.editor grant that stops a
  // create (A5) does not stop a revoke that was waiting behind it.
  const revokeLoss = await parkAuthorityLoss(
    'a7-revoke-editor',
    kit.grantUpdate(ids, 'owner', 'cms.editor', false),
  );
  const revokeAnyway = kit.callAsync(
    ids,
    ASSIGN,
    'owner',
    kit.revokeRequest(ids, a1, 1, target),
    's11race-a7-revoke',
  );
  check(
    (await kit.blockedOrCompleted(
      's11race-a7-revoke',
      revokeAnyway.session,
    )) === 'blocked' &&
      kit.blockedBy('s11race-a7-revoke').join() === revokeLoss.app,
    'A7: a revoke BLOCKS on the authority rows held by an uncommitted revocation of the owner cms.editor grant',
  );
  const revokeLost = await revokeLoss.commit();
  const revoked = await revokeAnyway.done;
  check(
    revokeLost.code === 0 &&
      revoked.code === 0 &&
      revoked.response?.state === 'revoked',
    `A7: the waiting revoke still commits after the cms.editor grant was lost: a revoke needs the owner receipt only (${revoked.token ?? 'ok'})`,
  );
  check(
    kit.value(
      `select state || '/' || version from platform_private.cms_editorial_review_assignments where id = ${kit.sql(target)}::uuid;`,
    ) === 'revoked/2' &&
      kit.reviewState(a1) === 'open/1/0/-' &&
      kit.eventCount(a1) === tenureEvents + 1,
    'A7: the assignment is revoked at version 2, the review version never moved and one event was emitted',
  );
  kit.commitStatement(kit.grantUpdate(ids, 'owner', 'cms.editor', true));
  console.log(
    '# all review-assignment race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
