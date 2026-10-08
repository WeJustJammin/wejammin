/**
 * BE03b error-detail allowlists for the first-party CMS editorial web boundary
 * (BE03b:1239): 400/422 carry at most 50 JSON-pointer violations; 401 only a
 * recovery action; 403 a registered reason; 404 and 500 nothing; 409 the
 * conflict kind, recovery, an authorized expected/current version and, for the
 * operations that own one, a typed reason; 429 the limit hints; 502/503/504 the
 * dependency class and retry hints.
 *
 * The proxy never relays an upstream message or an upstream detail value
 * verbatim (Codex review M2): every published detail is rebuilt from this
 * closed vocabulary, per operation, so a database diagnostic or a tenant
 * identifier that slips into a detail cannot reach the browser.
 */

export type CmsEditorialErrorDetailPolicy = Readonly<{
  /** Typed 422 reasons this operation may publish. */
  reasons422: ReadonlySet<string>;
  /** Typed 409 reasons this operation may publish. */
  reasons409: ReadonlySet<string>;
}>;

const NONE: ReadonlySet<string> = new Set();

/** BE03b:1049-1054 value reasons: create, autosave and conflict resolution. */
const VALUE_REASONS: ReadonlySet<string> = new Set([
  'rich_text_not_canonical',
  'object_kind_unspecified',
  'object_property_invalid',
  'relation_target_unavailable',
  'taxonomy_source_unavailable',
  'media_source_unavailable',
]);

/** BE03b:1211 comparison refusals owned by the history read. */
const COMPARISON_REASONS: ReadonlySet<string> = new Set([
  'comparison_too_large',
  'comparison_unavailable',
]);

/** BE03b:1213 and :1345 restore refusals. */
const RESTORE_REASONS: ReadonlySet<string> = new Set([
  'migration_chain_mismatch',
  'migration_chain_unavailable',
  'migration_chain_incomplete',
  'template_incompatible',
]);

export const CMS_EDITORIAL_DETAIL_POLICIES = {
  /** Reads with no typed reason of their own. */
  read: { reasons422: NONE, reasons409: NONE },
  /** CMS-03B-01, -02 and -10. */
  valueWrite: { reasons422: VALUE_REASONS, reasons409: NONE },
  /** CMS-03B-03 history and comparison. */
  history: { reasons422: COMPARISON_REASONS, reasons409: NONE },
  /** CMS-03B-04 restore. */
  restore: { reasons422: NONE, reasons409: RESTORE_REASONS },
} as const satisfies Readonly<Record<string, CmsEditorialErrorDetailPolicy>>;

const CONFLICT_KINDS: ReadonlySet<string> = new Set([
  'VERSION_MISMATCH',
  'IDEMPOTENCY_MISMATCH',
  'INVALID_TRANSITION',
]);
const RECOVERY_ACTIONS: ReadonlySet<string> = new Set([
  'reload',
  'refresh',
  'reauthenticate',
  'use_new_idempotency_key',
]);
const FORBIDDEN_REASONS: ReadonlySet<string> = new Set([
  'ASSIGNMENT_REQUIRED',
  'CAPABILITY_REQUIRED',
  'entry_not_assigned',
]);
const DEPENDENCY_CLASSES: ReadonlySet<string> = new Set([
  'cms_editorial',
  'authentication',
  'request_context',
  'rate_limiter',
]);

const BARE_VERSION = /^[1-9]\d{0,18}$/u;
const SAFE_POINTER = /^(?:\/(?:[A-Za-z0-9_.-]|~[01])*){1,32}$/u;
const VIOLATION_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/u;
const RESET_AT = /^\d{1,12}$/u;
const MAX_VIOLATIONS = 50;
const VIOLATION_MESSAGE = 'The value is invalid.';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safePointer = (value: unknown): string =>
  typeof value === 'string' && value.length <= 256 && SAFE_POINTER.test(value)
    ? value
    : '/';

export type CmsEditorialViolation = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

const upstreamViolations = (value: unknown): CmsEditorialViolation[] =>
  Array.isArray(value)
    ? value
        .filter(isRecord)
        .slice(0, MAX_VIOLATIONS)
        .map((entry) => ({
          path: safePointer(entry.path),
          code:
            typeof entry.code === 'string' && VIOLATION_CODE.test(entry.code)
              ? entry.code
              : 'invalid',
          message: VIOLATION_MESSAGE,
        }))
    : [];

type ZodIssueLike = Readonly<{
  path: readonly PropertyKey[];
  message: string;
  code?: string;
  keys?: readonly string[];
}>;

/**
 * Local Zod failures publish exactly the Worker's `details.violations` shape
 * (apps/worker/src/cms-editorial/admission-common.ts `issues`): one pointer per
 * issue, an unrecognized key reported as `unknown_field`, the code the issue's
 * own lowercase message token or `invalid_value`, and a fixed safe message.
 */
export const cmsEditorialZodViolations = (
  issues: readonly ZodIssueLike[],
): CmsEditorialViolation[] =>
  issues
    .flatMap((issue) =>
      issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)
        ? issue.keys.map((key) => ({
            path: [...issue.path, key],
            code: 'unknown_field',
          }))
        : [
            {
              path: [...issue.path],
              code: VIOLATION_CODE.test(issue.message)
                ? issue.message
                : 'invalid_value',
            },
          ],
    )
    .slice(0, MAX_VIOLATIONS)
    .map((issue) => ({
      path: safePointer(
        `/${issue.path
          .map((part) =>
            String(part).replaceAll('~', '~0').replaceAll('/', '~1'),
          )
          .join('/')}`,
      ),
      code: issue.code,
      message: VIOLATION_MESSAGE,
    }));

const integerIn = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : null;

const stringIn = (
  value: unknown,
  allowed: ReadonlySet<string>,
): string | null =>
  typeof value === 'string' && allowed.has(value) ? value : null;

/** Rebuild the published details of an upstream error from the closed vocabulary. */
export const projectCmsEditorialErrorDetails = (
  status: number,
  upstream: unknown,
  policy: CmsEditorialErrorDetailPolicy,
): Record<string, unknown> => {
  if (status === 404 || status === 500 || !isRecord(upstream)) return {};
  const details: Record<string, unknown> = {};
  if (status === 400 || status === 422) {
    const violations = upstreamViolations(upstream.violations);
    if (violations.length > 0) details.violations = violations;
    const reason = stringIn(upstream.reasonCode, policy.reasons422);
    if (status === 422 && reason !== null) details.reasonCode = reason;
  } else if (status === 401) {
    if (upstream.recoveryAction === 'reauthenticate')
      details.recoveryAction = 'reauthenticate';
  } else if (status === 403) {
    const reason = stringIn(upstream.reasonCode, FORBIDDEN_REASONS);
    if (reason !== null) details.reasonCode = reason;
  } else if (status === 409) {
    const conflict = stringIn(upstream.conflict, CONFLICT_KINDS);
    if (conflict !== null) details.conflict = conflict;
    const recovery = stringIn(upstream.recoveryAction, RECOVERY_ACTIONS);
    if (recovery !== null) details.recoveryAction = recovery;
    const reason = stringIn(upstream.reasonCode, policy.reasons409);
    if (reason !== null) details.reasonCode = reason;
    for (const key of ['expectedVersion', 'currentVersion'] as const) {
      const version = upstream[key];
      if (typeof version === 'string' && BARE_VERSION.test(version))
        details[key] = version;
    }
  } else if (status === 415) {
    const media = Array.isArray(upstream.allowedMediaTypes)
      ? upstream.allowedMediaTypes
          .filter(
            (value): value is string =>
              typeof value === 'string' && MEDIA_TYPE.test(value),
          )
          .slice(0, 8)
      : [];
    details.allowedMediaTypes = media;
  } else if (status === 429) {
    const limit = integerIn(upstream.limit, 1, 10_000);
    if (limit !== null) details.limit = limit;
    if (typeof upstream.resetAt === 'string' && RESET_AT.test(upstream.resetAt))
      details.resetAt = upstream.resetAt;
    const retry = integerIn(upstream.retryAfterSeconds, 1, 3_600);
    if (retry !== null) details.retryAfterSeconds = retry;
  } else if (status === 502 || status === 503 || status === 504) {
    const dependency = stringIn(upstream.dependencyClass, DEPENDENCY_CLASSES);
    if (dependency !== null) details.dependencyClass = dependency;
    if (typeof upstream.retryable === 'boolean')
      details.retryable = upstream.retryable;
    const retry = integerIn(upstream.retryAfterSeconds, 1, 3_600);
    if (retry !== null) details.retryAfterSeconds = retry;
  }
  return details;
};
