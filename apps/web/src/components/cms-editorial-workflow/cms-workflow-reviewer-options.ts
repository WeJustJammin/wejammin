import { addClientBindingIdHeader } from '../../lib/client-binding';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import {
  loadCmsValidators,
  loadedCmsValidators,
  type CmsValidators,
} from '../../lib/cms-contract-validators';

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
  | {
      readonly kind: 'unavailable';
      /**
       * Present only for a 429 (FE03 :1172): the wait the server stated (null when none), after
       * which the form reads the choices again.
       */
      readonly rateLimit?: { readonly retryAfterSeconds: number | null };
    };

const BASE =
  '/api/v1/cms/capability-grants?capability=cms.reviewer&state=active&limit=100';
const MAX_PAGES = 5;

type Page =
  | {
      readonly kind: 'page';
      readonly parsed: ReturnType<
        CmsValidators['CmsCapabilityGrantListPageSchema']['safeParse']
      >;
    }
  | {
      readonly kind: 'rate-limited';
      readonly retryAfterSeconds: number | null;
    };

const readPage = async (path: string, fetcher: Fetcher): Promise<Page> => {
  // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
  const response = await retryingSafeRead(async () =>
    fetcher(
      path,
      await addClientBindingIdHeader(path, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'manual',
        headers: { accept: 'application/json' },
      }),
    ),
  );
  if (response.status === 429)
    return {
      kind: 'rate-limited',
      retryAfterSeconds: await rateLimitWaitSeconds(response),
    };
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // An unreadable body fails the strict parse below.
  }
  const validators = loadedCmsValidators() ?? (await loadCmsValidators());
  return {
    kind: 'page',
    parsed: validators.CmsCapabilityGrantListPageSchema.safeParse(
      response.ok ? body : null,
    ),
  };
};

export const loadReviewerOptions = async (
  fetcher: Fetcher = fetch,
): Promise<ReviewerOptionsResult> => {
  const byPerson = new Map<string, ReviewerOption>();
  let cursor: string | null = null;
  try {
    for (let pages = 0; pages < MAX_PAGES; pages += 1) {
      const answer = await readPage(
        cursor === null ? BASE : `${BASE}&cursor=${encodeURIComponent(cursor)}`,
        fetcher,
      );
      if (answer.kind === 'rate-limited')
        return {
          kind: 'unavailable',
          rateLimit: { retryAfterSeconds: answer.retryAfterSeconds },
        };
      if (!answer.parsed.success) return { kind: 'unavailable' };
      const page = answer.parsed.data;
      for (const item of page.items)
        if (
          item.capability === 'cms.reviewer' &&
          item.state === 'active' &&
          !byPerson.has(item.subjectPersonId)
        )
          byPerson.set(item.subjectPersonId, {
            personId: item.subjectPersonId,
            endsAt: item.endsAt,
          });
      cursor = page.nextCursor;
      if (cursor === null) break;
    }
  } catch {
    return { kind: 'unavailable' };
  }
  return { kind: 'ok', options: [...byPerson.values()] };
};
