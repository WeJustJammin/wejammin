import type {
  EditorialReviewDetailResource,
  EntryWorkflowResource,
} from '@wejammin/contracts';
import { vi } from 'vitest';

import { mountElement } from '../cms-editorial-fields/cms-editor-dom.test-support';
import { CSRF } from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialReviewDetailIsland from './CmsEditorialReviewDetailIsland';
import CmsEditorialWorkflowIsland from './CmsEditorialWorkflowIsland';
import type { CanonicalReadResult } from './cms-workflow-canonical-read';
import type { Fetcher } from './cms-workflow-focus.test-support';
import {
  ENTRY_ID,
  INSTANT,
  REVIEW_ID,
} from './cms-workflow-fixtures.test-support';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';

/** A verified read of `resource`. */
export const ok = <T,>(resource: T): CanonicalReadResult<T> => ({
  kind: 'ok',
  resource,
});

/** Test seams over the real island: the read it refetches with and the wire it sends on. */
export interface IslandSeams<T> {
  readonly readResource?: () => Promise<CanonicalReadResult<T>>;
  readonly fetcher?: Fetcher;
}

const environment = (fetcher: Fetcher, key: string) => ({
  transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
  newKey: () => key,
  storage: () => null,
  navigate: () => undefined,
});

/**
 * The workflow island over a queue of reads and a queue of command answers (or
 * the explicit `readResource` / `fetcher` seams, for a read or a wire a test
 * holds by hand).
 */
export const mountWorkflowIsland = (
  initial: EntryWorkflowResource,
  reads: readonly CanonicalReadResult<EntryWorkflowResource>[] = [],
  responses: readonly Response[] = [],
  seams: IslandSeams<EntryWorkflowResource> = {},
) => {
  const queue = [...reads];
  const readWorkflow = vi.fn(
    seams.readResource ?? (async () => queue.shift() ?? ok(initial)),
  );
  const answers = [...responses];
  const fetcher = vi.fn(
    seams.fetcher ?? (async () => answers.shift() as Response),
  );
  const mounted = mountElement(
    <CmsEditorialWorkflowIsland
      init={{
        workflow: initial,
        entryId: ENTRY_ID,
        revisionId: null,
        verifiedAt: INSTANT,
      }}
      readWorkflow={readWorkflow}
      environment={environment(fetcher, 'idem-key-workflow-001')}
    />,
  );
  return { ...mounted, readWorkflow, fetcher };
};

/** The review detail island, with the owner-only reviewer options a test supplies. */
export const mountReviewIsland = (
  initial: EditorialReviewDetailResource,
  reads: readonly CanonicalReadResult<EditorialReviewDetailResource>[] = [],
  responses: readonly Response[] = [],
  options: {
    readonly loadOptions?: () => Promise<ReviewerOptionsResult>;
  } & IslandSeams<EditorialReviewDetailResource> = {},
) => {
  const queue = [...reads];
  const readReview = vi.fn(
    options.readResource ?? (async () => queue.shift() ?? ok(initial)),
  );
  const answers = [...responses];
  const fetcher = vi.fn(
    options.fetcher ?? (async () => answers.shift() as Response),
  );
  const mounted = mountElement(
    <CmsEditorialReviewDetailIsland
      init={{ review: initial, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      readReview={readReview}
      loadOptions={
        options.loadOptions ?? (async () => ({ kind: 'ok', options: [] }))
      }
      environment={environment(fetcher, 'idem-key-detail-0001')}
    />,
  );
  return { ...mounted, readReview, fetcher };
};

/** The titles of the command forms an island renders, in document order. */
export const formTitles = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-cms-workflow-form] > h3')].map(
    (heading) => heading.textContent ?? '',
  );
