import {
  EntryCreateResourceSchema,
  EntryDraftDetailResourceSchema,
  EntryRevisionResourceSchema,
  RevisionHistoryPageSchema,
} from '@wejammin/contracts';
import type { EntryRevisionResource } from '@wejammin/contracts';

import { supabaseRpcHeaders } from './supabase-rpc-headers';
import {
  deadlineExceeded,
  errorResult,
  internalError,
  invalidResponse,
  isRecord,
  mapCmsEditorialRpcFailure,
  rpcNameFor,
  unavailable,
} from './cms-editorial-production-errors';
import {
  cmsEditorialRpcBodyFor,
  correlationFor,
} from './cms-editorial-production-session';
import type { CmsEditorialPortInput } from './cms-editorial-production-session';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import {
  BARE_VERSION_PATTERN,
  type CmsEditorialProductionConfiguration,
  type CmsEditorialProductionOperationId,
  type CmsEditorialProductionResult,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';

/**
 * Operation-to-port-member binding. The browser never selects an RPC; the
 * composed dependency exposes exactly the ports the route declares.
 */
export const CMS_EDITORIAL_PORTS = {
  'CMS-03B-01': 'appendRevision',
  'CMS-03B-02': 'resolveConflict',
  'CMS-03B-03': 'listRevisions',
  'CMS-03B-10': 'createEntry',
  'CMS-03B-11': 'getEntryDraft',
} as const satisfies Readonly<
  Record<CmsEditorialProductionOperationId, string>
>;

/**
 * Response contract per operation. Only operations whose contracts have landed
 * appear here; an operation without a declared success schema fails closed
 * rather than forwarding an unvalidated RPC payload.
 */
const validateCmsEditorialResource = (
  operationId: CmsEditorialProductionOperationId,
  value: unknown,
): boolean => {
  if (operationId === 'CMS-03B-01')
    return EntryRevisionResourceSchema.safeParse(value).success;
  if (operationId === 'CMS-03B-02') {
    const parsed = EntryRevisionResourceSchema.safeParse(value);
    if (!parsed.success) return false;
    const parents = parsed.data.parentRevisionIds;
    return (
      parsed.data.conflictId !== null &&
      parents.length === 2 &&
      parents[0] !== parents[1]
    );
  }
  if (operationId === 'CMS-03B-10')
    return EntryCreateResourceSchema.safeParse(value).success;
  if (operationId === 'CMS-03B-03')
    return RevisionHistoryPageSchema.safeParse(value).success;
  if (operationId === 'CMS-03B-11')
    return EntryDraftDetailResourceSchema.safeParse(value).success;
  return false;
};

/**
 * A same-field conflict must commit its private record, so PostgreSQL cannot
 * raise after inserting it: an exception would roll the record back. The SQL
 * RPC instead returns this closed private disposition on HTTP 200. Only the
 * revision-write port converts it to the BE00 409 envelope, dropping the
 * private conflict hash and refusing any unexpected payload key.
 */
const committedRevisionConflict = (
  value: unknown,
): CmsEditorialProductionResult<never> | null => {
  if (!isRecord(value) || value.kind !== 'conflict') return null;
  const details = value.details;
  if (
    Object.keys(value).length !== 3 ||
    !['kind', 'code', 'details'].every((key) => key in value) ||
    value.code !== 'VERSION_MISMATCH' ||
    !isRecord(details) ||
    Object.keys(details).length !== 3 ||
    !['expectedVersion', 'currentVersion', 'conflictHash'].every(
      (key) => key in details,
    ) ||
    typeof details.expectedVersion !== 'string' ||
    !BARE_VERSION_PATTERN.test(details.expectedVersion) ||
    typeof details.currentVersion !== 'string' ||
    !BARE_VERSION_PATTERN.test(details.currentVersion) ||
    typeof details.conflictHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(details.conflictHash)
  )
    return invalidResponse();
  return errorResult(
    409,
    'CONFLICT',
    'The CMS editorial resource changed; reload and try again.',
    {
      conflict: 'VERSION_MISMATCH',
      expectedVersion: details.expectedVersion,
      currentVersion: details.currentVersion,
      recoveryAction: 'reload',
    },
  );
};

export type CmsEditorialAppendRevisionPort = (
  input: CmsEditorialPortInput,
  signal: AbortSignal,
) => Promise<CmsEditorialProductionResult<EntryRevisionResource>>;

export type CmsEditorialPorts = Readonly<{
  appendRevision: CmsEditorialAppendRevisionPort;
}>;

/**
 * Quote an If-Match validator. BE03b requires an exact strong validator, so only
 * a bare decimal is accepted and it is quoted once. A weak (`W/"1"`), already
 * quoted, zero, or leading-zero validator is rejected by the caller with a 422
 * before this runs, so this never normalizes an equivalent into a match.
 */
export const quoteVersion = (ifMatch: string): string =>
  BARE_VERSION_PATTERN.test(ifMatch) ? `"${ifMatch}"` : ifMatch;

const rpcHeaders = (
  configuration: CmsEditorialProductionConfiguration,
  input: CmsEditorialPortInput,
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Profile': 'platform_api',
    ...supabaseRpcHeaders(configuration.secret),
    'Content-Profile': 'platform_api',
    'Content-Type': 'application/json',
    'X-Operation-Id': input.operationId,
    'X-Request-Id': input.requestId,
    'X-Correlation-Id': correlationFor(input),
  };
  if (input.idempotencyKey !== undefined)
    headers['X-Idempotency-Key'] = input.idempotencyKey;
  if (input.ifMatch !== undefined)
    headers['If-Match'] = quoteVersion(input.ifMatch);
  return headers;
};

/**
 * Build the protected transport for one operation. The port input is validated
 * before any fetch is issued, so a caller-supplied authority key, a weak
 * validator, an entry-id disagreement, or a foreign operation id is rejected
 * with no RPC call. Failures are mapped to the BE03b error matrix, and the
 * success payload is revalidated against the declared resource contract before
 * it can reach a route.
 */
export const createCmsEditorialRpcCaller = (
  configuration: CmsEditorialProductionConfiguration,
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
  operationId: CmsEditorialProductionOperationId,
  deadlineMs: number,
): ((
  input: CmsEditorialPortInput,
  signal: AbortSignal,
) => Promise<CmsEditorialProductionResult<unknown>>) => {
  const rpc = rpcNameFor(operationId);
  return async (input, signal) => {
    const projected = cmsEditorialRpcBodyFor(
      input,
      contexts,
      configuration.now,
      operationId,
    );
    if (!projected.ok) return projected;
    const deadline = createDeadline(signal, deadlineMs);
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/${rpc}`,
        {
          method: 'POST',
          headers: rpcHeaders(configuration, input),
          body: JSON.stringify({ p_request: projected.value }),
        },
        deadline,
      );
      if (!response.ok) return response;
      const parsed = response.value.ok
        ? await parseJsonResponse(
            response.value,
            configuration.maxResponseBytes,
            deadline.signal,
          )
        : mapCmsEditorialRpcFailure(
            response.value.status,
            await readRpcError(
              response.value,
              configuration.maxResponseBytes,
              deadline.signal,
            ),
          );
      if (!parsed.ok && deadline.expired()) return deadlineExceeded();
      if (parsed.ok && operationId === 'CMS-03B-01') {
        const conflict = committedRevisionConflict(parsed.value);
        if (conflict !== null) return conflict;
      }
      return parsed;
    } catch {
      return internalError();
    } finally {
      deadline.dispose();
    }
  };
};

/**
 * Validate and narrow a raw RPC success payload into the declared resource.
 * A payload that does not satisfy the contract is a 502, never a passthrough.
 */
export const cmsEditorialResourcePort =
  <T>(
    caller: (
      input: CmsEditorialPortInput,
      signal: AbortSignal,
    ) => Promise<CmsEditorialProductionResult<unknown>>,
    operationId: CmsEditorialProductionOperationId,
  ): ((
    input: CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialProductionResult<T>>) =>
  async (input, signal) => {
    const result = await caller(input, signal);
    if (!result.ok) return result;
    if (!validateCmsEditorialResource(operationId, result.value))
      return invalidResponse();
    return { ok: true, value: result.value as T };
  };

export { unavailable };
