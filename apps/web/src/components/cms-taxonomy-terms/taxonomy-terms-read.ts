import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import { retryingSafeRead } from '../../lib/safe-read-retry';
import {
  TERM_KEY_REGEX,
  TERM_LIMITS,
  isLocale,
  isTermAlias,
  isTermLabelText,
} from './term-rules';

/**
 * The verified facts of one page of a vocabulary's terms (`cmsTaxonomyTermsRead`). The
 * same-origin proxy has already parsed the strict `TaxonomyTermListPage`; the browser
 * repeats the structure and the rules (zod-free, FE03 AC261) and keeps only the members
 * the term form uses.
 */
export type TermLifecycle = 'active' | 'deprecated' | 'merged';
export const TERM_LIFECYCLES: readonly TermLifecycle[] = [
  'active',
  'deprecated',
  'merged',
];

export interface TermLabel {
  readonly locale: string;
  readonly label: string;
}

export interface TermFacts {
  readonly termId: string;
  readonly termKey: string;
  readonly lifecycle: TermLifecycle;
  readonly version: string;
  readonly parentId: string | null;
  /** The surviving term a `merged` term resolves to permanently. */
  readonly successorId: string | null;
  readonly labels: readonly TermLabel[];
  readonly aliases: readonly string[];
}

export interface TermsPageFacts {
  readonly items: readonly TermFacts[];
  readonly nextCursor: string | null;
  readonly pageVersion: string;
}

export interface TermsQuery {
  readonly lifecycle?: TermLifecycle | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

export type TermsResult =
  | { readonly kind: 'loaded'; readonly page: TermsPageFacts }
  | { readonly kind: 'rejected'; readonly status: 401 | 403 | 404 | 409 | 429 }
  | { readonly kind: 'unavailable' };

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnly = (record: Json, allowed: readonly string[]): boolean =>
  Object.keys(record).every((key) => allowed.includes(key));

const uuidOrNull = (value: unknown): string | null | undefined =>
  value === null
    ? null
    : typeof value === 'string' && isCmsUuid(value)
      ? value
      : undefined;

const labelsOf = (value: unknown): TermLabel[] | null => {
  if (!Array.isArray(value) || value.length > TERM_LIMITS.labels) return null;
  const labels: TermLabel[] = [];
  for (const entry of value as unknown[]) {
    if (
      !isRecord(entry) ||
      !hasOnly(entry, ['locale', 'label']) ||
      typeof entry.locale !== 'string' ||
      !isLocale(entry.locale) ||
      typeof entry.label !== 'string' ||
      !isTermLabelText(entry.label)
    )
      return null;
    labels.push({ locale: entry.locale, label: entry.label });
  }
  return labels;
};

const aliasesOf = (value: unknown): string[] | null =>
  Array.isArray(value) &&
  value.length <= TERM_LIMITS.aliases &&
  value.every(
    (alias): alias is string => typeof alias === 'string' && isTermAlias(alias),
  )
    ? value
    : null;

const verifiedTerm = (candidate: unknown): TermFacts | null => {
  if (
    !isRecord(candidate) ||
    !hasOnly(candidate, [
      'termId',
      'termKey',
      'lifecycle',
      'version',
      'parentId',
      'successorId',
      'labels',
      'aliases',
    ])
  )
    return null;
  const { termId, termKey, lifecycle, version } = candidate;
  const parentId = uuidOrNull(candidate.parentId);
  const successorId = uuidOrNull(candidate.successorId);
  const labels = labelsOf(candidate.labels);
  const aliases = aliasesOf(candidate.aliases);
  if (
    typeof termId !== 'string' ||
    !isCmsUuid(termId) ||
    typeof termKey !== 'string' ||
    !TERM_KEY_REGEX.test(termKey) ||
    typeof lifecycle !== 'string' ||
    !(TERM_LIFECYCLES as readonly string[]).includes(lifecycle) ||
    typeof version !== 'string' ||
    !isCmsVersion(version) ||
    parentId === undefined ||
    successorId === undefined ||
    (lifecycle === 'merged') !== (successorId !== null) ||
    labels === null ||
    aliases === null
  )
    return null;
  return {
    termId,
    termKey,
    lifecycle: lifecycle as TermLifecycle,
    version,
    parentId,
    successorId,
    labels,
    aliases,
  };
};

/** The page whose strong ETag is its page version, or null. */
export const verifiedTermsPage = (
  candidate: unknown,
  etag: string | null,
): TermsPageFacts | null => {
  if (
    !isRecord(candidate) ||
    !hasOnly(candidate, ['items', 'nextCursor', 'pageVersion']) ||
    !Array.isArray(candidate.items) ||
    candidate.items.length > 50 ||
    !('nextCursor' in candidate) ||
    (candidate.nextCursor !== null &&
      (typeof candidate.nextCursor !== 'string' ||
        candidate.nextCursor.length > 512)) ||
    typeof candidate.pageVersion !== 'string' ||
    !isCmsVersion(candidate.pageVersion) ||
    etag !== `"${candidate.pageVersion}"`
  )
    return null;
  const items: TermFacts[] = [];
  for (const entry of candidate.items as unknown[]) {
    const term = verifiedTerm(entry);
    if (term === null || items.some((item) => item.termId === term.termId))
      return null;
    items.push(term);
  }
  return {
    items,
    nextCursor: candidate.nextCursor as string | null,
    pageVersion: candidate.pageVersion,
  };
};

/**
 * Read one page of the terms without carrying mutation authority. A 502, 503 or 504 that
 * declares a retry safe is retried after each of `SAFE_READ_RETRY_DELAYS_MS` before the degraded state (FE03 :1173).
 */
export const readTaxonomyTerms = async (
  taxonomyId: string,
  query: TermsQuery = {},
  fetcher: typeof fetch = fetch,
): Promise<TermsResult> => {
  if (!isCmsUuid(taxonomyId)) return { kind: 'unavailable' };
  const search = new URLSearchParams();
  if (query.lifecycle !== undefined) search.set('lifecycle', query.lifecycle);
  if (query.cursor !== undefined) search.set('cursor', query.cursor);
  if (query.limit !== undefined) search.set('limit', String(query.limit));
  const suffix = search.size === 0 ? '' : `?${search}`;
  let response: Response;
  try {
    response = await retryingSafeRead(() =>
      fetcher(`/api/v1/cms/taxonomies/${taxonomyId}/terms${suffix}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      }),
    );
  } catch {
    return { kind: 'unavailable' };
  }
  if (!(response instanceof Response)) return { kind: 'unavailable' };
  if ([401, 403, 404, 409, 429].includes(response.status))
    return {
      kind: 'rejected',
      status: response.status as 401 | 403 | 404 | 409 | 429,
    };
  if (response.status !== 200) return { kind: 'unavailable' };
  let candidate: unknown;
  try {
    candidate = await response.json();
  } catch {
    return { kind: 'unavailable' };
  }
  const page = verifiedTermsPage(candidate, response.headers.get('etag'));
  return page === null ? { kind: 'unavailable' } : { kind: 'loaded', page };
};
