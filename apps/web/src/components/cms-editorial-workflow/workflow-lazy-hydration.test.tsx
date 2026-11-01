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
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import {
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialDecisionForm from './CmsEditorialDecisionForm';
import { installLazyIntent, resetLazyIntentForTest } from './cms-lazy-intent';
import { preloadWorkflowAnswerMachinery } from './cms-workflow-answer-machinery.test-support';
import {
  jsonResponse,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';

/*
 * A form that loads with the page (not on intent) still hydrates after the server markup is
 * visible, and a person can check a radio, type and press the commit control in between. The
 * press must be kept, not lost: the server-rendered control is native and the click is the intent
 * (S11-RR-06: "Record approval" never appeared because the radio checked before hydration never
 * reached the form's state).
 */
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
  await preloadWorkflowAnswerMachinery();
});
afterAll(disableReactAct);

const tick = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('a form that loads with the page, pressed before it hydrated', () => {
  const roots: Root[] = [];
  beforeEach(() => {
    disableReactAct();
    installLazyIntent();
  });
  afterEach(() => {
    for (const root of roots.splice(0)) root.unmount();
    resetLazyIntentForTest();
    document.body.replaceChildren();
    enableReactAct();
  });

  it('keeps the chosen decision and reason and sends them once when the form arrives', async () => {
    const testCase = COMMAND_CASES['CMS-03B-06'];
    const fetcher = vi.fn(async () =>
      jsonResponse(200, testCase.resource, { etag: testCase.etag as string }),
    );
    let arrive: () => void = () => undefined;
    const arrival = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    const Late = React.lazy(async () => {
      await arrival;
      return { default: CmsEditorialDecisionForm };
    });
    const props = {
      review: reviewDetailFixture({
        version: '2',
        permittedNextActions: ['record_decision'],
      }),
      disabledReason: null,
      refetch: async () => true,
      onDone: () => undefined,
      environment: {
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => 'idem-key-hydration-0001',
        storage: () => null,
        navigate: () => undefined,
      },
    };
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <React.Suspense fallback={null}>
        <CmsEditorialDecisionForm {...props} />
      </React.Suspense>,
    );
    document.body.appendChild(host);
    roots.push(
      hydrateRoot(
        host,
        <React.Suspense fallback={null}>
          <Late {...props} />
        </React.Suspense>,
      ),
    );
    await tick(20);

    const approve = host.querySelector<HTMLInputElement>(
      'input[type="radio"][value="approve"]',
    )!;
    approve.checked = true;
    approve.dispatchEvent(new Event('change', { bubbles: true }));
    const reason = host.querySelector<HTMLTextAreaElement>('textarea')!;
    reason.value = 'Reads well and is ready to publish.';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(fetcher).not.toHaveBeenCalled();

    arrive();
    for (let turn = 0; turn < 80 && fetcher.mock.calls.length === 0; turn += 1)
      await tick(10);
    await tick(60);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(
      String(
        (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as Record<string, unknown>;
    expect(sent).toMatchObject({
      decision: 'approve',
      reason: 'Reads well and is ready to publish.',
    });
  });

  it('shows the label of the chosen decision once it hydrated', async () => {
    let arrive: () => void = () => undefined;
    const arrival = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    const Late = React.lazy(async () => {
      await arrival;
      return { default: CmsEditorialDecisionForm };
    });
    const props = {
      review: reviewDetailFixture({
        version: '2',
        permittedNextActions: ['record_decision'],
      }),
      disabledReason: null,
      refetch: async () => true,
      onDone: () => undefined,
    };
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <React.Suspense fallback={null}>
        <CmsEditorialDecisionForm {...props} />
      </React.Suspense>,
    );
    document.body.appendChild(host);
    roots.push(
      hydrateRoot(
        host,
        <React.Suspense fallback={null}>
          <Late {...props} />
        </React.Suspense>,
      ),
    );
    await tick(20);
    const approve = host.querySelector<HTMLInputElement>(
      'input[type="radio"][value="approve"]',
    )!;
    approve.checked = true;
    approve.dispatchEvent(new Event('change', { bubbles: true }));
    arrive();
    await tick(200);
    expect(host.querySelector('button[type="submit"]')?.textContent).toBe(
      'Record approval',
    );
  });
});
