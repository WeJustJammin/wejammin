// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  approvedWorkflowFixture,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';
import {
  mountReviewIsland,
  mountWorkflowIsland,
} from './cms-workflow-island-mount.test-support';

/*
 * FE03 "Network and retry contract" (:1172): a canonical read answered 429 is announced politely
 * in the island with the wait it stated. A form asks for the read through its `refetch` prop, so
 * the forms are replaced by a button that does the same.
 */
vi.mock('./cms-workflow-form-views', () => ({
  ReviewSubmitFormView: () => null,
  ScheduleFormView: () => null,
  PublishConfirmationView: () => null,
  PreviewFormView: ({ refetch }: { refetch: () => Promise<boolean> }) => (
    <button type="button" onClick={() => void refetch()}>
      Read again
    </button>
  ),
}));
vi.mock('./cms-review-form-views', () => ({
  ReviewAssignmentFormView: () => null,
  DecisionFormView: ({ refetch }: { refetch: () => Promise<boolean> }) => (
    <button type="button" onClick={() => void refetch()}>
      Read again
    </button>
  ),
}));

beforeAll(enableReactAct);
afterAll(disableReactAct);

const limited = {
  kind: 'degraded',
  requestId: null,
  rateLimit: { retryAfterSeconds: 7 },
} as const;

const notice = (container: HTMLElement): Element | null =>
  container.querySelector('[data-cms-workflow-rate-limit]');

describe('the editorial islands announce a rate-limited read', () => {
  it('names the wait politely in the workflow island and keeps the panel', async () => {
    const { container } = mountWorkflowIsland(
      approvedWorkflowFixture({ permittedNextActions: ['preview'] }),
      [limited],
    );
    expect(notice(container)?.textContent).toBe('');
    await click(container.querySelector('button') as HTMLButtonElement);
    await flush();
    expect(notice(container)?.getAttribute('aria-live')).toBe('polite');
    expect(notice(container)?.textContent).toBe(rateLimitMessage(7));
    expect(container.querySelector('[data-cms-workflow-panel]')).not.toBeNull();
  });

  it('names the wait politely in the review detail island and keeps the review', async () => {
    const { container } = mountReviewIsland(reviewDetailFixture(), [limited]);
    expect(notice(container)?.textContent).toBe('');
    await click(container.querySelector('button') as HTMLButtonElement);
    await flush();
    expect(notice(container)?.getAttribute('aria-live')).toBe('polite');
    expect(notice(container)?.textContent).toBe(rateLimitMessage(7));
    expect(container.querySelector('[data-cms-review-detail]')).not.toBeNull();
  });
});
