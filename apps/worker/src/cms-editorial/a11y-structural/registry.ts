import {
  CMS_A11Y_CHECKER_KEY,
  CMS_A11Y_CHECKER_TIMEOUT_MS,
  CMS_A11Y_CHECKER_VERSION,
} from '@wejammin/contracts';

import type { AccessibilityCheckerInput } from './input-schema';

/*
 * The code-owned checker registry (BE05c "Accessibility and content-quality
 * checker", registry row). Slice 11 delivers the row of
 * `cms.a11y.structural` version 1; Slice 16 builds the `quality_check` action,
 * its persistence and the stale test ("the checker version is no longer
 * current") on this same registry.
 *
 * The registry rules, enforced when a registry is defined:
 *  - a checker key is a BE05c `Key`, a version a positive decimal integer of
 *    at most 18 digits, a target type `^[a-z][a-z0-9._-]{1,63}$`;
 *  - `timeoutMs` is an integer from 100 to 2,000 wall-clock milliseconds;
 *  - a (checker key, version) pair is registered once and names one target type;
 *  - every version stays readable (`find`, `versionsOf`) however old;
 *  - the registry marks exactly one current version per target type
 *    (`currentFor`), so a gate call always runs one unambiguous checker.
 */

/** BE05c `Key`: lowercase segments joined by `.`, `_` or `-`. */
const CHECKER_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){0,15}$/u;
const CHECKER_KEY_MAX_CHARACTERS = 128;
/** BE05c `Version`: a positive decimal integer, at most 18 digits. */
const CHECKER_VERSION_PATTERN = /^[1-9][0-9]{0,17}$/u;
const TARGET_TYPE_PATTERN = /^[a-z][a-z0-9._-]{1,63}$/u;
const TIMEOUT_MIN_MS = 100;

/** BE05c: the target of the accessibility checker is a revision of a CMS entry. */
export const CMS_ENTRY_REVISION_TARGET_TYPE = 'cms.entry_revision' as const;

export type CheckerRegistration = Readonly<{
  checkerKey: string;
  /** A positive decimal integer, as BE05c `Version` writes it. */
  checkerVersion: string;
  targetType: string;
  /** Exactly one registration per target type is current. */
  current: boolean;
  /** Wall-clock budget covering input load and evaluation (100 to 2,000). */
  timeoutMs: number;
}>;

export type CheckerRegistryErrorCode =
  | 'empty_registry'
  | 'key_invalid'
  | 'version_invalid'
  | 'target_type_invalid'
  | 'timeout_out_of_range'
  | 'duplicate_registration'
  | 'no_current_version'
  | 'multiple_current_versions';

export class CheckerRegistryError extends Error {
  readonly code: CheckerRegistryErrorCode;

  constructor(code: CheckerRegistryErrorCode, detail: string) {
    super(`checker registry: ${code} (${detail})`);
    this.name = 'CheckerRegistryError';
    this.code = code;
  }
}

export type CheckerRegistry = Readonly<{
  /** Every registered version, sorted by checker key and then by version number. */
  registrations: readonly CheckerRegistration[];
  /** A registered version, current or older; undefined when it was never registered. */
  find: (
    checkerKey: string,
    checkerVersion: string,
  ) => CheckerRegistration | undefined;
  /** Every readable version of one checker, ascending by version number. */
  versionsOf: (checkerKey: string) => readonly CheckerRegistration[];
  /** The one current registration for a target type. */
  currentFor: (targetType: string) => CheckerRegistration | undefined;
  isCurrent: (checkerKey: string, checkerVersion: string) => boolean;
}>;

/** Total order of distinct registrations: checker key, then version number. */
const compareRegistrations = (
  left: CheckerRegistration,
  right: CheckerRegistration,
): number => {
  if (left.checkerKey !== right.checkerKey)
    return left.checkerKey < right.checkerKey ? -1 : 1;
  // A (key, version) pair is registered once, so two versions never tie.
  return BigInt(left.checkerVersion) < BigInt(right.checkerVersion) ? -1 : 1;
};

const assertFields = (row: CheckerRegistration): void => {
  const label = `${row.checkerKey} ${row.checkerVersion}`;
  if (
    row.checkerKey.length > CHECKER_KEY_MAX_CHARACTERS ||
    !CHECKER_KEY_PATTERN.test(row.checkerKey)
  )
    throw new CheckerRegistryError('key_invalid', label);
  if (!CHECKER_VERSION_PATTERN.test(row.checkerVersion))
    throw new CheckerRegistryError('version_invalid', label);
  if (!TARGET_TYPE_PATTERN.test(row.targetType))
    throw new CheckerRegistryError('target_type_invalid', label);
  if (
    !Number.isInteger(row.timeoutMs) ||
    row.timeoutMs < TIMEOUT_MIN_MS ||
    row.timeoutMs > CMS_A11Y_CHECKER_TIMEOUT_MS
  )
    throw new CheckerRegistryError('timeout_out_of_range', label);
};

/** Validates the rows and returns the frozen, queryable registry. */
export const defineCheckerRegistry = (
  rows: readonly CheckerRegistration[],
): CheckerRegistry => {
  if (rows.length === 0)
    throw new CheckerRegistryError('empty_registry', 'no registration');
  const seen = new Set<string>();
  for (const row of rows) {
    assertFields(row);
    const identity = `${row.checkerKey}@${BigInt(row.checkerVersion)}`;
    if (seen.has(identity))
      throw new CheckerRegistryError('duplicate_registration', identity);
    seen.add(identity);
  }

  const registrations = rows
    .map((row) => Object.freeze({ ...row }))
    .sort(compareRegistrations);
  const currentByTarget = new Map<string, CheckerRegistration>();
  for (const row of registrations) {
    const known = currentByTarget.get(row.targetType);
    if (row.current && known !== undefined)
      throw new CheckerRegistryError(
        'multiple_current_versions',
        row.targetType,
      );
    if (row.current) currentByTarget.set(row.targetType, row);
  }
  for (const row of registrations)
    if (!currentByTarget.has(row.targetType))
      throw new CheckerRegistryError('no_current_version', row.targetType);

  const find = (
    checkerKey: string,
    checkerVersion: string,
  ): CheckerRegistration | undefined =>
    registrations.find(
      (row) =>
        row.checkerKey === checkerKey && row.checkerVersion === checkerVersion,
    );
  return Object.freeze({
    registrations: Object.freeze(registrations),
    find,
    versionsOf: (checkerKey) =>
      registrations.filter((row) => row.checkerKey === checkerKey),
    currentFor: (targetType) => currentByTarget.get(targetType),
    isCurrent: (checkerKey, checkerVersion) =>
      find(checkerKey, checkerVersion)?.current === true,
  });
};

/** The Phase 2 registry: one checker, one version, one target type. */
export const ACCESSIBILITY_CHECKER_REGISTRY: CheckerRegistry =
  defineCheckerRegistry([
    {
      checkerKey: CMS_A11Y_CHECKER_KEY,
      checkerVersion: CMS_A11Y_CHECKER_VERSION,
      targetType: CMS_ENTRY_REVISION_TARGET_TYPE,
      current: true,
      timeoutMs: CMS_A11Y_CHECKER_TIMEOUT_MS,
    },
  ]);

export type CheckerTarget = Readonly<{
  targetType: typeof CMS_ENTRY_REVISION_TARGET_TYPE;
  targetId: string;
  targetVersion: string;
}>;

/** BE05c target: the revision uuid and its `revision_number`. */
export const checkerTargetOf = (
  input: Pick<AccessibilityCheckerInput, 'revisionId' | 'revisionNumber'>,
): CheckerTarget => ({
  targetType: CMS_ENTRY_REVISION_TARGET_TYPE,
  targetId: input.revisionId,
  targetVersion: input.revisionNumber,
});
