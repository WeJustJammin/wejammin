#!/usr/bin/env node

/**
 * Slice 10 N-session race evidence (BE03b "Rate buckets ... Concurrent revision
 * writes cap at three per actor, enforced in the database transaction (a per-actor
 * advisory lock count taken by cms_create_revision before insert) so the cap holds
 * across Worker isolates; a fourth concurrent write is refused with 429 before any
 * insert, and duplicate exact commands are replayed, not multiplied").  Each
 * in-flight append holds one of three per-actor advisory slots until its
 * transaction ends, so the cap counts real concurrent transactions rather than one
 * isolate's memory.
 *
 *   C1  three appends of one actor (three different entries) are held (gate) with
 *       their slots taken: a fourth is refused with RATE_LIMITED immediately,
 *       having written nothing (no entry, revision, value, key, outbox or audit row).
 *   C2  while the three slots are held, an exact replay of an already completed
 *       command still returns its first response (a replay is not a new write), and
 *       a different actor is not limited by this actor's slots.
 *   C3  once the held writers commit the slots are free again: a further append of
 *       the same actor succeeds.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/race-kit.mjs';

const { check } = kit;
const ids = kit.buildFixture();
kit.installGateTrigger();
const HOLD_GATE = 7401;
/** The article type's title field (the editor's assigned entry T1 is an article). */
const ARTICLE_TITLE = 'a9100000-0000-4000-8000-000000000101';

try {
  // A completed append whose exact command is replayed while the slots are full.
  const completed = kit.prepareWrite(ids, 'append');
  const firstResponse = kit.callCommand(ids, completed.fn, completed.request);
  const held = [
    kit.prepareWrite(ids, 'append'),
    kit.prepareWrite(ids, 'append'),
    kit.prepareWrite(ids, 'append'),
  ];
  const fourth = kit.prepareWrite(ids, 'append');
  await kit.closeGate(HOLD_GATE);
  const writers = held.map((write, index) =>
    kit.startGatedWrite(ids, { ...write, op: `cap${index}` }, HOLD_GATE),
  );
  for (const writer of writers) await kit.waitParked(writer.app);

  // ------------------------------------------------------------ C1 ----
  const snapshot = kit.counts();
  const refused = kit.runCapture(
    kit.commandScript(ids, fourth.fn, fourth.request, fourth.who),
    's10race-cap-fourth',
  );
  check(
    refused.code !== 0 && kit.errorMessage(refused) === 'RATE_LIMITED',
    `C1: a fourth concurrent revision write of one actor is refused with RATE_LIMITED (${kit.errorMessage(refused) ?? 'no error'})`,
  );
  check(
    kit.counts() === snapshot,
    'C1: the refused fourth write committed no entry, revision, value, relation, conflict, reservation, outbox or audit row',
  );

  // ------------------------------------------------------------ C2 ----
  const replay = kit.callCommand(ids, completed.fn, completed.request);
  check(
    JSON.stringify(replay) === JSON.stringify(firstResponse),
    'C2: an exact replay of a completed append is answered with its first response while the three slots are held',
  );
  const otherActor = kit.runCapture(
    kit.commandScript(
      ids,
      'cms_create_revision',
      kit.revisionRequest(
        ids,
        kit.TARGET.t1,
        { [ARTICLE_TITLE]: 'Editor append' },
        1,
        1,
        kit.nextKey('cap-editor'),
      ),
      'editor',
    ),
    's10race-cap-editor',
  );
  check(
    otherActor.code === 0,
    `C2: a different actor is not limited by this actor's slots and appends (${kit.errorMessage(otherActor) ?? 'no error'})`,
  );

  // ------------------------------------------------------------ C3 ----
  await kit.openGate(HOLD_GATE);
  const outcomes = await Promise.all(
    writers.map((writer) => writer.session.done),
  );
  check(
    outcomes.every((outcome) => outcome.code === 0),
    `C3: the three held writers committed (${outcomes.map((outcome) => kit.errorMessage(outcome) ?? 'ok').join(',')})`,
  );
  const afterwards = kit.callCommand(ids, fourth.fn, fourth.request);
  check(
    afterwards.id !== undefined && afterwards.entryId === fourth.entryId,
    'C3: once the slots are free the same actor appends again (the previously refused command now succeeds)',
  );
  console.log(
    '# all revision concurrency-cap race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
