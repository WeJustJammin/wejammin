import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import { startReadDeadline } from '../../lib/read-deadline';
import { withinDeadline } from '../../lib/read-within-deadline';
import { retryingSafeRead } from '../../lib/safe-read-retry';
import { TAXONOMY_VERSIONS_PAGE_MAX } from './taxonomy-vocabulary-core';
import { TAG_LIMIT, tagPattern, type TagKind } from './taxonomy-tags';
import {
  TAXONOMY_KEY_REGEX,
  TAXONOMY_SHAPES,
  isCanonicalDomain,
  isDefinitionState,
  type CanonicalDomain,
  type TaxonomyDefinitionState,
  type TaxonomyShape,
} from './taxonomy-vocabulary';

/**
 * The verified facts of a vocabulary's versions (`cmsTaxonomyVersionsRead`). The same-origin
 * proxy has already parsed the strict `TaxonomyVersionsPage`; the browser repeats the
 * identity binding and the rules structurally (zod-free, FE03 AC261), and keeps only the
 * members the pages use.
 */
export interface TaxonomyVersionFacts {
  readonly id: string;
  readonly version: string;
  readonly contentHash: string;
  readonly state: TaxonomyDefinitionState;
  readonly taxonomyId: string;
  readonly taxonomyKey: string;
  readonly taxonomyVersion: number;
  readonly shape: TaxonomyShape;
  readonly allowedTypeKeys: readonly string[];
  readonly allowedFieldKeys: readonly string[];
  readonly canonicalOverlapDomains: readonly CanonicalDomain[];
}

export interface TaxonomyVersionsPageFacts {
  /** Newest first. */
  readonly items: readonly TaxonomyVersionFacts[];
  readonly pageVersion: string;
}

export type TaxonomyVersionsResult =
  | { readonly kind: 'loaded'; readonly page: TaxonomyVersionsPageFacts }
  | { readonly kind: 'rejected'; readonly status: 401 | 403 | 404 | 429 }
  | { readonly kind: 'unavailable' };

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnly = (record: Json, allowed: readonly string[]): boolean =>
  Object.keys(record).every((key) => allowed.includes(key));

const VERSION_MEMBERS = [
  'id',
  'version',
  'contentHash',
  'createdAt',
  'updatedAt',
  'state',
  'taxonomyId',
  'taxonomyKey',
  'taxonomyVersion',
  'shape',
  'allowedTypeKeys',
  'allowedFieldKeys',
  'canonicalOverlapDomains',
];

const isInstant = (value: unknown): boolean =>
  typeof value === 'string' &&
  value.length <= 40 &&
  !Number.isNaN(Date.parse(value));

/** 1 to 64 unique keys of the contract grammar. */
const allowlist = (value: unknown, kind: TagKind): string[] | null =>
  Array.isArray(value) &&
  value.length >= 1 &&
  value.length <= TAG_LIMIT &&
  value.every(
    (entry): entry is string =>
      typeof entry === 'string' && tagPattern(kind).test(entry),
  ) &&
  new Set(value).size === value.length
    ? value
    : null;

const domains = (value: unknown): CanonicalDomain[] | null =>
  Array.isArray(value) &&
  value.length <= 6 &&
  value.every(isCanonicalDomain) &&
  new Set(value).size === value.length
    ? (value as CanonicalDomain[])
    : null;

const verifiedVersion = (
  candidate: unknown,
  taxonomyId: string,
): TaxonomyVersionFacts | null => {
  if (!isRecord(candidate) || !hasOnly(candidate, VERSION_MEMBERS)) return null;
  const typeKeys = allowlist(candidate.allowedTypeKeys, 'type');
  const fieldKeys = allowlist(candidate.allowedFieldKeys, 'field');
  const declared = domains(candidate.canonicalOverlapDomains);
  const {
    id,
    version,
    contentHash,
    state,
    taxonomyKey,
    taxonomyVersion,
    shape,
  } = candidate;
  if (
    typeof id !== 'string' ||
    !isCmsUuid(id) ||
    typeof version !== 'string' ||
    !isCmsVersion(version) ||
    typeof contentHash !== 'string' ||
    !CMS_HASH_PATTERN.test(contentHash) ||
    !isInstant(candidate.createdAt) ||
    !isInstant(candidate.updatedAt) ||
    !isDefinitionState(state) ||
    candidate.taxonomyId !== taxonomyId ||
    typeof taxonomyKey !== 'string' ||
    !TAXONOMY_KEY_REGEX.test(taxonomyKey) ||
    typeof taxonomyVersion !== 'number' ||
    !Number.isSafeInteger(taxonomyVersion) ||
    version !== String(taxonomyVersion) ||
    typeof shape !== 'string' ||
    !(TAXONOMY_SHAPES as readonly string[]).includes(shape) ||
    typeKeys === null ||
    fieldKeys === null ||
    declared === null
  )
    return null;
  return {
    id,
    version,
    contentHash,
    state,
    taxonomyId,
    taxonomyKey,
    taxonomyVersion,
    shape: shape as TaxonomyShape,
    allowedTypeKeys: typeKeys,
    allowedFieldKeys: fieldKeys,
    canonicalOverlapDomains: declared,
  };
};

export { TAXONOMY_VERSIONS_PAGE_MAX };

/** The page of THIS vocabulary, newest first, whose strong ETag is its page version, or null. */
export const verifiedVersionsPage = (
  candidate: unknown,
  taxonomyId: string,
  etag: string | null,
): TaxonomyVersionsPageFacts | null => {
  if (
    !isRecord(candidate) ||
    !hasOnly(candidate, ['items', 'pageVersion']) ||
    !Array.isArray(candidate.items) ||
    candidate.items.length > TAXONOMY_VERSIONS_PAGE_MAX ||
    typeof candidate.pageVersion !== 'string' ||
    !isCmsVersion(candidate.pageVersion) ||
    etag !== `"${candidate.pageVersion}"`
  )
    return null;
  const items: TaxonomyVersionFacts[] = [];
  for (const entry of candidate.items as unknown[]) {
    const version = verifiedVersion(entry, taxonomyId);
    const previous = items.at(-1);
    if (
      version === null ||
      (previous !== undefined &&
        version.taxonomyVersion >= previous.taxonomyVersion)
    )
      return null;
    items.push(version);
  }
  return { items, pageVersion: candidate.pageVersion };
};

/**
 * Read the authoritative versions without carrying mutation authority. A 502, 503 or 504 that
 * declares a retry safe is retried after each of `SAFE_READ_RETRY_DELAYS_MS` before the degraded state (FE03 :1173).
 */
export const readTaxonomyVersions = async (
  taxonomyId: string,
  fetcher: typeof fetch = fetch,
): Promise<TaxonomyVersionsResult> => {
  if (!isCmsUuid(taxonomyId)) return { kind: 'unavailable' };
  // The shared read deadline covers the fetch, its safe retries and the body (DEC-246(1)).
  const deadline = startReadDeadline();
  try {
    const response = await withinDeadline(
      deadline,
      retryingSafeRead(() =>
        fetcher(`/api/v1/cms/taxonomies/${taxonomyId}/versions`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          signal: deadline.signal,
        }),
      ),
    );
    if (!(response instanceof Response)) return { kind: 'unavailable' };
    if ([401, 403, 404, 429].includes(response.status))
      return {
        kind: 'rejected',
        status: response.status as 401 | 403 | 404 | 429,
      };
    if (response.status !== 200) return { kind: 'unavailable' };
    const candidate = await withinDeadline(deadline, response.json());
    const page = verifiedVersionsPage(
      candidate,
      taxonomyId,
      response.headers.get('etag'),
    );
    return page === null ? { kind: 'unavailable' } : { kind: 'loaded', page };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    deadline.clear();
  }
};
