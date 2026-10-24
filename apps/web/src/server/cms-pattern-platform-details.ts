import {
  CMS_BLOCK_RULES_REASON,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsBlockRulesDetails,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';

import {
  compositionDependencyDetails,
  isCompositionDependencyStatus,
} from './cms-composition-platform-dependency';
import { relayedResetAt } from './rate-limit-reset-at';

/**
 * The published `details` of a pattern-definition error (CMS-03C-12 and
 * `cmsPatternLatestRead`; BE03c "Normative application error catalog"). Nothing the
 * upstream wrote is published verbatim: every detail is rebuilt from the closed
 * vocabularies (the operation's reason tokens, its request pointers, the rate
 * hints) and a detail that does not verify is dropped, never repaired.
 */
export type PatternProxyOperation = 'CMS-03C-12' | 'cmsPatternLatestRead';
export type Details = Record<string, unknown>;

const ALL: readonly number[] = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];

/** FE03 :1108 and :1847: the statuses each operation documents (any other is a 502). */
export const PATTERN_DECLARED_STATUSES: Readonly<
  Record<PatternProxyOperation, ReadonlySet<number>>
> = {
  'CMS-03C-12': new Set(ALL),
  cmsPatternLatestRead: new Set([
    400, 401, 403, 404, 415, 429, 500, 502, 503, 504,
  ]),
};

/** The request pointers a validation failure may name, in the order they are published. */
const POINTERS: Readonly<Record<PatternProxyOperation, readonly string[]>> = {
  'CMS-03C-12': [
    '/patternKey',
    '/compatibleTypeIds',
    '/blockTree',
    '/blockRegistryDigest',
    '/expectedVersion',
  ],
  cmsPatternLatestRead: ['/patternKey'],
};

export const PATTERN_KEY_POINTER = '/patternKey';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const patternViolation = (path: string, code = 'invalid') => ({
  path,
  code,
  message: 'The value is invalid.',
});

/** The bounded violation list for the pointers `named` (attacker member names fall to `/`). */
const pointerViolations = (
  operation: PatternProxyOperation,
  named: readonly string[],
): ReturnType<typeof patternViolation>[] => {
  const known = POINTERS[operation];
  const present = new Set(
    named.map((path) => (known.includes(path) ? path : '/')),
  );
  return [
    ...known.filter((path) => present.has(path)),
    ...(present.has('/') ? ['/'] : []),
  ]
    .slice(0, 50)
    .map((path) => patternViolation(path));
};

/**
 * The pointer-only violations of a body the contract refused: the first path
 * segment when it is a request member, else `/`. No submitted value is echoed.
 */
export const patternViolationsOf = (
  operation: PatternProxyOperation,
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): ReturnType<typeof patternViolation>[] =>
  pointerViolations(
    operation,
    issues.slice(0, 50).map((issue) => {
      const first = issue.path[0];
      return first === undefined ? '/' : `/${String(first)}`;
    }),
  );

/** The one registered token of this operation that `upstream` names at `status`, or null. */
const typedReason = (
  operation: PatternProxyOperation,
  status: number,
  upstream: unknown,
): string | null => {
  if (!isRecord(upstream)) return null;
  const reason = CmsSlice12ReasonCodeSchema.safeParse(upstream.reasonCode);
  return reason.success &&
    cmsSlice12ReasonStatus(reason.data) === status &&
    (CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).includes(
      reason.data,
    )
    ? reason.data
    : null;
};

/** A key_reserved refusal always carries its request pointer (BE03c E13). */
export const reservedKeyDetails = (): Details => ({
  reasonCode: 'key_reserved',
  violations: [patternViolation(PATTERN_KEY_POINTER, 'key_reserved')],
});

const rateHints = (upstream: unknown): Details => {
  if (!isRecord(upstream)) return {};
  const output: Details = {};
  for (const key of ['retryAfterSeconds', 'limit'] as const) {
    const value = upstream[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      output[key] = value;
  }
  const resetAt = relayedResetAt(upstream.resetAt, 'epoch-string');
  if (resetAt !== null) output.resetAt = resetAt;
  return output;
};

const versionHints = (upstream: unknown): Details => {
  if (!isRecord(upstream)) return {};
  const output: Details = {};
  for (const key of ['expectedVersion', 'currentVersion'] as const) {
    const value = upstream[key];
    if (typeof value === 'string' && isCmsVersion(value)) output[key] = value;
  }
  return output;
};

/** The published `details` of one pattern error; a detail that does not verify is dropped. */
export const projectPatternErrorDetails = (
  operation: PatternProxyOperation,
  status: number,
  upstream: unknown,
): Details => {
  if (status === 401)
    return isRecord(upstream) && upstream.recoveryAction === 'reauthenticate'
      ? { recoveryAction: 'reauthenticate' }
      : {};
  if (status === 415) return { allowedMediaTypes: ['application/json'] };
  if (isCompositionDependencyStatus(status))
    return { ...compositionDependencyDetails() };
  if (status === 429) return rateHints(upstream);
  const reason = typedReason(operation, status, upstream);
  if (status === 403) return reason === null ? {} : { reasonCode: reason };
  if (status === 409)
    return reason === null ? versionHints(upstream) : { reasonCode: reason };
  if (status === 400 || status === 422) {
    if (reason === 'key_reserved') return reservedKeyDetails();
    // DEC-210: the one reason that keeps its /blockTree node violation (CMS-03C-12 only).
    if (reason === CMS_BLOCK_RULES_REASON)
      return { ...cmsBlockRulesDetails(upstream, 'CMS-03C-12') };
    if (reason !== null) return { reasonCode: reason };
    const violations =
      isRecord(upstream) && Array.isArray(upstream.violations)
        ? pointerViolations(
            operation,
            (upstream.violations as unknown[])
              .slice(0, 50)
              .map((entry) =>
                isRecord(entry) && typeof entry.path === 'string'
                  ? entry.path
                  : '/',
              ),
          )
        : [];
    return violations.length > 0 ? { violations } : {};
  }
  return {};
};
