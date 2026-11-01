// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  click,
  disableReactAct,
  enableReactAct,
  buttonNamed,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import {
  HASH_A,
  REVIEW_ID,
  SUBJECT_ID,
  governedDecisionFixture,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  advance,
  mountDetail,
  provokeRefetch,
} from './CmsGovernedReviewDetailIsland.states.test-support';
import { readCanonicalGovernedReview } from './governed-review-canonical-read';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import { heldWire } from './governed-command-states.test-support';
import {
  flushUntil,
  governedEnvironment,
  headersOf,
  pathOf,
} from './governed-review-form-test-support';

/*
 * [P2-S12-AC-271] the closing words of the Slice 12 state table (FE03 1042): "each [state] is server-authoritative and
 * `no-store`, and none is optimistic", for the governed review commands (CMS-03C-06 to -09, here through the submit form
 * on the definition page's bounded panel, which shares the one command transport). The command is a `no-store`,
 * same-origin POST; while it is in flight the lifecycle stays what the last read served and nothing is called submitted;
 * the subject is read again only after the server answered.
 */
beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const subject: GovernedPanelSubject = {
  kind: 'template_version',
  id: SUBJECT_ID,
  hash: HASH_A,
  key: 'profile-header',
  version: 2,
  state: 'draft',
};

describe('the governed submit command: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] commandState closing words: Submit for review is a no-store, same-origin POST and the panel keeps the draft lifecycle until the server answers', async () => {
    const wire = heldWire();
    const readSubject = vi.fn(
      async () => ({ ...subject, state: 'review' }) as GovernedPanelSubject,
    );
    const { container } = mountElement(
      <CmsGovernedReviewPanel
        subject={subject}
        readSubject={readSubject}
        environment={governedEnvironment(wire.fetcher)}
      />,
    );
    await click(buttonNamed(container, 'Submit for review'));
    await flush();
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
    const init = (
      wire.fetcher.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect(init).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'manual',
    });
    expect(pathOf(wire.fetcher)).toMatch(/^\/api\/v1\/cms\//u);
    expect(headersOf(wire.fetcher).get('idempotency-key')).not.toBeNull();
    expect(container.textContent).toContain('Lifecycle: Draft');
    expect(container.textContent).not.toContain('Submitted for review');
    expect(container.textContent).not.toContain('Lifecycle: In review');
    expect(readSubject).not.toHaveBeenCalled();
    wire.settle(jsonResponse(201, governedReviewFixture(), { etag: '"1"' }));
    await flushUntil(() => readSubject.mock.calls.length > 0);
    expect(container.textContent).toContain('Lifecycle: In review');
  });
});

describe('the governed review read: no-store and never optimistic', () => {
  it('[P2-S12-AC-271] governedReviewState closing words: the canonical review read is a no-store, same-origin GET and the shown review stays what it was until the read answers', async () => {
    vi.useFakeTimers();
    try {
      let answer: (response: Response) => void = () => undefined;
      const fetcher = vi.fn(
        (...args: [RequestInfo | URL, RequestInit?]) =>
          new Promise<Response>((resolve) => {
            void args;
            answer = resolve;
          }),
      );
      const { container } = mountDetail(governedDetailFixture(), () =>
        readCanonicalGovernedReview(REVIEW_ID, fetcher as typeof fetch),
      );
      await advance(0);
      await provokeRefetch(container);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain('State: Open');
      expect(container.textContent).not.toContain('State: Approved');
      const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
      expect(init).toMatchObject({
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      answer(
        jsonResponse(
          200,
          governedDetailFixture({
            version: '3',
            state: 'approved',
            decidedAt: '2026-10-08T13:00:00Z',
            recordedDecisionCount: 1,
            distinctApprovalCount: 1,
            decisions: [
              governedDecisionFixture({ mine: true, reason: 'Fine.' }),
            ],
            permittedNextActions: [],
            subjectState: 'approved',
          }),
          { etag: '"3"' },
        ),
      );
      await advance(0);
      expect(container.textContent).toContain('State: Approved');
    } finally {
      vi.useRealTimers();
    }
  });
});
