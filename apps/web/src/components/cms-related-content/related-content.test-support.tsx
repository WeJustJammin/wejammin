import { vi } from 'vitest';

import { mountElement } from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsRelatedContentForm, {
  type CmsRelatedContentFormProps,
} from './CmsRelatedContentForm';
import type { RelatedCandidate } from './related-candidates';
import type { RelatedRuleSnapshot } from './related-content-types';
import type {
  RefusedRow,
  RelatedSubmitResult,
  SavedRelatedContent,
} from './related-content-submit';

export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const PAGE_PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/related-content`;
export const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;

export const candidate = (
  n: number,
  extra: Partial<RelatedCandidate> = {},
): RelatedCandidate => ({
  entryId: id(n),
  lifecycle: 'active',
  locale: 'en-US',
  state: 'draft',
  updatedAt: '2026-10-15T11:00:00Z',
  ...extra,
});

export const savedOf = (
  extra: Partial<SavedRelatedContent> = {},
): SavedRelatedContent => ({
  version: '5',
  eligibleCount: 3,
  pins: [],
  exclusions: [],
  derivedRule: null,
  ...extra,
});

/** A submit stub that answers `result` and records every request it was given. */
export const submitStub = (
  result: RelatedSubmitResult | ((call: number) => RelatedSubmitResult) = {
    kind: 'saved',
    saved: savedOf(),
  },
) => {
  let calls = 0;
  return vi.fn(async (...args: [unknown, string, string]) => {
    void args;
    const call = calls++;
    return typeof result === 'function' ? result(call) : result;
  });
};

/** A known saved rule with nothing in it: the shape the future read (SG-S12-03) will supply. */
export const EMPTY_RULE: RelatedRuleSnapshot = {
  pins: [],
  exclusions: [],
  derivedRule: null,
};

export const rows = (...pointers: RefusedRow[]): RefusedRow[] => pointers;

export const formProps = (
  extra: Partial<CmsRelatedContentFormProps> = {},
): CmsRelatedContentFormProps => ({
  entry: {
    entryId: ENTRY_ID,
    version: '4',
    locale: 'en-US',
    lifecycle: 'active',
  },
  rule: EMPTY_RULE,
  candidates: {
    items: [
      candidate(1),
      candidate(2),
      candidate(3),
      candidate(4, { lifecycle: 'archived' }),
    ],
    nextCursor: null,
  },
  returnTo: PAGE_PATH,
  csrfToken: 'csrf-token',
  ...extra,
});

export const mount = (extra: Partial<CmsRelatedContentFormProps> = {}) =>
  mountElement(<CmsRelatedContentForm {...formProps(extra)} />);

export const text = (container: HTMLElement): string =>
  container.textContent ?? '';
export const listItems = (container: HTMLElement, selector: string): string[] =>
  Array.from(container.querySelectorAll(`${selector} > li`)).map(
    (item) => item.querySelector('code')?.textContent ?? '',
  );
