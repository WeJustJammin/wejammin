import {
  CmsUuidSchema,
  ConflictDetailResourceSchema,
  type ConflictDetailResource,
} from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CmsEditorialConflictReadOutcome =
  | 'success'
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'degraded'
  | 'unknown';

export interface CmsEditorialConflictDetailReadResult {
  readonly outcome: CmsEditorialConflictReadOutcome;
  readonly resource: ConflictDetailResource | null;
  /** The wait a 429 asked for (FE03 :1172), whole seconds; null when none was stated or it is not a 429. */
  readonly retryAfterSeconds: number | null;
}

const outcomeForStatus = (status: number): CmsEditorialConflictReadOutcome => {
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'degraded';
  return 'unknown';
};

/**
 * Browser client for the protected CMS-03B-12 conflict read, used to refetch
 * after a 409. A safe read: no body, no Idempotency-Key, no If-Match, never
 * cached. A 200 is trusted only as the strict contract for exactly the
 * addressed entry and conflict; a hidden, absent or closed conflict is one 404,
 * so the browser learns nothing more than "not open".
 */
export const executeCmsEditorialConflictDetailRead = async (input: {
  readonly basePath: string;
  readonly entryId: string;
  readonly conflictId: string;
  readonly fetcher?: Fetcher;
}): Promise<CmsEditorialConflictDetailReadResult> => {
  if (
    !CmsUuidSchema.safeParse(input.entryId).success ||
    !CmsUuidSchema.safeParse(input.conflictId).success
  )
    return { outcome: 'validation', resource: null, retryAfterSeconds: null };
  const baseFetcher = input.fetcher ?? fetch;
  const fetcher: Fetcher = async (request, init) =>
    baseFetcher(request, await addClientBindingIdHeader(request, init));
  let response: Response;
  try {
    // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
    response = await retryingSafeRead(() =>
      fetcher(
        `${input.basePath}/${input.entryId}/conflicts/${input.conflictId}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          redirect: 'manual',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        },
      ),
    );
  } catch {
    return { outcome: 'degraded', resource: null, retryAfterSeconds: null };
  }
  if (response.status !== 200)
    return {
      outcome: outcomeForStatus(response.status),
      resource: null,
      retryAfterSeconds:
        response.status === 429 ? await rateLimitWaitSeconds(response) : null,
    };
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return { outcome: 'unknown', resource: null, retryAfterSeconds: null };
  }
  const parsed = ConflictDetailResourceSchema.safeParse(body);
  return parsed.success &&
    parsed.data.entry.id === input.entryId &&
    parsed.data.conflict.id === input.conflictId
    ? { outcome: 'success', resource: parsed.data, retryAfterSeconds: null }
    : { outcome: 'unknown', resource: null, retryAfterSeconds: null };
};
