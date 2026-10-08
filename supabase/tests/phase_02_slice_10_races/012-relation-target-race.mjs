#!/usr/bin/env node

/**
 * Slice 10 two-session race evidence (BE03b "Value encodings by field kind":
 * relation; Codex adversarial review H3, P2-S10-AC-031/AC-073/AC-074): the target of
 * a relation value is checked (visible to the caller, active, pinned version) and
 * then written by the command; a target that advances, is archived or loses the
 * caller's assignment in between must not leave a committed revision whose relation
 * is already stale.  Every external content target is locked FOR SHARE (entry row,
 * then the caller's assignments on it) in ascending id order BEFORE it is checked,
 * and the lock is held to commit.  For create, append and the conflict resolution
 * with a relation choice, against each target mutation (the target's version bump,
 * archive, assignment revocation):
 *
 *   S1  the writer is held (gate) after its relation check and before its first
 *       revision insert: the target mutation BLOCKS behind it, the writer commits,
 *       and only then does the mutation commit.  Without the lock the mutation
 *       commits while the writer is held and the writer then commits a relation
 *       pinned to a target that is already gone or changed.
 *   S2  the target mutation is in flight (uncommitted) when the writer starts: the
 *       writer BLOCKS on the target row, and once the mutation commits it is refused
 *       with the uniform VALIDATION_FAILED having written nothing.
 *   D1  two appenders that reference each other's entry (each holds its own entry
 *       FOR UPDATE and wants the other's row FOR SHARE) deadlock; PostgreSQL's
 *       detector aborts one and the command returns the typed CONFLICT (no SQLSTATE
 *       40P01 leaks); the other commits.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/race-kit.mjs';

const { check } = kit;
const ids = kit.buildFixture();
kit.installGateTrigger();
const WRITER_GATE = 7301;
const MUTATOR_GATE = 7302;
const DEADLOCK_GATE = 7303;
/** The article type's own relation field (relation fixture type `article`, 0..1 to article). */
const ARTICLE_RELATED = 'a9100000-0000-4000-8000-000000000102';

const prepare = (op, target) =>
  op === 'resolve'
    ? kit.prepareRelationResolve(ids, target)
    : kit.prepareRelationWrite(ids, op, target);

try {
  for (const op of ['create', 'append', 'resolve']) {
    for (const [name, mutator] of Object.entries(kit.TARGET_MUTATORS)) {
      const label = `${op}/${name}`;
      // ------------------------------------------------------ S1 ----
      const heldTarget = kit.seedArticleTarget(ids);
      const held = prepare(op, heldTarget);
      const before = kit.revisionTotal();
      await kit.closeGate(WRITER_GATE);
      const gated = kit.startGatedWrite(ids, held, WRITER_GATE);
      await kit.waitParked(gated.app);
      const mutatingApp = `s10race-mutate-s1-${op}-${name}`;
      const mutating = kit.runAsync(
        mutatingApp,
        kit.revokerScript(mutator.apply(ids, heldTarget)),
      );
      check(
        (await kit.blockedOrCompleted(mutatingApp, mutating)) === 'blocked',
        `S1 ${label}: a change of the relation target is blocked behind a writer held after its relation check (the writer holds the target rows)`,
      );
      await kit.openGate(WRITER_GATE);
      const writerOutcome = await gated.session.done;
      const mutateOutcome = await mutating.done;
      check(
        writerOutcome.code === 0 && kit.revisionTotal() === before + 1,
        `S1 ${label}: the held writer committed exactly one revision (${kit.errorMessage(writerOutcome) ?? 'no error'})`,
      );
      check(
        mutateOutcome.code === 0,
        `S1 ${label}: the target change committed only after the writer`,
      );

      // ------------------------------------------------------ S2 ----
      const lateTarget = kit.seedArticleTarget(ids);
      const waiting = prepare(op, lateTarget);
      const snapshot = kit.counts();
      await kit.closeGate(MUTATOR_GATE);
      const inFlightApp = `s10race-gated-${MUTATOR_GATE}-mutate-${op}-${name}`;
      const inFlight = kit.runAsync(
        inFlightApp,
        kit.revokerScript(mutator.apply(ids, lateTarget), MUTATOR_GATE),
      );
      await kit.waitParked(inFlightApp);
      const late = kit.startGatedWrite(ids, waiting, 99);
      check(
        (await kit.blockedOrCompleted(late.app, late.session)) === 'blocked',
        `S2 ${label}: a writer that starts while a change of its relation target is in flight blocks on the target row`,
      );
      await kit.openGate(MUTATOR_GATE);
      const refused = await late.session.done;
      await inFlight.done;
      check(
        refused.code !== 0 && kit.errorMessage(refused) === 'VALIDATION_FAILED',
        `S2 ${label}: once the target change committed the writer was refused with VALIDATION_FAILED (${kit.errorMessage(refused) ?? 'no error'})`,
      );
      check(
        kit.counts() === snapshot,
        `S2 ${label}: the refused writer committed no entry, revision, value, relation, conflict, reservation, outbox or audit row`,
      );
    }
  }

  // ------------------------------------------------- carried relations ----
  // Append, resolve and restore CARRY the relations of the current draft / source
  // revision: their external targets are locked FOR SHARE before the carried-relation
  // guards re-check them.  (A carried relation is not re-authorized, so only the
  // target row's version bump and archive apply.)
  const refusals = {
    append: 'DEPENDENCY_UNAVAILABLE',
    resolve: 'DEPENDENCY_UNAVAILABLE',
    restore: 'migration_chain_incomplete',
  };
  for (const op of ['append', 'resolve', 'restore']) {
    for (const name of ['bump', 'archive']) {
      const mutator = kit.TARGET_MUTATORS[name];
      const label = `carried ${op}/${name}`;
      const prepareCarried = () => {
        const target = kit.seedArticleTarget(ids);
        const pinned = kit.relation({
          id: target,
          pin: String(kit.entryVersion(target)),
        });
        return {
          target,
          write: kit.prepareWrite(ids, op, {}, { [kit.FIELD.related]: pinned }),
        };
      };
      const heldCarried = prepareCarried();
      const before = kit.revisionTotal();
      await kit.closeGate(WRITER_GATE);
      const gated = kit.startGatedWrite(ids, heldCarried.write, WRITER_GATE);
      await kit.waitParked(gated.app);
      const mutatingApp = `s10race-mutate-c1-${op}-${name}`;
      const mutating = kit.runAsync(
        mutatingApp,
        kit.revokerScript(mutator.apply(ids, heldCarried.target)),
      );
      check(
        (await kit.blockedOrCompleted(mutatingApp, mutating)) === 'blocked',
        `S1 ${label}: a change of a CARRIED relation target is blocked behind a writer held after its carried-relation check`,
      );
      await kit.openGate(WRITER_GATE);
      const writerOutcome = await gated.session.done;
      const mutateOutcome = await mutating.done;
      check(
        writerOutcome.code === 0 && kit.revisionTotal() === before + 1,
        `S1 ${label}: the held writer committed exactly one revision (${kit.errorMessage(writerOutcome) ?? 'no error'})`,
      );
      check(
        mutateOutcome.code === 0,
        `S1 ${label}: the target change committed only after the writer`,
      );

      const lateCarried = prepareCarried();
      const snapshot = kit.counts();
      await kit.closeGate(MUTATOR_GATE);
      const inFlightApp = `s10race-gated-${MUTATOR_GATE}-mutate-c2-${op}-${name}`;
      const inFlight = kit.runAsync(
        inFlightApp,
        kit.revokerScript(mutator.apply(ids, lateCarried.target), MUTATOR_GATE),
      );
      await kit.waitParked(inFlightApp);
      const late = kit.startGatedWrite(ids, lateCarried.write, 99);
      check(
        (await kit.blockedOrCompleted(late.app, late.session)) === 'blocked',
        `S2 ${label}: a writer that starts while a change of its carried relation target is in flight blocks on the target row`,
      );
      await kit.openGate(MUTATOR_GATE);
      const refused = await late.session.done;
      await inFlight.done;
      check(
        refused.code !== 0 && kit.errorMessage(refused) === refusals[op],
        `S2 ${label}: once the target change committed the writer was refused with ${refusals[op]} (${kit.errorMessage(refused) ?? 'no error'})`,
      );
      check(
        kit.counts() === snapshot,
        `S2 ${label}: the refused writer committed nothing`,
      );
    }
  }

  // ---------------------------------------------------------- D1 ----
  const left = kit.TARGET.t1;
  const right = kit.TARGET.t2;
  const mutual = (entry, other) =>
    kit.revisionRequest(
      ids,
      entry,
      {
        [ARTICLE_RELATED]: kit.relation({
          id: other,
          pin: String(kit.entryVersion(other)),
        }),
      },
      1,
      1,
      kit.nextKey('mutual'),
    );
  await kit.closeGate(DEADLOCK_GATE);
  const reserveApp = (label) => `s10race-reserve-${DEADLOCK_GATE}-${label}`;
  const first = kit.runAsync(
    reserveApp('first'),
    kit.commandScript(ids, 'cms_create_revision', mutual(left, right)),
  );
  const second = kit.runAsync(
    reserveApp('second'),
    kit.commandScript(ids, 'cms_create_revision', mutual(right, left)),
  );
  await kit.waitParked(reserveApp('first'));
  await kit.waitParked(reserveApp('second'));
  const revisionsBefore = kit.revisionTotal();
  await kit.openGate(DEADLOCK_GATE);
  const outcomes = [await first.done, await second.done];
  const winners = outcomes.filter((outcome) => outcome.code === 0);
  const losers = outcomes.filter((outcome) => outcome.code !== 0);
  check(
    winners.length === 1 && losers.length === 1,
    `D1: of two appenders that reference each other's entry exactly one committed (${outcomes.map((o) => o.code).join(',')})`,
  );
  check(
    kit.errorMessage(losers[0]) === 'CONFLICT' &&
      !/40P01|deadlock/iu.test(losers[0].stderr.split('\n')[0]),
    `D1: the deadlock victim got the typed CONFLICT, not SQLSTATE 40P01 (${kit.errorMessage(losers[0]) ?? 'no error'})`,
  );
  check(
    kit.revisionTotal() === revisionsBefore + 1,
    'D1: exactly one revision was committed by the pair',
  );
  console.log(
    '# all relation-target race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
