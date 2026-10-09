/**
 * Failure-diagnostic privacy primitives for the Slice 11 assertion helpers (lane
 * S11-4R foundation corrections, findings 1 and 2). A Vitest failure prints the
 * actual/expected values of a `toEqual`/`toBe` diff, so a schema-valid forbidden
 * payload (a synthetic token in `details`, a stray code) could reach the output.
 * These helpers keep an EXACT deep comparison (independent of any digest) and
 * expose only booleans and short digests to the failure diagnostic.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

/**
 * DIAGNOSTIC-ONLY code allowlist. This is not the producer's contract: the real
 * `ApiErrorSchema.code` is a grammar regex, not a closed enum. This set exists so
 * the failure SUMMARY echoes a code only when it is one of the codes this surface
 * actually produces; an arbitrary body string (even one matching the code
 * grammar) is replaced by `n/a`, so a token that happens to look like a code can
 * never be echoed. Do not treat it as authoritative for the producer.
 */
export const SAFE_ERROR_CODES: ReadonlySet<string> = new Set([
  'INVALID_REQUEST',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNAUTHENTICATED',
  'STEP_UP_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'BAD_GATEWAY',
  'DEPENDENCY_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
]);

/** The own data value of a key, read via its descriptor (never a prototype getter). */
const ownValue = (object: object, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && 'value' in descriptor
    ? descriptor.value
    : undefined;
};

/**
 * EXACT deep equality: a thin re-export of Node's `isDeepStrictEqual`, so the
 * comparison follows that function's standard semantics (prototypes, `-0`/`NaN`,
 * array holes, `Date`, `Map`/`Set`, boxed primitives, typed arrays and true
 * cycles). It is not a universal comparator: like Node's own, it does not compare
 * every arbitrary own non-enumerable key of an object. A hand-written
 * unknown-value comparator was deliberately abandoned because it could not match
 * these semantics. The public 2-argument API is preserved.
 */
export const deepEqual = (left: unknown, right: unknown): boolean =>
  isDeepStrictEqual(left, right);

/**
 * A best-effort, cycle-safe serialization of any value, used ONLY for the
 * diagnostic digest (never for equality, and not a completeness guarantee). It
 * never throws for `undefined`, functions, symbols or bigints, distinguishes
 * `-0`/`0`, keeps `__proto__` as a normal key, and marks only true ancestor
 * cycles. Two values that serialize identically need not be equal; equality is
 * decided by `deepEqual` alone.
 */
export const stableSerialize = (value: unknown): string => {
  const ancestors = new Set<object>();
  const encode = (node: unknown): string => {
    if (node === null) return 'null';
    switch (typeof node) {
      case 'string':
        return JSON.stringify(node);
      case 'number':
        return Object.is(node, -0) ? '"-0"' : JSON.stringify(node);
      case 'boolean':
        return node ? 'true' : 'false';
      case 'undefined':
        return 'undefined';
      case 'bigint':
        return `"${node.toString()}n"`;
      case 'symbol':
        return '"[symbol]"';
      case 'function':
        return '"[function]"';
      default: {
        const object = node as object;
        if (ancestors.has(object)) return '"[cycle]"';
        ancestors.add(object);
        try {
          if (Array.isArray(object)) return `[${object.map(encode).join(',')}]`;
          const keys = Object.keys(object).sort();
          return `{${keys
            .map(
              (key) =>
                `${JSON.stringify(key)}:${encode(ownValue(object, key))}`,
            )
            .join(',')}}`;
        } finally {
          ancestors.delete(object);
        }
      }
    }
  };
  return encode(value);
};

/**
 * A short, non-reversible digest of any supported value, safe for the failure
 * diagnostic (never the value itself, never throwing). Diagnostic only; it is
 * NOT the equality oracle.
 */
export const valueDigest = (value: unknown): string =>
  createHash('sha256')
    .update(stableSerialize(value))
    .digest('hex')
    .slice(0, 16);
