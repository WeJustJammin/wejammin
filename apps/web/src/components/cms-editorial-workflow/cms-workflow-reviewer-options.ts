import { CmsCapabilityGrantListPageSchema } from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';

/**
 * The reviewers an owner may assign (CMS-03B-18, DEC-136): the owner-only grant
 * list (CMS-03A-18) filtered to active `cms.reviewer` grants, read in the
 * browser when the assignment form mounts. The person ids therefore live only
 * in this island's memory: they are never in a URL, a prop dump, storage or a
 * log, and the chosen one is discarded on a step-up navigation.
 */
type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ReviewerOption {
  readonly personId: string;
  /** The end of that reviewer's grant: an upper bound of an assignment's expiry. */
  readonly endsAt: string;
}

export type ReviewerOptionsResult =
  | { readonly kind: 'ok'; readonly options: readonly ReviewerOption[] }
  | { readonly kind: 'unavailable' };

const BASE =
  '/api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100';
const MAX_PAGES = 5;

const readPage = async (
  path: string,
  fetcher: Fetcher,
): Promise<ReturnType<typeof CmsCapabilityGrantListPageSchema.safeParse>> => {
  const response = await fetcher(
    path,
    await addClientBindingIdHeader(path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: { accept: 'application/json' },
    }),
  );
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // An unreadable body fails the strict parse below.
  }
  return CmsCapabilityGrantListPageSchema.safeParse(response.ok ? body : null);
};

export const loadReviewerOptions = async (
  fetcher: Fetcher = fetch,
): Promise<ReviewerOptionsResult> => {
  const byPerson = new Map<string, ReviewerOption>();
  let cursor: string | null = null;
  try {
    for (let pages = 0; pages < MAX_PAGES; pages += 1) {
      const parsed = await readPage(
        cursor === null ? BASE : `${BASE}&cursor=${encodeURIComponent(cursor)}`,
        fetcher,
      );
      if (!parsed.success) return { kind: 'unavailable' };
      for (const item of parsed.data.items)
        if (
          item.capability === 'cms.reviewer' &&
          item.state === 'active' &&
          !byPerson.has(item.subjectPersonId)
        )
          byPerson.set(item.subjectPersonId, {
            personId: item.subjectPersonId,
            endsAt: item.endsAt,
          });
      cursor = parsed.data.nextCursor;
      if (cursor === null) break;
    }
  } catch {
    return { kind: 'unavailable' };
  }
  return { kind: 'ok', options: [...byPerson.values()] };
};
