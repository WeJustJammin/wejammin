#!/usr/bin/env node

/**
 * Slice 10 two-session race evidence (IA03 "Authority revoked ..." edge case; Codex
 * adversarial review H1, P2-S10-AC-051/AC-006): a COMMITTED revocation of the
 * writer's authority must win over an in-flight create / append / resolve / restore.
 * Authority over an entry is a confirmed membership tenure, an active actor grant
 * and (for an existing entry) an active entry assignment; each command takes
 * FOR SHARE locks on those authority-bearing rows (person, tenure, grants,
 * assignments, in the order the revocation code path takes them) BEFORE its
 * capability check, so the revoking UPDATE or DELETE and the write serialize, and
 * a revocation that commits first is seen by the check.
 *
 *   S1  the writer is held (gate) after its authority check and before its first
 *       revision insert; the revocation (grant, tenure or assignment) BLOCKS behind
 *       it, the writer commits one revision, and only then does the revocation
 *       commit.  Without the locks the revocation commits while the writer is held
 *       and the writer then commits a revision on authority that was already gone.
 *   S2  the revocation is in flight (its row locks held, uncommitted) when the
 *       writer starts: the writer BLOCKS on the authority rows, and once the
 *       revocation commits it is refused (FORBIDDEN) having written nothing.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/race-kit.mjs';

const { check } = kit;
const ids = kit.buildFixture();
kit.installGateTrigger();
const WRITER_GATE = 7201;
const REVOKER_GATE = 7202;

try {
  for (const op of kit.WRITE_OPS) {
    for (const [name, revoker] of Object.entries(kit.REVOKERS)) {
      const label = `${op}/${name}`;
      if (!revoker.appliesTo({ entryId: op === 'create' ? null : 'entry' }))
        continue;
      // ------------------------------------------------------ S1 ----
      const held = kit.prepareWrite(ids, op);
      const before = kit.revisionTotal();
      await kit.closeGate(WRITER_GATE);
      const gated = kit.startGatedWrite(ids, held, WRITER_GATE);
      await kit.waitParked(gated.app);
      const revokingApp = `s10race-revoke-s1-${op}-${name}`;
      const revoking = kit.runAsync(
        revokingApp,
        kit.revokerScript(revoker.apply(ids, held)),
      );
      check(
        (await kit.blockedOrCompleted(revokingApp, revoking)) === 'blocked',
        `S1 ${label}: a revocation of the writer's authority is blocked behind a writer held after its authority check (the writer holds the authority rows)`,
      );
      await kit.openGate(WRITER_GATE);
      const writerOutcome = await gated.session.done;
      const revokeOutcome = await revoking.done;
      check(
        writerOutcome.code === 0 && kit.revisionTotal() === before + 1,
        `S1 ${label}: the held writer committed exactly one revision (${kit.errorMessage(writerOutcome) ?? 'no error'})`,
      );
      check(
        revokeOutcome.code === 0 &&
          kit.runValue(revoker.revoked(ids, held)) === 't',
        `S1 ${label}: the revocation committed only after the writer, and then took effect`,
      );
      kit.restoreAuthority(revoker, ids, held);

      // ------------------------------------------------------ S2 ----
      const waiting = kit.prepareWrite(ids, op);
      const snapshot = kit.counts();
      await kit.closeGate(REVOKER_GATE);
      const inFlightApp = `s10race-gated-${REVOKER_GATE}-revoke-${op}-${name}`;
      const inFlight = kit.runAsync(
        inFlightApp,
        kit.revokerScript(revoker.apply(ids, waiting), REVOKER_GATE),
      );
      await kit.waitParked(inFlightApp);
      const late = kit.startGatedWrite(ids, waiting, 99);
      check(
        (await kit.blockedOrCompleted(late.app, late.session)) === 'blocked',
        `S2 ${label}: a writer that starts while a revocation of its authority is in flight blocks on the authority rows`,
      );
      await kit.openGate(REVOKER_GATE);
      const refused = await late.session.done;
      await inFlight.done;
      check(
        refused.code !== 0 && kit.errorMessage(refused) === 'FORBIDDEN',
        `S2 ${label}: once the revocation committed the writer was refused with FORBIDDEN (${kit.errorMessage(refused) ?? 'no error'})`,
      );
      check(
        kit.counts() === snapshot,
        `S2 ${label}: the refused writer committed no entry, revision, value, relation, conflict, reservation, outbox or audit row`,
      );
      kit.restoreAuthority(revoker, ids, waiting);
    }
  }
  console.log(
    '# all authority-revocation race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
