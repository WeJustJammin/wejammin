import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import {
  TAXONOMY_CATALOG_CODES,
  isCanonicalDomain,
  taxonomyReason,
  type CanonicalDomain,
  type TaxonomyReason,
} from './taxonomy-vocabulary';

/*
 * The browser transport shared by the two vocabulary commands, CMS-03C-16 (a version) and
 * CMS-03C-03 (a term action); zod-free (FE03 AC261). The same-origin proxy has already
 * parsed the strict resource and bound it to the request, so the caller repeats that
 * binding structurally on the `success` body: a 2xx that is not the answer to THIS request
 * is an unknown outcome, never a guessed success. An unknown outcome keeps the form's
 * `Idempotency-Key` and replays the identical request (BE03c 1502).
 */
export type TaxonomyOperation = 'CMS-03C-16' | 'CMS-03C-03';

export type TaxonomyRejectedStatus =
  400 | 401 | 403 | 404 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type TaxonomyMutationOutcome =
  | {
      readonly kind: 'success';
      readonly body: unknown;
      readonly etag: string | null;
    }
  /** A plain compare-and-set conflict: the version operand is stale. */
  | { readonly kind: 'conflict'; readonly currentVersion: string | null }
  /** A typed refusal of the server, with the members its token names. */
  | {
      readonly kind: 'refused';
      readonly status: 403 | 409 | 422;
      readonly reason: TaxonomyReason;
      readonly domain?: CanonicalDomain;
      readonly canonicalId?: string;
    }
  | {
      readonly kind: 'rejected';
      readonly status: TaxonomyRejectedStatus;
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'uncertain' };

type Json = Readonly<Record<string, unknown>>;
const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';
const MAX_WAIT_SECONDS = 86_400;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The `details` of a refusal when it is the catalog code of its status, else null. */
const refusalDetails = async (response: Response): Promise<Json | null> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return isRecord(body) &&
    body.code === TAXONOMY_CATALOG_CODES[response.status] &&
    isRecord(body.details)
    ? body.details
    : null;
};

const rateWait = (
  response: Response,
  details: Json,
): TaxonomyMutationOutcome => {
  const raw = response.headers.get('retry-after');
  if (raw === null || !/^[1-9]\d{0,4}$/u.test(raw))
    return { kind: 'uncertain' };
  const seconds = Number(raw);
  const stated = details.retryAfterSeconds;
  if (
    seconds > MAX_WAIT_SECONDS ||
    (stated !== undefined && stated !== seconds)
  )
    return { kind: 'uncertain' };
  return { kind: 'rejected', status: 429, retryAfterSeconds: seconds };
};

/** The typed refusal the details name, with the members its token requires, or null. */
const typedRefusal = (
  operation: TaxonomyOperation,
  status: 403 | 409 | 422,
  details: Json,
): TaxonomyMutationOutcome | null => {
  const reason = taxonomyReason(operation, details.reasonCode, status);
  if (reason === null) return null;
  if (
    reason !== 'canonical_overlap' &&
    reason !== 'canonical_source_unavailable'
  )
    return { kind: 'refused', status, reason };
  const domain = details.domain;
  if (!isCanonicalDomain(domain)) return null;
  if (reason === 'canonical_source_unavailable')
    return { kind: 'refused', status, reason, domain };
  const canonicalId = details.canonicalId;
  return typeof canonicalId === 'string' && isCmsUuid(canonicalId)
    ? { kind: 'refused', status, reason, domain, canonicalId }
    : null;
};

export interface TaxonomyMutation {
  readonly operation: TaxonomyOperation;
  readonly url: string;
  /** The serialized request body. */
  readonly body: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  /** The strong `If-Match` (quoted), absent on a first vocabulary version. */
  readonly ifMatch: string | null;
  readonly successStatus: 200 | 201;
  readonly fetcher?: typeof fetch | undefined;
}

/** Send one vocabulary command; the browser never sends an authority claim. */
export const sendTaxonomyMutation = async ({
  operation,
  url,
  body,
  csrfToken,
  idempotencyKey,
  ifMatch,
  successStatus,
  fetcher = fetch,
}: TaxonomyMutation): Promise<TaxonomyMutationOutcome> => {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'idempotency-key': idempotencyKey,
        ...(ifMatch === null ? {} : { 'if-match': ifMatch }),
      },
      body,
    });
  } catch {
    return { kind: 'uncertain' };
  }
  if (!(response instanceof Response)) return { kind: 'uncertain' };
  if (response.headers.get(UNKNOWN_OUTCOME_HEADER) === 'unknown')
    return { kind: 'uncertain' };
  const status = response.status;
  if (status === successStatus) {
    try {
      return {
        kind: 'success',
        body: await response.json(),
        etag: response.headers.get('etag'),
      };
    } catch {
      return { kind: 'uncertain' };
    }
  }
  if (!Object.hasOwn(TAXONOMY_CATALOG_CODES, status))
    return { kind: 'uncertain' };
  const details = await refusalDetails(response);
  if (details === null) return { kind: 'uncertain' };
  if (status === 429) return rateWait(response, details);
  if (status === 403 || status === 409 || status === 422) {
    const typed = typedRefusal(operation, status, details);
    if (typed !== null) return typed;
  }
  if (status === 409) {
    const current = details.currentVersion;
    return {
      kind: 'conflict',
      currentVersion:
        typeof current === 'string' && isCmsVersion(current) ? current : null,
    };
  }
  return { kind: 'rejected', status: status as TaxonomyRejectedStatus };
};
