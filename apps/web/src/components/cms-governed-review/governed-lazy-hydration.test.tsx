// @vitest-environment jsdom
import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  governedDetailFixture,
  LATER,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  HYDRATED_ATTRIBUTE,
  installLazyIntent,
  resetLazyIntentForTest,
  whenRegionIntent,
} from '../cms-editorial-workflow/cms-lazy-intent';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import CmsGovernedDecisionForm from './CmsGovernedDecisionForm';
import CmsGovernedSubmitForm from './CmsGovernedSubmitForm';
import {
  bodyOf,
  governedEnvironment,
  headersOf,
  pathOf,
  queuedFetcher,
} from './governed-review-form-test-support';

/*
 * P2-S11-AC-106 / FE03 load on entry: the REAL governed forms, server-rendered, then hydrated
 * behind the same lazy boundary the browser build puts them in. What the person did before the
 * form hydrated (typed, chose, pressed submit) must arrive in exactly one request, with the key
 * and version the form would have sent had it been ready.
 */
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
  await preloadWorkflowAnswerMachinery();
});
afterAll(disableReactAct);

const tick = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('governed forms hydrated on intent', () => {
  const roots: Root[] = [];
  beforeEach(() => {
    // These tests drive hydration outside act on purpose: it is the browser's timing.
    disableReactAct();
    installLazyIntent();
  });
  afterEach(() => {
    for (const root of roots.splice(0)) root.unmount();
    resetLazyIntentForTest();
    document.body.replaceChildren();
    enableReactAct();
  });

  const hydrateGated = <P extends object>(
    region: string,
    Form: React.ComponentType<P>,
    props: P,
  ): HTMLElement => {
    const Lazy = React.lazy(async () => {
      await whenRegionIntent(region);
      return { default: Form };
    });
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <React.Suspense fallback={null}>
        {React.createElement(Form as React.ComponentType<object>, props)}
      </React.Suspense>,
    );
    document.body.appendChild(host);
    roots.push(
      hydrateRoot(
        host,
        <React.Suspense fallback={null}>
          {React.createElement(
            Lazy as unknown as React.ComponentType<object>,
            props,
          )}
        </React.Suspense>,
      ),
    );
    return host;
  };

  it('delivers the decision a reviewer chose and typed before the form hydrated, in one request', async () => {
    const fetcher = queuedFetcher([
      jsonResponse(
        200,
        governedReviewFixture({
          version: '3',
          state: 'approved',
          recordedDecisionCount: 1,
          decidedAt: LATER,
        }),
        { etag: '"3"' },
      ),
    ]);
    const host = hydrateGated('governed-decision', CmsGovernedDecisionForm, {
      review: governedDetailFixture({ version: '2' }),
      permitted: true,
      disabledReason: null,
      refetch: async () => true,
      onDone: () => undefined,
      environment: governedEnvironment(fetcher, new MemoryStorage()),
    });
    await tick(20);
    const region = host.querySelector(
      '[data-cms-lazy-region="governed-decision"]',
    );
    expect(region).not.toBeNull();
    expect(region?.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(false);
    expect(host.querySelector('[disabled], [readonly]')).toBeNull();

    const approve = host.querySelector<HTMLInputElement>(
      'input[type="radio"][value="approve"]',
    )!;
    approve.checked = true;
    approve.dispatchEvent(new Event('change', { bubbles: true }));
    const reason = host.querySelector<HTMLTextAreaElement>(
      '#governed-decision-reason',
    )!;
    reason.value = 'Looks good to me, approving.';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    for (let turn = 0; turn < 60 && fetcher.mock.calls.length === 0; turn += 1)
      await tick(10);
    await tick(50);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(pathOf(fetcher)).toMatch(/\/decision$/u);
    expect(headersOf(fetcher).get('if-match')).toBe('"2"');
    expect(bodyOf(fetcher)).toMatchObject({
      decision: 'approve',
      reason: 'Looks good to me, approving.',
      expectedVersion: '2',
    });
    expect(region?.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(true);
  });

  it('sends exactly one request for three submits pressed before the fieldless submit form hydrated', async () => {
    const fetcher = queuedFetcher([
      jsonResponse(403, { code: 'FORBIDDEN', message: 'No.', requestId: 'r' }),
    ]);
    const host = hydrateGated('governed-submit', CmsGovernedSubmitForm, {
      subject: {
        kind: 'template_version',
        id: '123e4567-e89b-42d3-a456-426614174001',
        hash: 'a'.repeat(64),
        version: '4',
        state: 'draft',
      } as never,
      showForm: true,
      disabledReason: null,
      refetch: async () => true,
      onCommitted: () => undefined,
      environment: governedEnvironment(fetcher, new MemoryStorage()),
    });
    await tick(20);
    const form = host.querySelector('form')!;
    for (let press = 0; press < 3; press += 1)
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    for (let turn = 0; turn < 60 && fetcher.mock.calls.length === 0; turn += 1)
      await tick(10);
    await tick(80);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(headersOf(fetcher).get('idempotency-key')).not.toBeNull();
    expect(headersOf(fetcher).has('if-match')).toBe(false);
    expect(bodyOf(fetcher)).toMatchObject({
      subjectKind: 'template_version',
      subjectId: '123e4567-e89b-42d3-a456-426614174001',
    });
  });
});
