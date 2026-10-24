/**
 * DB-BEARING world-scope digest for the Slice 11 sweep suites (lane claude_s12_s11_sweep_isolation).
 * Imports `./stack`, whose module load observes Docker/statusEnv: a pure control imports
 * `phase-02-slice-11-world-scope-core.ts` instead.
 */
import {
  decodeSnapshot,
  type EffectSnapshot,
} from './phase-02-slice-11-snapshot-core';
import {
  scopedSnapshotSql,
  worldIdsOf,
  worldScheduleCountSql,
} from './phase-02-slice-11-world-scope-core';
import { psql } from './stack';

export {
  claimsInWorld,
  expectWorldClaims,
} from './phase-02-slice-11-world-scope-core';

/**
 * `snapshotDigest()` restricted to the rows reachable from `worldIds` (schedule ids this suite created):
 * the same fourteen groups, the same whole-row hashing, but another suite's schedules, entries, audit
 * records and outbox events cannot move it. Fails loudly when a world id does not exist, so a typo can
 * never produce a vacuous (all-empty) digest.
 */
export const scopedSnapshotDigest = (
  worldIds: readonly string[],
): EffectSnapshot => {
  const ids = worldIdsOf(worldIds);
  if (Number(psql(worldScheduleCountSql(ids))) !== ids.length)
    throw new Error('world scope names a schedule that does not exist');
  return decodeSnapshot(psql(scopedSnapshotSql(ids)));
};
