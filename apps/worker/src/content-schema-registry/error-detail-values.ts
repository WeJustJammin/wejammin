/**
 * BE00 error-detail value boundary for the CMS registry. A detail key is only
 * allowlisted by name elsewhere; this module bounds the VALUES that may reach
 * the wire, so malformed RPC or dependency output (SQL text, provider names,
 * oversized strings, non-finite numbers) can never be echoed to a client.
 */

/** BE00 `details`: at most 16 keys, four levels, 8 KiB serialized. */
export const MAX_DETAILS_BYTES = 8 * 1024;
export const MAX_DETAILS_KEYS = 16;

const TOKEN = /^[A-Z][A-Z0-9_]{0,63}$/u;
const CLASS_TOKEN = /^[a-z][a-z0-9_]{0,63}$/u;

/** Registered 403 `reasonCode` values: never a policy predicate. */
export const REGISTERED_FORBIDDEN_REASON_CODES: ReadonlySet<string> = new Set([
  'CAPABILITY_REQUIRED',
  'OWNER_REQUIRED',
  'MFA_REQUIRED',
  'POLICY_NOT_MET',
]);

/** Registered 502/503/504 `dependencyClass` values: never a provider name. */
export const REGISTERED_DEPENDENCY_CLASSES: ReadonlySet<string> = new Set([
  'cms_registry',
  'authentication',
  'request_context',
  'release_verifier',
  'rate_limiter',
  'identity_persistence',
  'identity_provider',
]);

export const DEFAULT_DEPENDENCY_CLASS = 'cms_registry';

export const MAX_RETRY_AFTER_SECONDS = 86_400;
export const MAX_RATE_LIMIT = 1_000_000;

export const registeredReasonCode = (value: unknown): string | null =>
  typeof value === 'string' &&
  TOKEN.test(value) &&
  REGISTERED_FORBIDDEN_REASON_CODES.has(value)
    ? value
    : null;

export const registeredDependencyClass = (value: unknown): string | null =>
  typeof value === 'string' &&
  CLASS_TOKEN.test(value) &&
  REGISTERED_DEPENDENCY_CLASSES.has(value)
    ? value
    : null;

const boundedInteger = (
  value: unknown,
  min: number,
  max: number,
): number | null =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max
    ? value
    : null;

export const boundedRetryAfterSeconds = (value: unknown): number | null =>
  boundedInteger(value, 0, MAX_RETRY_AFTER_SECONDS);

export const boundedRateLimit = (value: unknown): number | null =>
  boundedInteger(value, 1, MAX_RATE_LIMIT);

const serializedBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * Final serialized-size ceiling. Trailing violations are shed until the
 * details fit; details that still do not fit are dropped whole (fail closed).
 */
export const withinDetailsCeiling = (
  details: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  if (Object.keys(details).length > MAX_DETAILS_KEYS) return {};
  if (serializedBytes(details) <= MAX_DETAILS_BYTES) return details;
  const violations = details.violations;
  if (!Array.isArray(violations)) return {};
  const kept = [...(violations as readonly unknown[])];
  const rest = Object.fromEntries(
    Object.entries(details).filter(([key]) => key !== 'violations'),
  );
  while (kept.length > 0) {
    kept.pop();
    const candidate =
      kept.length === 0 ? rest : { ...rest, violations: [...kept] };
    if (serializedBytes(candidate) <= MAX_DETAILS_BYTES) return candidate;
  }
  return serializedBytes(rest) <= MAX_DETAILS_BYTES ? rest : {};
};
