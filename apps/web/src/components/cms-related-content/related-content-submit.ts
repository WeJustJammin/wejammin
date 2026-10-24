import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

/*
 * The browser transport of CMS-03C-05 (zod-free, FE03 AC261). The same-origin proxy has already parsed
 * the strict `RelatedContentResource` and bound it to the request, so the browser repeats that binding
 * structurally: a 201 that is not the answer to THIS request is an unknown outcome, never a guessed
 * success. An unknown outcome keeps the form's `Idempotency-Key` and replays the identical request
 * (BE03c 1502). The strong `If-Match` is the entry `version` and the next version is `version + 1`.
 */
export const relatedContentPath = (entryId: string): string =>
  `/api/v1/cms/entries/${entryId}/related-content`;

/** The ApiError code each status carries in the CMS-03C-05 catalog (BE03c 1311). */
export const RELATED_CONTENT_CATALOG_CODES: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'RELATED_CONTENT_FORBIDDEN',
  404: 'RELATED_CONTENT_NOT_FOUND',
  409: 'RELATED_CONTENT_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'RELATED_CONTENT_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
};

export type RelatedRejectedStatus =
  400 | 401 | 403 | 404 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

/** A request row the server refused, by its pointer (`/pins/{n}` or `/exclusions/{n}`). */
export interface RefusedRow {
  readonly list: 'pins' | 'exclusions';
  readonly index: number;
}

export interface SavedRelatedContent {
  /** The entry's new aggregate version: the next `If-Match`. */
  readonly version: string;
  readonly eligibleCount: number;
  readonly pins: readonly string[];
  readonly exclusions: readonly string[];
  readonly derivedRule: {
    readonly key: string;
    readonly version: string;
  } | null;
}

export type RelatedSubmitResult =
  | { readonly kind: 'saved'; readonly saved: SavedRelatedContent }
  /** The entry changed after the page loaded: a plain compare-and-set conflict. */
  | { readonly kind: 'conflict'; readonly currentVersion: string | null }
  /** A typed refusal of the server (BE03c 1323), with the rows its pointers name. */
  | {
      readonly kind: 'refused';
      readonly status: 403 | 422;
      readonly reason:
        | 'capability_missing'
        | 'related_target_ineligible'
        | 'derived_rule_unknown';
      readonly rows: readonly RefusedRow[];
    }
  | {
      readonly kind: 'rejected';
      readonly status: RelatedRejectedStatus;
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'uncertain' };

type Json = Readonly<Record<string, unknown>>;
const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';
const MAX_WAIT_SECONDS = 86_400;
const ROW_POINTER = /^\/(pins|exclusions)\/(0|[1-9]\d{0,2})$/u;
const TYPED_REASONS = {
  403: ['capability_missing'],
  422: ['related_target_ineligible', 'derived_rule_unknown'],
} as const;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameIds = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) &&
  a.length === b.length &&
  a.every((id, index) => id === b[index]);

/** The increment of a decimal entry version, or null when it is not a version. */
const nextVersion = (version: string): string | null =>
  isCmsVersion(version) ? String(BigInt(version) + 1n) : null;

/** The saved rule when `resource` is the answer to `request`, else null. */
const savedFacts = (
  resource: unknown,
  request: RelatedContentRuleRequest,
  etag: string | null,
): SavedRelatedContent | null => {
  const next = nextVersion(request.expectedVersion);
  if (!isRecord(resource) || next === null || etag !== `"${next}"`) return null;
  const rule = resource.derivedRule;
  const asked = request.derivedRule;
  const ruleMatches =
    asked === null
      ? rule === null
      : isRecord(rule) &&
        rule.key === asked.key &&
        rule.version === asked.version;
  const count = resource.eligibleCount;
  if (
    resource.state !== 'active' ||
    resource.sourceEntryId !== request.entryId ||
    !sameIds(resource.pins, request.pins) ||
    !sameIds(resource.exclusions, request.exclusions) ||
    !ruleMatches ||
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > 128
  )
    return null;
  return {
    version: next,
    eligibleCount: count,
    pins: [...request.pins],
    exclusions: [...request.exclusions],
    derivedRule:
      asked === null ? null : { key: asked.key, version: asked.version },
  };
};

/** The ApiError details of a refusal when it is the catalog code of its status, else null. */
const refusalDetails = async (response: Response): Promise<Json | null> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return isRecord(body) &&
    body.code === RELATED_CONTENT_CATALOG_CODES[response.status] &&
    isRecord(body.details)
    ? body.details
    : null;
};

const rateWait = (response: Response, details: Json): RelatedSubmitResult => {
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

/** The distinct request rows the violation pointers name; anything else is ignored. */
const refusedRows = (violations: unknown): RefusedRow[] => {
  if (!Array.isArray(violations)) return [];
  const rows: RefusedRow[] = [];
  for (const violation of violations.slice(0, 50)) {
    const path = isRecord(violation) ? violation.path : undefined;
    const match = typeof path === 'string' ? ROW_POINTER.exec(path) : null;
    if (match === null) continue;
    const list = match[1] as RefusedRow['list'];
    const index = Number(match[2]);
    if (!rows.some((row) => row.list === list && row.index === index))
      rows.push({ list, index });
  }
  return rows;
};

const typedRefusal = (
  status: 403 | 422,
  details: Json,
): RelatedSubmitResult | null => {
  const reason = details.reasonCode;
  if (
    typeof reason !== 'string' ||
    !(TYPED_REASONS[status] as readonly string[]).includes(reason)
  )
    return null;
  return {
    kind: 'refused',
    status,
    reason: reason as Extract<
      RelatedSubmitResult,
      { kind: 'refused' }
    >['reason'],
    rows: status === 422 ? refusedRows(details.violations) : [],
  };
};

/** Send one CMS-03C-05 request; the browser never sends an authority claim. */
export const submitRelatedContent = async (
  request: RelatedContentRuleRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<RelatedSubmitResult> => {
  if (!isCmsUuid(request.entryId)) return { kind: 'uncertain' };
  let response: Response;
  try {
    response = await fetcher(relatedContentPath(request.entryId), {
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
    });
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
  if (!Object.hasOwn(RELATED_CONTENT_CATALOG_CODES, status))
    return { kind: 'uncertain' };
  const details = await refusalDetails(response);
  if (details === null) return { kind: 'uncertain' };
  if (status === 429) return rateWait(response, details);
  if (status === 403 || status === 422) {
    const typed = typedRefusal(status, details);
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
  return { kind: 'rejected', status: status as RelatedRejectedStatus };
};
