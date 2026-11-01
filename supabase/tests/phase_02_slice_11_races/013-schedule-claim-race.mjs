#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-20 `cms_claim_due_publication_schedules` and the lease
 * (BE03b "Schedule execution (CMS-03B-20)": FOR UPDATE SKIP LOCKED, the five-minute lease as the
 * crash-recovery fence, the 15 s / 60 s / 300 s retry ladder, retries_exhausted; tracker P2-S11-AC-079,
 * AC-080, AC-082, AC-083, AC-084).
 *
 *   C1  four sweepers claim at once over twelve due schedules: every schedule is claimed exactly once
 *       (no duplicate claim, no lost schedule), each under its own lease at version 2.
 *   C2  a schedule row held FOR UPDATE by another session is SKIPPED, not waited for: the claim completes
 *       with the other schedules and the held one stays pending until the lock is released.
 *   C3  crash recovery: leases that expired are returned to failed_retryable exactly once by two
 *       concurrent sweepers (attempt_count 1, one audit record each, no double recovery); a live lease is
 *       untouched; the recovered schedule is claimed by exactly one sweeper once its retry is due.
 *   C4  a slow worker holding the OLD lease is fenced out (no effect) and the new lease completes the
 *       schedule once: one lineage row, one event.
 *   C5  a schedule whose worker crashes four times in a row climbs the ladder (15 s, 60 s, 300 s) and is
 *       then blocked with retries_exhausted.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/publication-kit.mjs';

const { check } = kit;
const ids = kit.buildPublicationFixture();
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');

try {
  // ------------------------------------------------------------ C1 ----
  const c1 = Array.from({ length: 12 }, (_, index) => `cr-${index + 1}`);
  kit.makeDue(ids, c1);
  const sweepers = [0, 1, 2, 3].map((n) =>
    kit.claimAsync(5, `s11race-claim-c1-${n}`),
  );
  const swept = await Promise.all(sweepers.map((sweeper) => sweeper.done));
  check(
    swept.every(
      (outcome) => outcome.code === 0 && Array.isArray(outcome.response),
    ),
    `C1: four concurrent claims all answer (${tokens(swept)})`,
  );
  const claimed = swept.flatMap((outcome) => outcome.response);
  const claimedIds = claimed.map((entry) => entry.scheduleId);
  check(
    new Set(claimedIds).size === claimedIds.length &&
      claimedIds.length === 12 &&
      c1.every((tag) => claimedIds.includes(ids.schedules[tag])),
    `C1: all twelve due schedules are claimed exactly once across the four sweepers (${claimedIds.length} claims)`,
  );
  check(
    swept.every((outcome) => outcome.response.length <= 5) &&
      new Set(claimed.map((entry) => entry.leaseId)).size === 12 &&
      c1.every(
        (tag) => kit.scheduleState(ids, tag) === 'executing/2/0/-/lease',
      ),
    'C1: no sweeper exceeded its batch of 5, each schedule holds its own lease and is executing at version 2',
  );

  // ------------------------------------------------------------ C2 ----
  const c2 = ['sk-1', 'sk-2', 'sk-3'];
  kit.makeDue(ids, c2);
  const holder = await kit.holdScheduleLock(ids, 'sk-1', 'c2');
  const skipping = kit.claimAsync(25, 's11race-claim-c2');
  check(
    (await kit.blockedOrCompleted('s11race-claim-c2', skipping.session)) ===
      'completed',
    'C2: a claim does NOT wait on a schedule row locked by another session (SKIP LOCKED)',
  );
  const skipped = await skipping.done;
  check(
    skipped.code === 0 &&
      skipped.response.length === 2 &&
      !skipped.response.some(
        (entry) => entry.scheduleId === ids.schedules['sk-1'],
      ) &&
      kit.scheduleState(ids, 'sk-1') === 'pending/1/0/-/-' &&
      kit.scheduleState(ids, 'sk-2') === 'executing/2/0/-/lease' &&
      kit.scheduleState(ids, 'sk-3') === 'executing/2/0/-/lease',
    'C2: the unlocked schedules are claimed, the locked one is skipped and stays pending',
  );
  await holder.release();
  const afterRelease = kit.claim(25, 's11race-claim-c2-release');
  check(
    afterRelease.code === 0 &&
      afterRelease.response.length === 1 &&
      afterRelease.response[0].scheduleId === ids.schedules['sk-1'],
    'C2: once the lock is released the next claim takes the skipped schedule, and only it',
  );

  // ------------------------------------------------------------ C3 ----
  const c3 = ['lx-1', 'lx-2', 'lx-3'];
  kit.makeDue(ids, c3);
  const first = kit.claim(25, 's11race-claim-c3-first');
  const oldLease = Object.fromEntries(
    first.response.map((entry) => [entry.scheduleId, entry]),
  );
  check(
    first.code === 0 &&
      c3.every((tag) => oldLease[ids.schedules[tag]] !== undefined),
    'C3: worker A claims the three schedules and then "crashes" (never executes)',
  );
  kit.expireLease(ids, 'lx-1');
  kit.expireLease(ids, 'lx-2');
  const recovering = [
    kit.claimAsync(25, 's11race-claim-c3-b'),
    kit.claimAsync(25, 's11race-claim-c3-c'),
  ];
  const recovered = await Promise.all(
    recovering.map((sweeper) => sweeper.done),
  );
  check(
    recovered.every(
      (outcome) => outcome.code === 0 && outcome.response.length === 0,
    ),
    `C3: the recovering sweepers claim nothing (the recovered schedules wait for their retry) (${tokens(recovered)})`,
  );
  check(
    kit.scheduleState(ids, 'lx-1') === 'failed_retryable/3/1/-/-' &&
      kit.scheduleState(ids, 'lx-2') === 'failed_retryable/3/1/-/-' &&
      kit.scheduleState(ids, 'lx-3') === 'executing/2/0/-/lease',
    'C3: each expired lease was returned to failed_retryable exactly once (attempt_count 1, version 3); the live lease is untouched',
  );
  check(
    kit.scheduleAudits(ids, 'lx-1', 'cms.publication.schedule.retry') === 1 &&
      kit.scheduleAudits(ids, 'lx-2', 'cms.publication.schedule.retry') === 1,
    'C3: two concurrent sweepers recovered each schedule once: exactly one audit record per recovery',
  );
  check(
    Math.abs(kit.nextAttemptIn(ids, 'lx-1') - 15) <= 3,
    `C3: the first retry waits 15 s (${kit.nextAttemptIn(ids, 'lx-1')} s)`,
  );
  kit.retryDue(ids, 'lx-1');
  kit.retryDue(ids, 'lx-2');
  const contenders = [
    kit.claimAsync(25, 's11race-claim-c3-d'),
    kit.claimAsync(25, 's11race-claim-c3-e'),
  ];
  const contended = await Promise.all(
    contenders.map((sweeper) => sweeper.done),
  );
  const retaken = contended.flatMap((outcome) => outcome.response);
  check(
    retaken.length === 2 &&
      new Set(retaken.map((entry) => entry.scheduleId)).size === 2 &&
      kit.scheduleState(ids, 'lx-1') === 'executing/4/1/-/lease' &&
      kit.scheduleState(ids, 'lx-2') === 'executing/4/1/-/lease',
    'C3: the recovered schedules are claimed again by exactly one sweeper each once their retry is due (attempt_count kept)',
  );

  // ------------------------------------------------------------ C4 ----
  const staleClaim = oldLease[ids.schedules['lx-2']];
  const fenced = kit.execute(
    kit.executeRequest(staleClaim, kit.proofFor(ids, 'lx-2')),
    's11race-exec-c4-stale',
  );
  check(
    fenced.code !== 0 &&
      ['CONFLICT', 'VERSION_MISMATCH'].includes(fenced.token) &&
      kit.scheduleState(ids, 'lx-2') === 'executing/4/1/-/lease' &&
      kit.lineage(ids, 'lx-2') === '-',
    `C4: a worker holding the OLD lease is fenced out (${fenced.token ?? 'ok'}): no effect, no lineage row`,
  );
  const current = retaken.find(
    (entry) => entry.scheduleId === ids.schedules['lx-2'],
  );
  const completed = kit.execute(
    kit.executeRequest(current, kit.proofFor(ids, 'lx-2')),
    's11race-exec-c4-current',
  );
  check(
    completed.code === 0 &&
      completed.response.outcome === 'completed' &&
      kit.scheduleState(ids, 'lx-2') === 'completed/5/1/-/-' &&
      kit.lineage(ids, 'lx-2') === '1:publish:active' &&
      kit.publicationEvents(ids, 'lx-2') === 1,
    'C4: the new lease completes the schedule once: one lineage row, one cms.publication.changed.v1',
  );

  // ------------------------------------------------------------ C5 ----
  kit.makeDue(ids, ['lx-4']);
  const delays = [];
  for (const failure of [1, 2, 3]) {
    const taken = kit.claim(25, `s11race-claim-c5-${failure}`);
    check(
      taken.code === 0 &&
        taken.response.some(
          (entry) => entry.scheduleId === ids.schedules['lx-4'],
        ),
      `C5: attempt ${failure}: the schedule is claimed`,
    );
    kit.expireLease(ids, 'lx-4');
    kit.claim(25, `s11race-recover-c5-${failure}`);
    delays.push(kit.nextAttemptIn(ids, 'lx-4'));
    check(
      kit.scheduleState(ids, 'lx-4').startsWith('failed_retryable/') &&
        kit.scheduleState(ids, 'lx-4').split('/')[2] === String(failure),
      `C5: crash ${failure} returns the schedule to failed_retryable with attempt_count ${failure}`,
    );
    kit.retryDue(ids, 'lx-4');
  }
  check(
    Math.abs(delays[0] - 15) <= 3 &&
      Math.abs(delays[1] - 60) <= 3 &&
      Math.abs(delays[2] - 300) <= 3,
    `C5: the retry ladder waits 15 s, 60 s and 300 s (${delays.join(', ')} s)`,
  );
  kit.claim(25, 's11race-claim-c5-4');
  kit.expireLease(ids, 'lx-4');
  kit.claim(25, 's11race-recover-c5-4');
  check(
    kit.scheduleState(ids, 'lx-4').startsWith('blocked/') &&
      kit.scheduleState(ids, 'lx-4').endsWith('/3/retries_exhausted/-') &&
      kit.scheduleAudits(ids, 'lx-4', 'cms.publication.schedule.block') === 1,
    `C5: the fourth consecutive crash blocks the schedule with retries_exhausted (${kit.scheduleState(ids, 'lx-4')})`,
  );
  console.log(
    '# all schedule-claim race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
