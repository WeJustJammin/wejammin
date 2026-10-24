#!/usr/bin/env node

/**
 * CMS-03C-06 authority-fence race. Runs in the canonical db:verify gate against the S10/S11 container.
 * S1 observes revoker -> writer -> subject-holder in one pg_blocking_pids probe, then checks
 * the exact review/dependency/lifecycle/audit/idempotency effects. S2 commits revocation first,
 * then refuses both a new submission and the exact previously completed request with no body
 * and no changed rows. This proves one ordinary-template authority-grant schedule only.
 *
 * Standalone: NEVER import this file for checking. Its top level opens real database sessions.
 * Requires governed GREEN and a freshly reset disposable database; it has no ALT gate of its own (its target is the S10/S11 container chain).
 */
import assert from 'node:assert/strict';

import {
  check,
  outcomeOf,
  sql,
  startSession,
} from './phase_02_slice_12_governed_authority/governed-authority-processes.mjs';
import {
  cleanupSessions,
  queryValue,
} from './phase_02_slice_12_governed_authority/governed-authority-execution.mjs';
import {
  buildGovernedFixture,
  commandScript,
  grantActive,
  grantRevokeScript,
  submitRequest,
} from './phase_02_slice_12_governed_authority/governed-authority-kit.mjs';
import {
  holdSubjectLock,
  observedBlockedBy,
  observedWaitChain,
  sqlError,
} from './phase_02_slice_12_governed_authority/governed-authority-sessions.mjs';
import {
  assertRefusal,
  assertSubmissionEffects,
  snapshot,
} from './phase_02_slice_12_governed_authority/governed-authority-assertions.mjs';

let primaryFailure;
try {
  check(
    (await queryValue(
      "select to_regprocedure('platform_api.cms_submit_governed_review(jsonb)') is not null;",
    )) === 't',
    'control: the real governed submit transport exists',
  );
  check(
    (await queryValue(
      "select has_function_privilege('service_role', 'platform_api.cms_submit_governed_review(jsonb)', 'EXECUTE');",
    )) === 't',
    'control: the Worker database role holds EXECUTE on the transport',
  );

  const ids = await buildGovernedFixture();
  const initial = await snapshot();
  for (const subjectId of [ids.subject1, ids.subject2]) {
    const subject = initial.subjects.find((row) => row.id === subjectId);
    assert.ok(subject, 'control: CMS-03C-01 did not persist a subject');
    assert.deepEqual(
      {
        state: subject.state,
        lifecycle: subject.lifecycle_version,
        definition: subject.version,
        compatible: subject.compatible_type_ids,
        owner: subject.owner_id,
      },
      {
        state: 'draft',
        lifecycle: 1,
        definition: 1,
        compatible: [ids.typeId],
        owner: ids.org,
      },
    );
  }
  check(
    (await grantActive(ids)) &&
      (await queryValue(`select state from platform_private.cms_content_type_versions
      where id = ${sql(ids.typeVersion)}::uuid and content_type_id = ${sql(ids.typeId)}::uuid;`)) ===
        'active',
    'control: real S09 active type, real designer grant, two CMS-03C-01 draft subjects',
  );

  // S1: acquiring authority must precede waiting for this exact subject version.
  const request1 = submitRequest(ids, ids.subject1, ids.subject1Hash, 's1');
  const holder = await holdSubjectLock(ids.subject1);
  const writer = startSession('writer-s1', commandScript(ids, request1));
  check(
    await observedBlockedBy(writer, holder),
    'S1: application writer blocks behind the subject FOR UPDATE holder',
  );
  const revoker = startSession('revoker-s1', grantRevokeScript(ids, false));
  check(
    await observedWaitChain(revoker, writer, holder),
    'S1: same probe observes revoker blocked BY writer while writer is blocked BY subject holder',
  );

  await holder.release();
  const [writerOutcome, revokerOutcome] = await Promise.all([
    outcomeOf(writer),
    outcomeOf(revoker),
  ]);
  assert.equal(
    revokerOutcome.code,
    0,
    `S1 revoke failed: ${JSON.stringify(sqlError(revokerOutcome))}`,
  );
  await assertSubmissionEffects(ids, request1, writerOutcome, initial);
  check(
    !(await grantActive(ids)),
    'S1: grant revocation completed after the writer released its authority fence',
  );

  await queryValue(grantRevokeScript(ids, true), 'restore-s1');
  check(await grantActive(ids), 'S1: restore the exact grant before S2');

  // S2: wait for an actual COMMIT before starting either refused writer.
  const revokeFirst = startSession('revoker-s2', grantRevokeScript(ids, false));
  const revoked = await outcomeOf(revokeFirst);
  check(
    revoked.code === 0 && !(await grantActive(ids)),
    'S2: revocation committed before either writer starts',
  );

  const beforeRefusal = await snapshot();
  const request2 = submitRequest(ids, ids.subject2, ids.subject2Hash, 's2');
  const refused = startSession('writer-s2', commandScript(ids, request2));
  await assertRefusal(
    await outcomeOf(refused),
    beforeRefusal,
    'S2 new request',
  );

  // The exact successful S1 key/body is essential: a fresh key cannot prove cached-body denial.
  const replay = startSession('revoked-replay', commandScript(ids, request1));
  await assertRefusal(
    await outcomeOf(replay),
    beforeRefusal,
    'S2 completed-key replay',
  );

  await queryValue(grantRevokeScript(ids, true), 'restore-s2');
  check(await grantActive(ids), 'S2: exact grant restored');
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  try {
    await cleanupSessions();
  } catch (cleanupError) {
    if (primaryFailure)
      throw new AggregateError(
        [primaryFailure, cleanupError],
        'race and cleanup failed',
      );
    throw cleanupError;
  }
}

console.log(
  '# governed-authority assertions and exact-session cleanup passed; reset before the next suite',
);
