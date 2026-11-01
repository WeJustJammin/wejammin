import type { LocaleVariantRequest } from '@wejammin/contracts';
import {
  isCanonicalLocale,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import { localeVariantApiPath } from './locale-variant-path';

/*
 * The browser transport of CMS-03C-04 (zod-free, FE03 AC261). The same-origin proxy has already parsed the
 * strict `LocaleVariantResource` and bound it to the request, so the browser repeats that binding
 * structurally: a 201 that is not the answer to THIS request is an unknown outcome, never a guessed success.
 * An unknown outcome keeps the form's `Idempotency-Key` and replays the identical request (BE03c 1502).
 * The strong `If-Match` is the entry `version` and the next version is `version + 1`.
 */

/** The ApiError code each status carries in the `cms.03c.locale.v1` catalog (BE03c 1257). */
export const localeCatalogCodes: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'LOCALE_FORBIDDEN',
  404: 'LOCALE_SOURCE_NOT_FOUND',
  409: 'LOCALE_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'LOCALE_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
};

export type LocaleRejectedStatus =
  400 | 401 | 403 | 404 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export interface SavedLocaleVariant {
  /** The entry's new aggregate version: the next `If-Match`. */
  readonly version: string;
  readonly state: 'draft';
  readonly staleFieldIds: readonly string[];
  /** The fields this save wrote: the only fields the new revision holds. */
  readonly savedFieldIds: readonly string[];
}

export type LocaleSubmitResult =
  | { readonly kind: 'saved'; readonly saved: SavedLocaleVariant }
  /** 409 `FALLBACK_CHAIN_MISMATCH`: the chain the active version declares now (OD-4). */
  | {
      readonly kind: 'chain_mismatch';
      readonly activeFallbackChain: readonly string[];
    }
  /** 409 `locale_limit_reached`: the request would create the 33rd locale variant (D12). */
  | { readonly kind: 'limit_reached' }
  /** The entry or its source changed after the page loaded: a plain compare-and-set conflict. */
  | { readonly kind: 'conflict'; readonly currentVersion: string | null }
  | {
      readonly kind: 'rejected';
      readonly status: LocaleRejectedStatus;
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'uncertain' };

type Json = Readonly<Record<string, unknown>>;
const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';
const MAX_WAIT_SECONDS = 86_400;
const MISMATCH = 'FALLBACK_CHAIN_MISMATCH';
const LIMIT = 'locale_limit_reached';

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameList = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) &&
  a.length === b.length &&
  a.every((item, index) => item === b[index]);

/** The saved facts when `resource` is the answer to `request`, else null. */
const savedFacts = (
  resource: unknown,
  request: LocaleVariantRequest,
  etag: string | null,
): SavedLocaleVariant | null => {
  if (!isCmsVersion(request.expectedVersion)) return null;
  const next = String(BigInt(request.expectedVersion) + 1n);
  if (!isRecord(resource) || !isCmsVersion(next) || etag !== `"${next}"`)
    return null;
  if (
    resource.state !== 'draft' ||
    resource.entryId !== request.entryId ||
    resource.locale !== request.locale ||
    resource.sourceRevisionId !== request.sourceRevisionId ||
    !sameList(resource.fallbackChain, request.fallbackChain) ||
    !sameList(resource.noFallbackFieldIds, request.noFallbackFieldIds) ||
    !Array.isArray(resource.staleFieldIds) ||
    resource.staleFieldIds.length !== 0
  )
    return null;
  return {
    version: next,
    state: 'draft',
    staleFieldIds: [],
    savedFieldIds: request.fields.map(({ fieldId }) => fieldId),
  };
};

const refusalDetails = async (response: Response): Promise<Json | null> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return isRecord(body) &&
    body.code === localeCatalogCodes[response.status] &&
    isRecord(body.details)
    ? body.details
    : null;
};

const rateWait = (response: Response, details: Json): LocaleSubmitResult => {
  const raw = response.headers.get('retry-after');
  if (raw === null || !/^[1-9]\d{0,7}$/u.test(raw))
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

const conflictOf = (details: Json): LocaleSubmitResult => {
  const chain = details.activeFallbackChain;
  if (
    details.reasonCode === MISMATCH &&
    Array.isArray(chain) &&
    chain.length <= 16 &&
    chain.every((tag) => typeof tag === 'string' && isCanonicalLocale(tag))
  )
    return {
      kind: 'chain_mismatch',
      activeFallbackChain: [...(chain as string[])],
    };
  if (details.reasonCode === LIMIT) return { kind: 'limit_reached' };
  const current = details.currentVersion;
  return {
    kind: 'conflict',
    currentVersion:
      typeof current === 'string' && isCmsVersion(current) ? current : null,
  };
};

/** Send one CMS-03C-04 request; the browser never sends an authority claim. */
export const submitLocaleVariant = async (
  request: LocaleVariantRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<LocaleSubmitResult> => {
  if (!isCmsUuid(request.entryId)) return { kind: 'uncertain' };
  let response: Response;
  try {
    response = await fetcher(
      localeVariantApiPath(request.entryId, request.locale),
      {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'idempotency-key': idempotencyKey,
          'if-match': `"${request.expectedVersion}"`,
        },
        body: JSON.stringify(request),
      },
    );
  } catch {
    return { kind: 'uncertain' };
  }
  if (!(response instanceof Response)) return { kind: 'uncertain' };
  if (response.headers.get(UNKNOWN_OUTCOME_HEADER) === 'unknown')
    return { kind: 'uncertain' };
  const status = response.status;
  if (status === 201) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'uncertain' };
    }
    const saved = savedFacts(body, request, response.headers.get('etag'));
    return saved === null ? { kind: 'uncertain' } : { kind: 'saved', saved };
  }
  if (!Object.hasOwn(localeCatalogCodes, status)) return { kind: 'uncertain' };
  const details = await refusalDetails(response);
  if (details === null) return { kind: 'uncertain' };
  if (status === 429) return rateWait(response, details);
  if (status === 409) return conflictOf(details);
  return { kind: 'rejected', status: status as LocaleRejectedStatus };
};
