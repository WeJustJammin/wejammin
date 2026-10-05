/**
 * Hydration boundary for the content schema registry island (FE03 island
 * invariant): no trace, span, correlation or causation identifier, and no
 * page-level request identifier, may cross into browser-rendered props or
 * state. `pageFor` is the single exit from the server resolvers, and it
 * removes every such key before the page is handed to Astro for serialization.
 *
 * The one exception is the BE00 `ApiError.requestId` of a failed read. FE03
 * ("Typed ApiError with request ID", "Scoped degraded state with request ID")
 * requires the user to see it so they can quote it to support, so it survives
 * only on an `error` member and on a `degraded` state, where it is the
 * response's own identifier and never a matching or correlation token.
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** An `ApiError` member of an error state or a degraded state may show its id. */
const mayCarryRequestId = (
  parentKey: string | null,
  value: Record<string, unknown>,
): boolean => parentKey === 'error' || value.status === 'degraded';

/** Deep copy of JSON-shaped `value` without any diagnostic identifier key. */
export const withoutDiagnosticIdentifiers = <T>(
  value: T,
  parentKey: string | null = null,
): T => {
  if (Array.isArray(value))
    return value.map((entry) =>
      withoutDiagnosticIdentifiers(entry, parentKey),
    ) as T;
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value))
    if (
      !isDiagnosticIdentifierKey(key) ||
      (key === 'requestId' && mayCarryRequestId(parentKey, value))
    )
      output[key] = withoutDiagnosticIdentifiers(entry, key);
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
