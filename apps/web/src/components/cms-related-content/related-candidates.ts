import type { EntryListPage } from '@wejammin/contracts';
import { isCmsUuid } from '@wejammin/contracts/client';

import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';

/*
 * The pin and exclusion candidates (FE03 :890: "chosen from the caller-readable entry list
 * (CMS-03B-13)"; "the picker never lists an entry the caller cannot read"). They come ONLY from the
 * protected entry list, which lists the entries the caller is assigned to or owns, so the picker can
 * never offer what the editor could not already see. The list carries no title; a candidate is
 * identified by its entry id plus the facts the list does carry.
 */
export const ENTRY_LIST_PATH = '/api/v1/cms/entries';
export const CANDIDATE_PAGE_LIMIT = 50;
const MAX_CURSOR = 512;
const LIFECYCLES = ['active', 'archived', 'deletion_pending', 'held'] as const;
export type CandidateLifecycle = (typeof LIFECYCLES)[number];

export interface RelatedCandidate {
  readonly entryId: string;
  readonly lifecycle: CandidateLifecycle;
  readonly locale: string;
  /** The revision state word (draft, submitted, ...), shown as text. */
  readonly state: string;
  readonly updatedAt: string;
}

export interface CandidatePage {
  readonly items: readonly RelatedCandidate[];
  readonly nextCursor: string | null;
}

/** A pin target must be an `active` entry (BE03c 1417 b); the server still decides eligibility. */
export const isPinnable = (candidate: RelatedCandidate): boolean =>
  candidate.lifecycle === 'active';

/** The strict page the loader already verified with zod, reduced to what the picker shows. */
export const candidatesFromPage = (
  page: EntryListPage,
  sourceEntryId: string,
): CandidatePage => ({
  items: page.items
    .filter((entry) => entry.entryId !== sourceEntryId)
    .map((entry) => ({
      entryId: entry.entryId,
      lifecycle: entry.entryLifecycle,
      locale: entry.locale,
      state: entry.state,
      updatedAt: entry.entryUpdatedAt,
    })),
  nextCursor: page.nextCursor,
});

/** Append `more` to `current`, never listing an entry twice (within `more` either). */
export const mergeCandidates = (
  current: readonly RelatedCandidate[],
  more: readonly RelatedCandidate[],
): RelatedCandidate[] => {
  const seen = new Set(current.map((entry) => entry.entryId));
  const added: RelatedCandidate[] = [];
  for (const entry of more) {
    if (seen.has(entry.entryId)) continue;
    seen.add(entry.entryId);
    added.push(entry);
  }
  return [...current, ...added];
};

const MEMBERS = new Set([
  'id',
  'revisionNumber',
  'locale',
  'state',
  'contentHash',
  'createdAt',
  'authorClass',
  'entryId',
  'entryLifecycle',
  'entryUpdatedAt',
]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const candidateOf = (raw: unknown): RelatedCandidate | null => {
  if (!isRecord(raw) || Object.keys(raw).some((key) => !MEMBERS.has(key)))
    return null;
  const { entryId, entryLifecycle, locale, state, entryUpdatedAt } = raw;
  if (
    typeof entryId !== 'string' ||
    !isCmsUuid(entryId) ||
    typeof entryLifecycle !== 'string' ||
    !(LIFECYCLES as readonly string[]).includes(entryLifecycle) ||
    typeof locale !== 'string' ||
    locale.length === 0 ||
    typeof state !== 'string' ||
    state.length === 0 ||
    typeof entryUpdatedAt !== 'string' ||
    entryUpdatedAt.length === 0
  )
    return null;
  return {
    entryId,
    lifecycle: entryLifecycle as CandidateLifecycle,
    locale,
    state,
    updatedAt: entryUpdatedAt,
  };
};

/**
 * A "load more" answer, verified structurally (the proxy already parsed the strict `EntryListPage`):
 * a page that is not that shape, or any item carrying a member the list contract does not define
 * (an owner or assignee identifier), is refused whole.
 */
export const verifiedCandidatePage = (
  body: unknown,
  sourceEntryId: string,
): CandidatePage | null => {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  if (body.items.length > CANDIDATE_PAGE_LIMIT) return null;
  const cursor = body.nextCursor;
  if (
    cursor !== null &&
    (typeof cursor !== 'string' || cursor.length > MAX_CURSOR)
  )
    return null;
  const items: RelatedCandidate[] = [];
  for (const raw of body.items) {
    const candidate = candidateOf(raw);
    if (candidate === null) return null;
    if (candidate.entryId !== sourceEntryId) items.push(candidate);
  }
  return { items: mergeCandidates([], items), nextCursor: cursor };
};

export type CandidateFetch =
  | { readonly kind: 'page'; readonly page: CandidatePage }
  | { readonly kind: 'restart' }
  | { readonly kind: 'signin' }
  /** A 429 (FE03 :1172): the whole seconds it asked to wait, or null when none was stated or believed. */
  | { readonly kind: 'rate_limited'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'failed' };

/**
 * One same-origin read of the entry list under the FE03 network and retry contract (:1172-1175): a 502, 503
 * or 504 the BE declares retryable is retried twice (250 ms, 750 ms, `retryingSafeRead`); a 429 is not
 * retried but reports its `Retry-After` wait; a 409 cursor conflict restarts from the first page.
 */
export const fetchCandidatePage = async (
  cursor: string | null,
  sourceEntryId: string,
  fetcher: typeof fetch = fetch,
): Promise<CandidateFetch> => {
  const search = new URLSearchParams({ limit: String(CANDIDATE_PAGE_LIMIT) });
  if (cursor !== null) search.set('cursor', cursor);
  let response: Response;
  try {
    response = await retryingSafeRead(() =>
      fetcher(`${ENTRY_LIST_PATH}?${search}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        headers: { accept: 'application/json' },
      }),
    );
  } catch {
    return { kind: 'failed' };
  }
  if (!(response instanceof Response)) return { kind: 'failed' };
  if (response.status === 401) return { kind: 'signin' };
  if (response.status === 409) return { kind: 'restart' };
  if (response.status === 429)
    return {
      kind: 'rate_limited',
      retryAfterSeconds: await rateLimitWaitSeconds(response),
    };
  if (response.status !== 200) return { kind: 'failed' };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'failed' };
  }
  const page = verifiedCandidatePage(body, sourceEntryId);
  return page === null ? { kind: 'failed' } : { kind: 'page', page };
};
