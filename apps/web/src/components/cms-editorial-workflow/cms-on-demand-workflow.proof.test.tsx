// @vitest-environment jsdom
import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TIME_AUTHORITY_LAZY_CONTRACT_MODULES } from '../../../client-chunk-boundaries.mjs';
import { resetCmsValidatorsForTest } from '../../lib/cms-contract-validators';
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { flushUntil } from '../cms-governed-review/governed-review-form-test-support';
import CmsEditorialReviewDetailIsland from './CmsEditorialReviewDetailIsland';
import CmsEditorialReviewSubmitForm from './CmsEditorialReviewSubmitForm';
import CmsEditorialWorkflowIsland from './CmsEditorialWorkflowIsland';
import { installLazyIntent, resetLazyIntentForTest } from './cms-lazy-intent';
import { selectViewOnIntent } from './cms-lazy-view';
import { answerImporters } from './cms-workflow-answer-machinery';
import type { Fetcher } from './cms-workflow-focus.test-support';
import {
  ENTRY_ID,
  INSTANT,
  REVIEW_ID,
  REVISION_ID,
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  reviewDetailFixture,
  workflowFixture,
} from './cms-workflow-fixtures.test-support';

/*
 * The chunks the exemption list of the bundle gate (`CMS_ON_DEMAND_CHUNKS`) calls on demand are
 * shown here, one test per stem: the real surface is mounted, nothing is requested by the mount, by
 * a scroll or by the passing of time, and the named person's event requests it. No test support
 * that preloads the modules is imported, so a request is a request. The static half (no island
 * imports zod, the contract barrel, the validators or the Time authority at load) is
 * `cms-island-static-closure.test.ts`.
 */
const asked: string[] = [];
const validatorLoads = { count: 0 };
const timeAuthority = vi.hoisted(() => ({ requested: 0 }));
// The module is cached after its first import, so the request is counted where the schedule form
// calls it: the one function it uses straight after the dynamic import.
vi.mock('@wejammin/contracts/time-authority', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@wejammin/contracts/time-authority')>();
  return {
    ...actual,
    loadPinnedTimeAuthority: (
      ...args: Parameters<typeof actual.loadPinnedTimeAuthority>
    ) => {
      timeAuthority.requested += 1;
      return actual.loadPinnedTimeAuthority(...args);
    },
  };
});

const real = { ...answerImporters };
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  timeAuthority.requested = 0;
  asked.length = 0;
  validatorLoads.count = 0;
  for (const key of ['transport', 'refusal', 'canonicalRead'] as const)
    answerImporters[key] = (() => {
      asked.push(key);
      return real[key]();
    }) as never;
  resetCmsValidatorsForTest(() => {
    validatorLoads.count += 1;
    return import('@wejammin/contracts/cms-editorial/validators');
  });
});
afterEach(() => {
  Object.assign(answerImporters, real);
  vi.unstubAllGlobals();
  resetCmsValidatorsForTest();
});

const KEY = 'idem-key-proof-0001';
const environment = (fetcher: Fetcher) => ({
  transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
  newKey: () => KEY,
  storage: () => null,
  navigate: () => undefined,
});

const mountWorkflow = (workflow = approvedWorkflowFixture()) => {
  const fetcher = vi.fn(async () => new Response('{}', { status: 500 }));
  return {
    fetcher,
    ...mountElement(
      <CmsEditorialWorkflowIsland
        init={{
          workflow,
          entryId: ENTRY_ID,
          revisionId: null,
          verifiedAt: INSTANT,
        }}
        environment={environment(fetcher)}
      />,
    ),
  };
};

const mountReviewAsOwner = () => {
  const loadOptions = vi.fn(async () => ({
    kind: 'ok' as const,
    options: [],
  }));
  const review = reviewDetailFixture({
    permittedNextActions: ['record_decision', 'assign_reviewer'],
  });
  return {
    loadOptions,
    ...mountElement(
      <CmsEditorialReviewDetailIsland
        init={{ review, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
        loadOptions={loadOptions}
        environment={environment(vi.fn(async () => new Response('{}')))}
      />,
    ),
  };
};

const mountSubmit = (answers: readonly Response[]) => {
  const queue = [...answers];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const { container } = mountElement(
    <CmsEditorialReviewSubmitForm
      entryId={ENTRY_ID}
      entryVersion="7"
      revisionId={REVISION_ID}
      preparation={workflowFixture().preparation!}
      disabledReason={null}
      refetch={refetch}
      onDone={vi.fn()}
      environment={environment(fetcher)}
    />,
  );
  return { container, fetcher, refetch };
};

const focusFirstControl = (container: HTMLElement): void => {
  const control = container.querySelector(
    '[data-cms-workflow-form] button, [data-cms-workflow-form] textarea, [data-cms-workflow-form] input',
  );
  if (control === null) throw new Error('no command form control');
  control.dispatchEvent(new Event('focusin', { bubbles: true }));
};

const created = () => {
  const testCase = COMMAND_CASES['CMS-03B-05'];
  return jsonResponse(201, testCase.resource, {
    etag: testCase.etag as string,
    location: testCase.location as string,
  });
};

describe('what a mount of the workflow surfaces requests', () => {
  it('contracts: a mount, a scroll and a minute of time request no contract schema; a form focus does', async () => {
    vi.useFakeTimers();
    const workflow = mountWorkflow();
    const review = mountReviewAsOwner();
    await vi.advanceTimersByTimeAsync(60_000);
    document.dispatchEvent(new Event('scroll'));
    vi.useRealTimers();
    await flush();
    expect(validatorLoads.count).toBe(0);
    expect(review.loadOptions).not.toHaveBeenCalled();
    focusFirstControl(workflow.container);
    await flush();
    expect(validatorLoads.count).toBe(1);
  });

  it('validators: the curated validators load with the first check, never with the mount of a review owner’s page', async () => {
    const review = mountReviewAsOwner();
    await flush();
    await flush();
    expect(validatorLoads.count).toBe(0);
    // The reviewer choices read (which verifies a page with the validators) waits for intent.
    review.container
      .querySelector('[data-cms-lazy-region="review-assignment"]')
      ?.dispatchEvent(new Event('pointerover', { bubbles: true }));
    await flush();
    await flush();
    expect(review.loadOptions).toHaveBeenCalledTimes(1);
    review.container.remove();
    // A send is the other trigger: the body is checked with them before anything is sent.
    validatorLoads.count = 0;
    const submit = mountSubmit([created()]);
    await flush();
    expect(validatorLoads.count).toBe(0);
    await click(buttonNamed(submit.container, /Submit for review/u));
    await flushUntil(() => validatorLoads.count > 0);
    expect(validatorLoads.count).toBe(1);
  });

  it('time-authority: the pinned tz snapshot module is requested when the schedule form opens, not before', async () => {
    const { container } = mountWorkflow();
    await flush();
    await flush();
    expect(timeAuthority.requested).toBe(0);
    const details = container.querySelector(
      'details',
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    await click(details!.querySelector('summary') as HTMLElement);
    // The snapshot module is large: the first import takes a while in a test runner.
    await vi.waitFor(() => expect(timeAuthority.requested).toBe(1), {
      timeout: 15_000,
    });
  });

  it('contracts-time-authority: the chunk of the snapshot data follows the same open and nothing else', async () => {
    const { container } = mountWorkflow();
    await flush();
    expect(timeAuthority.requested).toBe(0);
    document.dispatchEvent(new Event('scroll'));
    container.dispatchEvent(new Event('pointerover', { bubbles: true }));
    await flush();
    expect(timeAuthority.requested).toBe(0);
    // The data chunk is the closure only the subpath reaches (client-chunk-time-authority.test.ts),
    // so it follows the one dynamic import above and nothing else.
    expect(TIME_AUTHORITY_LAZY_CONTRACT_MODULES.join(' ')).toContain(
      'tzdb-snapshot-data.ts',
    );
  });
});

describe('what a form takes focus for, and what it takes a send for', () => {
  it('cms-workflow-command-transport: not requested by a mount; requested when a form takes focus', async () => {
    const { container } = mountWorkflow();
    await flush();
    await flush();
    expect(asked).toEqual([]);
    focusFirstControl(container);
    await flush();
    expect(asked).toContain('transport');
  });

  it('cms-workflow-refusal: not requested by a mount or a send that commits; requested by a focus or a refused send', async () => {
    const committed = mountSubmit([created()]);
    await flush();
    expect(asked).not.toContain('refusal');
    await click(buttonNamed(committed.container, /Submit for review/u));
    await flushUntil(() => committed.refetch.mock.calls.length > 0);
    // The focus of the press warms the classifier; a send that commits never classifies a refusal.
    expect(asked.filter((key) => key === 'refusal').length).toBeLessThanOrEqual(
      1,
    );
    committed.container.remove();
    asked.length = 0;
    const refused = mountSubmit([
      jsonResponse(409, apiError('CONFLICT', { reasonCode: 'x' })),
    ]);
    await flush();
    expect(asked).toEqual([]);
    await click(buttonNamed(refused.container, /Submit for review/u));
    await flushUntil(() => asked.includes('refusal'));
    expect(asked).toContain('refusal');
  });

  it('cms-workflow-canonical-read: not requested by a mount, a focus or a send; requested by the refetch a commit starts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    const { container, fetcher } = mountWorkflow(workflowFixture());
    await flush();
    focusFirstControl(container);
    await flush();
    await flush();
    expect(asked).not.toContain('canonicalRead');
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(created());
    await click(buttonNamed(container, /Submit for review/u));
    await flushUntil(() => asked.includes('canonicalRead'));
    expect(asked).toContain('canonicalRead');
  });
});

describe('the editorial review assignment forms', () => {
  it('CmsEditorialReviewAssignmentForm: loads on intent in the assignment region and on nothing else', async () => {
    const views = readFileSync(
      resolve(import.meta.dirname, 'cms-review-form-views.ts'),
      'utf8',
    ).replace(/\s+/gu, ' ');
    expect(views).toContain(
      "loadViewOnIntent( 'review-assignment', () => import('./CmsEditorialReviewAssignmentForm'), )",
    );
    for (const type of [
      'pointerover',
      'pointerdown',
      'touchstart',
      'focusin',
      'keydown',
    ]) {
      resetLazyIntentForTest();
      installLazyIntent();
      document.body.replaceChildren();
      const host = document.createElement('section');
      host.setAttribute('data-cms-lazy-region', 'review-assignment');
      host.innerHTML = '<button type="button" id="inside">x</button>';
      document.body.appendChild(host);
      const loads = vi.fn(async () => ({ default: () => null }));
      vi.useFakeTimers();
      const view = await selectViewOnIntent(false, 'review-assignment', loads);
      const { unmount } = mountElement(
        <React.Suspense fallback={null}>
          {React.createElement(view)}
        </React.Suspense>,
      );
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('scroll'));
      await vi.advanceTimersByTimeAsync(120_000);
      vi.useRealTimers();
      await flush();
      expect(loads, `${type}: nothing but intent`).not.toHaveBeenCalled();
      host
        .querySelector('#inside')!
        .dispatchEvent(new Event(type, { bubbles: true }));
      await flushUntil(() => loads.mock.calls.length > 0);
      expect(loads, type).toHaveBeenCalledTimes(1);
      unmount();
    }
  });
});
