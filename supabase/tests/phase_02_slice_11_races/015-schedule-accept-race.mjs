#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-07 `cms_schedule_publication` (BE03b "Recent MFA (E6)",
 * "Review invalidation", global lock order positions 0, 1, 4, 5; unique schedule identity (entry, revision,
 * action, local time, timezone, audience); tracker P2-S11-AC-020, AC-022, AC-111, AC-112).
 *
 *   S1  the SAME schedule request sent twice at once: one schedule, one audit record, the same resource twice.
 *   S2  the same identity under two keys: exactly one commits, the other is the typed CONFLICT (never a raw
 *       unique violation).
 *   S3  a schedule parked after taking the entry row FOR SHARE and its authority locks BLOCKS a revision
 *       append; the schedule commits pending, then the append commits, invalidates the review and cancels
 *       the pending schedule (approval_invalidated): no deadlock, no schedule left running against a stale
 *       approval.
 *   S4  an append parked holding the entry row FOR UPDATE BLOCKS a schedule; once it commits the schedule is
 *       VERSION_MISMATCH and none exists.
 *   S5  a schedule and a manual publish of the SAME approved review at once: both commit (they serialize on
 *       the review row), the review stays approved, no deadlock.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/publication-kit.mjs';

const { check } = kit;
const ids = kit.buildPublicationFixture();
kit.installGateTrigger();
const SCHEDULE_GATE = 7704;
const APPEND_GATE = 7705;
const SCHEDULE = 'cms_schedule_publication';
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');

try {
  // ------------------------------------------------------------ S1 ----
  const request = kit.scheduleRequest(ids, 'sa-1');
  const twins = [
    kit.callAsync(ids, SCHEDULE, 'pub', request, 's11race-schedule-s1-a'),
    kit.callAsync(ids, SCHEDULE, 'pub', request, 's11race-schedule-s1-b'),
  ];
  const [a, b] = await Promise.all(twins.map((entry) => entry.done));
  check(
    a.code === 0 &&
      b.code === 0 &&
      JSON.stringify(a.response) === JSON.stringify(b.response) &&
      kit.schedulesOf(ids, 'sa-1') === 1,
    `S1: the same schedule request sent twice at once answers the same resource twice and creates one schedule (${tokens([a, b])})`,
  );

  // ------------------------------------------------------------ S2 ----
  const base = kit.scheduleRequest(ids, 'sa-2');
  const rivals = [
    kit.callAsync(ids, SCHEDULE, 'pub', base, 's11race-schedule-s2-a'),
    kit.callAsync(
      ids,
      SCHEDULE,
      'pub',
      { ...base, idempotencyKey: kit.newKey('s2-other') },
      's11race-schedule-s2-b',
    ),
  ];
  const [x, y] = await Promise.all(rivals.map((entry) => entry.done));
  check(
    [x, y].filter((outcome) => outcome.code === 0).length === 1 &&
      [x, y].some((outcome) => outcome.token === 'CONFLICT') &&
      kit.schedulesOf(ids, 'sa-2') === 1,
    `S2: one identity under two keys commits exactly one schedule; the other is the typed CONFLICT (${tokens([x, y])})`,
  );

  // ------------------------------------------------------------ S3 ----
  await kit.closeGate(SCHEDULE_GATE);
  const parkedApp = `s10race-reserve-${SCHEDULE_GATE}-schedule`;
  const parked = kit.spawnSession(
    parkedApp,
    kit.commandScript(ids, SCHEDULE, kit.scheduleRequest(ids, 'sa-3'), 'pub'),
  );
  await kit.waitParked(parkedApp);
  const appending = kit.callAsync(
    ids,
    'cms_create_revision',
    'owner',
    kit.appendRequest(ids, 'sa-3', 'Appended while a schedule is in flight'),
    's11race-s3-append',
  );
  check(
    (await kit.blockedOrCompleted('s11race-s3-append', appending.session)) ===
      'blocked',
    'S3: a revision append BLOCKS behind a schedule parked after taking the entry row FOR SHARE and its authority locks',
  );
  await kit.openGate(SCHEDULE_GATE);
  const scheduled = await parked.done;
  const appended = await appending.done;
  check(
    scheduled.code === 0 && appended.code === 0,
    `S3: the schedule committed first and the append after it, with no deadlock (${scheduled.stderr.trim() || appended.stderr.trim() || 'no error'})`,
  );
  check(
    kit.reviewState(ids.reviews['sa-3']) ===
      'invalidated/3/1/revision_superseded' &&
      kit.runValue(
        `select state || '/' || coalesce(reason_code, '-') from platform_private.cms_publication_schedules where revision_id = ${kit.sql(ids.revisions['sa-3'])};`,
      ) === 'cancelled/approval_invalidated',
    'S3: the append then invalidated the review and cancelled the pending schedule (approval_invalidated)',
  );

  // ------------------------------------------------------------ S4 ----
  const late = kit.scheduleRequest(ids, 'sa-4');
  await kit.closeGate(APPEND_GATE);
  const gatedApp = `s10race-gated-${APPEND_GATE}-append`;
  const gated = kit.spawnSession(
    gatedApp,
    kit.commandScript(
      ids,
      'cms_create_revision',
      kit.appendRequest(ids, 'sa-4', 'Appended first'),
      'owner',
    ),
  );
  await kit.waitParked(gatedApp);
  const lateCall = kit.callAsync(
    ids,
    SCHEDULE,
    'pub',
    late,
    's11race-s4-schedule',
  );
  check(
    (await kit.blockedOrCompleted('s11race-s4-schedule', lateCall.session)) ===
      'blocked',
    'S4: a schedule BLOCKS behind an append holding the entry row FOR UPDATE',
  );
  await kit.openGate(APPEND_GATE);
  const appendedFirst = await gated.done;
  const lateOutcome = await lateCall.done;
  check(
    appendedFirst.code === 0 &&
      lateOutcome.token === 'VERSION_MISMATCH' &&
      kit.schedulesOf(ids, 'sa-4') === 0,
    `S4: once the append commits the late schedule is VERSION_MISMATCH and no schedule exists (${lateOutcome.token ?? 'ok'})`,
  );

  // ------------------------------------------------------------ S5 ----
  const mixed = [
    kit.callAsync(
      ids,
      SCHEDULE,
      'pub',
      kit.scheduleRequest(ids, 'sa-5'),
      's11race-s5-schedule',
    ),
    kit.callAsync(
      ids,
      'cms_publish_revision',
      'pub',
      kit.publishRequest(ids, 'sa-5'),
      's11race-s5-publish',
    ),
  ];
  const [sch, pub] = await Promise.all(mixed.map((entry) => entry.done));
  check(
    sch.code === 0 &&
      pub.code === 0 &&
      kit.schedulesOf(ids, 'sa-5') === 1 &&
      kit.lineage(ids, 'sa-5') === '1:publish:active' &&
      kit.reviewState(ids.reviews['sa-5']) === 'approved/2/1/-',
    `S5: a schedule and a manual publish of one approved review both commit and the review stays approved (${tokens([sch, pub])})`,
  );
  console.log(
    '# all schedule-accept race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
