/**
 * Strict assertion + durable-effect FACADE for the Slice 11 real-composition
 * suites (lane S11-4R). This module carries NO logic of its own: it re-exports the
 * PURE assertion core (`phase-02-slice-11-assert-core.ts`) and the DB-bearing
 * effect helpers (`phase-02-slice-11-effect.ts`). It is the single import site the
 * existing suites keep, so no consumer changes.

 * IMPORTANT: because it re-exports the effect helpers, importing THIS module pulls
 * in `phase-02-slice-11-effect.ts` -> `stack.ts`, whose module load runs
 * `statusEnv()`/`restSecret()` (a real DB/docker probe). A control that must run
 * with no DB effects imports the PURE core (`phase-02-slice-11-assert-core.ts`,
 * `phase-02-slice-11-snapshot-core.ts`) directly, never this facade.
 */
export {
  expectAbsent,
  expectEvidenceNull,
  expectEvidencePresent,
  expectSafeEqual,
  expectSafeError,
  expectSameInstant,
  expectStatus,
  parseApiError,
  safeResponse,
  sameInstant,
} from './phase-02-slice-11-assert-core';
export type { SafeErrorExpectation } from './phase-02-slice-11-assert-core';

export {
  EFFECT_TABLES,
  IDEMPOTENCY_TABLE,
  decodeSnapshot,
  expectUnchanged,
  idempotencyHashByteLength,
  idempotencyProjectedHashByteLength,
  idempotencyProjectionRowText,
  resourceDigest,
  snapshotDigest,
} from './phase-02-slice-11-effect';
export type {
  EffectSnapshot,
  RowTextOverrides,
  SnapshotOptions,
} from './phase-02-slice-11-effect';
