/**
 * Hydration boundary for the content schema registry island (FE03 island
 * invariant): no request, trace, span, correlation or causation identifier may
 * cross into browser-rendered props or state. `pageFor` is the single exit from
 * the server resolvers, and it removes every such key before the page is
 * handed to Astro for serialization.
 */

/**
 * Normalized spellings: requestId, requestID, request_id, x-request-id,
 * traceId, spanId, causationId and the correlation family. Case and separators
 * cannot dodge it.
 */
const DIAGNOSTIC_KEY =
  /^(x)?(request|req|trace|span|causation|correlation)(id|ref|token|hash)$/u;

export const isDiagnosticIdentifierKey = (key: string): boolean =>
  DIAGNOSTIC_KEY.test(key.toLowerCase().replaceAll(/[^a-z0-9]/gu, ''));

/** Deep copy of JSON-shaped `value` without any diagnostic identifier key. */
export const withoutDiagnosticIdentifiers = <T>(value: T): T => {
  if (Array.isArray(value))
    return value.map((entry) => withoutDiagnosticIdentifiers(entry)) as T;
  if (typeof value !== 'object' || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value))
    if (!isDiagnosticIdentifierKey(key))
      output[key] = withoutDiagnosticIdentifiers(entry);
  return output as T;
};

const SUPPORT_REFERENCE_BYTES = 8;

/**
 * A user-facing support reference with no relationship to any internal
 * identifier: 64 random bits, never derived from, hashed from or truncated
 * from a request, trace or correlation value.
 */
export const createSupportReference = (): string => {
  const bytes = new Uint8Array(SUPPORT_REFERENCE_BYTES);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `SR-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12)}`.toUpperCase();
};
