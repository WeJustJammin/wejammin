import { ReviewQueuePageSchema } from '@wejammin/contracts';
import { describe, it } from 'vitest';

import {
  at,
  breachRows,
  expectRefused,
  expectServed,
  instantBefore,
  uuid,
  type Breach,
  type BreachSchema,
} from './workflow-read-breach.test-support';
import {
  queueItem,
  queuePage,
  reviewId,
} from './workflow-fixtures.test-support';

/*
 * CMS-03B-17 page bounds (BE03b `ReviewQueuePage`; AC-061):
 * at most 50 rows in (updatedAt DESC, reviewId DESC) keyset order, a next cursor
 * of at most 512 characters, a pageVersion, and rows that keep the review
 * invariants and name no member beyond the contract. Any other answer is refused
 * and never served; the inclusive bound is served.
 */

const schema = ReviewQueuePageSchema as BreachSchema;
const path = '/api/v1/cms/reviews?limit=50';

/** The `index`th row of a page: distinct ids, strictly older as `index` grows. */
const row = (index: number, patch: Record<string, unknown> = {}) => ({
  ...queueItem,
  reviewId: uuid(index),
  updatedAt: instantBefore(index),
  ...patch,
});
const page = (count: number) => ({
  ...queuePage,
  items: Array.from({ length: count }, (_, index) => row(index)),
});

const breaches: readonly Breach[] = [
  ['51 rows', page(51), at('items')],
  [
    'a next cursor of 513 characters',
    { ...queuePage, nextCursor: 'x'.repeat(513) },
    at('nextCursor'),
  ],
  [
    'rows out of (updatedAt DESC, reviewId DESC) order',
    { ...queuePage, items: [row(1), row(0)] },
    at('items'),
  ],
  [
    'a row with more recorded decisions than required',
    { ...queuePage, items: [row(0, { recordedDecisionCount: 2 })] },
    at('items'),
  ],
  [
    'a protected row requiring fewer than 2 decisions',
    { ...queuePage, items: [row(0, { riskClass: 'protected' })] },
    at('items'),
  ],
  [
    'a row with a member the contract does not name',
    { ...queuePage, items: [row(0, { submitterPersonId: reviewId })] },
    at('items'),
  ],
  [
    'a page with no pageVersion',
    Object.fromEntries(
      Object.entries(queuePage).filter(([name]) => name !== 'pageVersion'),
    ),
    at('pageVersion'),
  ],
];

describe('CMS-03B-17 page bounds are refused, never served [P2-S11-AC-061]', () => {
  it.each(breachRows(breaches))('refuses %s', async (_name, breach) => {
    await expectRefused('listEditorialReviews', schema, path, breach);
  });

  it('serves 50 rows and a 512 character cursor, one fewer than a refused page', async () => {
    await expectServed('listEditorialReviews', schema, path, {
      ...page(50),
      nextCursor: 'x'.repeat(512),
    });
  });
});
