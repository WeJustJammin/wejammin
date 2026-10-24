import { vi } from 'vitest';

import {
  PARENT_ID,
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERM_ID,
} from '../../server/cms-taxonomy-platform.test-support';
import {
  loadedVersions,
  versionFacts,
} from '../cms-taxonomy-designer/taxonomy-designer.test-support';
import type { TaxonomyVersionsResult } from '../cms-taxonomy-designer/taxonomy-versions-read';
import type { CmsTaxonomyTermFormProps } from './CmsTaxonomyTermForm';
import type {
  TermFacts,
  TermsPageFacts,
  TermsResult,
} from './taxonomy-terms-read';
import type { TermActionResult } from './term-action-submit';

export const CSRF_TOKEN = 'csrf-token-000000000001';
export const REVIEW_HREF =
  '/app/cms-content-modeling/definition-reviews/review-1';

export const termFacts = (overrides: Partial<TermFacts> = {}): TermFacts => ({
  termId: TERM_ID,
  termKey: 'guitar',
  lifecycle: 'active',
  version: '2',
  parentId: null,
  successorId: null,
  labels: [{ locale: 'en', label: 'Guitar' }],
  aliases: ['axe'],
  ...overrides,
});

export const organ = termFacts({
  termId: SURVIVOR_ID,
  termKey: 'organ',
  labels: [{ locale: 'en', label: 'Organ' }],
  aliases: [],
});
export const strings = termFacts({
  termId: PARENT_ID,
  termKey: 'strings',
  lifecycle: 'deprecated',
  labels: [{ locale: 'en', label: 'Strings' }],
  aliases: [],
});
export const oldOrgan = termFacts({
  termId: '50000000-0000-4000-8000-000000000008',
  termKey: 'old-organ',
  lifecycle: 'merged',
  successorId: SURVIVOR_ID,
  labels: [{ locale: 'en', label: 'Old organ' }],
  aliases: [],
});

export const pageFacts = (
  items: readonly TermFacts[] = [termFacts(), organ, strings, oldOrgan],
  overrides: Partial<TermsPageFacts> = {},
): TermsPageFacts => ({
  items,
  nextCursor: null,
  pageVersion: '7',
  ...overrides,
});

/** A term known by a key and one English label. */
export const namedTerm = (
  termId: string,
  termKey: string,
  label: string,
  overrides: Partial<TermFacts> = {},
): TermFacts =>
  termFacts({
    termId,
    termKey,
    labels: [{ locale: 'en', label }],
    aliases: [],
    ...overrides,
  });

/** A terms read that answers one page of the vocabulary. */
export const termsPage = (
  items: readonly TermFacts[],
  nextCursor: string | null,
): TermsResult => termsLoaded(pageFacts(items, { nextCursor }));

/** The values of a select's options, in order. */
export const optionValues = (select: HTMLSelectElement): string[] =>
  Array.from(select.options).map((option) => option.value);

export const formProps = (
  overrides: Partial<CmsTaxonomyTermFormProps> = {},
): CmsTaxonomyTermFormProps => ({
  vocabulary: {
    taxonomyId: TAXONOMY_ID,
    taxonomyKey: 'instruments',
    shape: 'hierarchical',
    active: { version: '2' },
  },
  terms: pageFacts(),
  query: { lifecycle: null, cursor: null },
  basePath: `/app/cms-content-modeling/taxonomies/${TAXONOMY_ID}`,
  reviewHref: REVIEW_HREF,
  csrfToken: CSRF_TOKEN,
  ...overrides,
});

export const doneResult = (
  overrides: Partial<Extract<TermActionResult, { kind: 'done' }>['term']> = {},
): TermActionResult => ({
  kind: 'done',
  term: {
    termId: TERM_ID,
    termKey: 'guitar',
    lifecycle: 'active',
    parentId: null,
    successorId: null,
    version: '1',
    ...overrides,
  },
});

export const submitStub = (...results: TermActionResult[]) => {
  const queue = [...results];
  return vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected submit');
    return next;
  });
};

export const termsLoaded = (
  page: TermsPageFacts = pageFacts(),
): TermsResult => ({
  kind: 'loaded',
  page,
});

/** Answers the queued results, then repeats the last one. */
export const readTermsStub = (...results: TermsResult[]) => {
  const queue = [...results];
  return vi.fn(async () =>
    queue.length > 1
      ? (queue.shift() as TermsResult)
      : (queue[0] as TermsResult),
  );
};

export const readVersionsStub = (...results: TaxonomyVersionsResult[]) => {
  const queue =
    results.length === 0 ? [loadedVersions([versionFacts()])] : [...results];
  return vi.fn(async () =>
    queue.length > 1
      ? (queue.shift() as TaxonomyVersionsResult)
      : (queue[0] as TaxonomyVersionsResult),
  );
};

/**
 * A terms read whose answers the test releases one at a time, so a test can look at the form
 * while a read is in flight (the loading state of a picker).
 */
export const heldTermsRead = () => {
  const waiting: Array<(result: TermsResult) => void> = [];
  const read = vi.fn(
    () =>
      new Promise<TermsResult>((resolve) => {
        waiting.push(resolve);
      }),
  );
  return {
    read,
    /** Answers the oldest read still waiting. */
    release: (result: TermsResult): void => {
      const answer = waiting.shift();
      if (answer === undefined) throw new Error('no read is waiting');
      answer(result);
    },
    pending: (): number => waiting.length,
  };
};
