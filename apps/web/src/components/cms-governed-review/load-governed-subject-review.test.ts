import { describe, expect, it } from 'vitest';

import {
  governedQueueItem,
  governedQueuePageFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import type { CmsGovernedPageReads } from './governed-review-page-reads';
import {
  GOVERNED_SUBJECT_REVIEW_MAX_PAGES,
  loadGovernedSubjectReview,
} from './load-governed-subject-review';

const SUBJECT = {
  kind: 'template_version',
  key: 'profile-header',
  version: 2,
} as const;

const page = (
  items: readonly Record<string, unknown>[],
  nextCursor: string | null = null,
) =>
  jsonResponse(200, governedQueuePageFixture(items, nextCursor), {
    etag: '"5"',
  });

const load = (responses: readonly Response[]) => {
  const seen: Request[] = [];
  const queue = [...responses];
  const result = loadGovernedSubjectReview({
    request: new Request(
      'https://web.test/app/cms-content-modeling/templates/x?draft=1',
      {
        headers: { cookie: 'session=abc' },
      },
    ),
    reads: {
      reviewQueue: async (request: Request) => {
        seen.push(request);
        return queue.shift() ?? new Response(null, { status: 500 });
      },
    } as unknown as CmsGovernedPageReads,
    subject: SUBJECT,
  });
  return { result, seen };
};

describe('loadGovernedSubjectReview (FE03 :877, :1066)', () => {
  it('finds the review of exactly this subject version in the owned queue and returns only its summary', async () => {
    const { result, seen } = load([
      page([
        governedQueueItem(1, { subjectVersion: 1, state: 'rejected' }),
        governedQueueItem(2, {
          state: 'open',
          requiredDecisionCount: 2,
          recordedDecisionCount: 1,
        }),
      ]),
    ]);
    expect(await result).toEqual({
      reviewId: governedQueueItem(2).reviewId,
      state: 'open',
      requiredDecisionCount: 2,
      recordedDecisionCount: 1,
    });
    const url = new URL(seen[0]?.url ?? '');
    expect(url.pathname).toBe('/api/v1/cms/governed-reviews');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      scope: 'owned',
      subjectKind: 'template_version',
      limit: '50',
    });
    expect(seen[0]?.method).toBe('GET');
    expect(seen[0]?.headers.get('cookie')).toBe('session=abc');
  });

  it('does not match another key, another kind or another version', async () => {
    const { result } = load([
      page([
        governedQueueItem(2, { subjectKey: 'other-header' }),
        governedQueueItem(3, { subjectKind: 'pattern_version' }),
        governedQueueItem(4, { subjectVersion: 3 }),
      ]),
    ]);
    expect(await result).toBeNull();
  });

  it('follows the signed cursor to a later page, keeping the filters', async () => {
    const { result, seen } = load([
      page([governedQueueItem(1, { subjectVersion: 9 })], 'c.1'),
      page([governedQueueItem(2)]),
    ]);
    expect((await result)?.reviewId).toBe(governedQueueItem(2).reviewId);
    const second = new URL(seen[1]?.url ?? '');
    expect(second.searchParams.get('cursor')).toBe('c.1');
    expect(second.searchParams.get('scope')).toBe('owned');
    expect(second.searchParams.get('limit')).toBe('50');
  });

  it('stops after a bounded number of pages', async () => {
    const pages = Array.from(
      { length: GOVERNED_SUBJECT_REVIEW_MAX_PAGES + 2 },
      (_, index) =>
        page(
          [governedQueueItem(index + 10, { subjectVersion: 9 })],
          `c.${index}`,
        ),
    );
    const { result, seen } = load(pages);
    expect(await result).toBeNull();
    expect(seen).toHaveLength(GOVERNED_SUBJECT_REVIEW_MAX_PAGES);
  });

  it.each([
    ['a refused read', new Response('x', { status: 403 })],
    ['an expired cursor', new Response('x', { status: 409 })],
    [
      'a refused read that still carries a valid page',
      jsonResponse(403, governedQueuePageFixture([governedQueueItem(2)], null)),
    ],
    ['a server error', new Response('x', { status: 502 })],
    ['a body that is not JSON', new Response('not json', { status: 200 })],
    [
      'a page that names more than the contract allows',
      jsonResponse(200, {
        items: [{ ...governedQueueItem(2), personId: 'p' }],
        nextCursor: null,
        pageVersion: '5',
      }),
    ],
  ])('shows no summary for %s', async (_name, response) => {
    expect(await load([response]).result).toBeNull();
  });

  it('shows no summary when the read itself throws', async () => {
    const result = await loadGovernedSubjectReview({
      request: new Request('https://web.test/x'),
      reads: {
        reviewQueue: async () => {
          throw new Error('binding gone');
        },
      } as unknown as CmsGovernedPageReads,
      subject: SUBJECT,
    });
    expect(result).toBeNull();
  });
});
