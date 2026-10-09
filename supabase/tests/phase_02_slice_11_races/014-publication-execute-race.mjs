#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-09 `cms_publish_revision` and CMS-03B-20
 * `cms_execute_publication_schedule` (BE03b "Publication lineage (E3)": two commands racing on one lineage
 * never commit a duplicate or a gap, the loser of a unique-key collision is publication_conflict; global
 * lock order positions 0, 1, 4, 5, 6, 7; exactly one cms.publication.changed.v1 per appended row; tracker
 * P2-S11-AC-032, AC-080, AC-083, AC-084, AC-114, AC-116).
 *
 *   E1  the SAME claimed schedule executed by two workers at once: one `completed`, one `already_completed`
 *       naming the same lineage row; one row, one event, one audit record (outbox dedupe).
 *   E2  a manual publish and a scheduled publish of the same lineage at once: both commit, versions 1 and 2,
 *       two events, no typed conflict, no deadlock.
 *   E3  two manual publishes of one lineage under different keys: both commit (1 and 2), two events.
 *   E4  the SAME publish under one key sent twice at once: one row, one event, the same answer twice.
 *   E5  a publish parked after taking the entry row FOR SHARE and its authority locks BLOCKS a revision
 *       append; the publish commits, then the append commits and invalidates the review
 *       (revision_superseded): no deadlock, the publication is not lost.
 *   E6  an append parked holding the entry row FOR UPDATE BLOCKS a publish; once it commits the publish is
 *       VERSION_MISMATCH (the review moved) and no lineage row exists.
 *   E7  a schedule execution parked after taking every lock (entry, authority, schema, review, schedule,
 *       lineage) right before its lineage insert BLOCKS a revision append; both commit, no deadlock, the
 *       completed schedule is untouched by the later invalidation.
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
const PUBLISH = 'cms_publish_revision';
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');

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

  // ------------------------------------------------------------ E2 ----
  kit.makeDue(ids, ['pe-1']);
  const peClaim = kit
    .claim(25, 's11race-claim-e2')
    .response.find((entry) => entry.scheduleId === ids.schedules['pe-1']);
  const scheduled = kit.executeAsync(
    kit.executeRequest(peClaim, kit.proofFor(ids, 'pe-1')),
    's11race-exec-e2',
  );
  const manual = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'pe-1'),
    's11race-publish-e2',
  );
  const [se, ma] = await Promise.all([scheduled.done, manual.done]);
  check(
    se.code === 0 &&
      ma.code === 0 &&
      se.response.outcome === 'completed' &&
      kit.lineage(ids, 'pe-1') === '1:publish:active,2:publish:active',
    `E2: a scheduled and a manual publish of one lineage both commit as versions 1 and 2 (${tokens([se, ma])}; ${kit.lineage(ids, 'pe-1')})`,
  );
  check(
    kit.publicationEvents(ids, 'pe-1') === 2 &&
      kit.publicationAudits(ids, 'pe-1') === 2,
    'E2: exactly one event and one audit record per appended row, no typed conflict and no deadlock',
  );

  // ------------------------------------------------------------ E3 ----
  const dualFirst = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'dp-1'),
    's11race-publish-e3-a',
  );
  const dualSecond = kit.callAsync(
    ids,
    PUBLISH,
    'pub',
    kit.publishRequest(ids, 'dp-1'),
    's11race-publish-e3-b',
  );
  const dual = await Promise.all([dualFirst.done, dualSecond.done]);
  check(
    dual.every((outcome) => outcome.code === 0) &&
      kit.lineage(ids, 'dp-1') === '1:publish:active,2:publish:active' &&
      kit.publicationEvents(ids, 'dp-1') === 2,
    `E3: two manual publishes under different keys commit as versions 1 and 2 with two events (${tokens(dual)})`,
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
  console.log(
    '# all publication / execution race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
