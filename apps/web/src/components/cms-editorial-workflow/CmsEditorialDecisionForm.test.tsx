// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  COMMAND_CASES,
  CSRF,
} from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialDecisionForm from './CmsEditorialDecisionForm';
import {
  REVIEW_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const KEY = 'idem-key-decide-0001';

const review = (version = '2') => reviewDetailFixture({ version });

const decided = () => {
  const testCase = COMMAND_CASES['CMS-03B-06'];
  return jsonResponse(200, testCase.resource, {
    etag: testCase.etag as string,
  });
};

const mount = (
  responses: readonly Response[],
  extra: Partial<React.ComponentProps<typeof CmsEditorialDecisionForm>> = {},
  storage = new MemoryStorage(),
  navigate = vi.fn(),
) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const mounted = mountElement(
    <CmsEditorialDecisionForm
      review={review()}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => storage,
        navigate,
      }}
      {...extra}
    />,
  );
  return { ...mounted, fetcher, refetch, onDone, storage, navigate };
};

const choose = async (container: HTMLElement, value: 'approve' | 'reject') => {
  const radio = container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${value}"]`,
  ) as HTMLInputElement;
  await click(radio);
};

const reasonField = (container: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(container, 'Reason');

describe('CmsEditorialDecisionForm (CMS-03B-06)', () => {
  it('offers a radio pair, a persistent reason label with a counter, and names the consequence', async () => {
    const { container } = mount([]);
    expect(container.querySelector('fieldset legend')?.textContent).toBe(
      'Decision',
    );
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(reasonField(container).id).toBe('decision-reason');
    expect(
      container.querySelector('#decision-reason-counter')?.textContent,
    ).toBe('0 of 2000 characters');
    expect(buttonNamed(container, /Record/u).textContent).toBe(
      'Record decision',
    );
    await choose(container, 'reject');
    expect(buttonNamed(container, /Record/u).textContent).toBe(
      'Record rejection. This ends the review.',
    );
    await choose(container, 'approve');
    expect(buttonNamed(container, /Record/u).textContent).toBe(
      'Record approval',
    );
  });

  it('counts Unicode characters in the reason as the person types', async () => {
    const { container } = mount([]);
    await typeInto(reasonField(container), '😀😀ok');
    expect(
      container.querySelector('#decision-reason-counter')?.textContent,
    ).toBe('4 of 2000 characters');
  });

  it('refuses a missing choice and an unsafe reason inline, sending nothing, with focus on the summary', async () => {
    const { container, fetcher } = mount([]);
    await click(buttonNamed(container, /Record/u));
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Choose approve or reject.');
    expect(alert.textContent).toContain('Enter a reason.');
    expect(document.activeElement).toBe(alert);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'a <b> c');
    await click(buttonNamed(container, /Record/u));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Remove the characters < > { and }.');
    expect(
      container.querySelector('#decision-reason')?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the strict body at the review version, then refetches the review and focuses the decisions', async () => {
    const { container, fetcher, refetch, onDone } = mount([decided()]);
    await choose(container, 'approve');
    await typeInto(
      reasonField(container),
      'The candidate matches its frozen dependencies.',
    );
    await click(buttonNamed(container, /Record/u));
    await flush();
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(`/api/v1/cms/reviews/${REVIEW_ID}/decision`);
    expect(JSON.parse(init.body as string)).toEqual({
      reviewId: REVIEW_ID,
      decision: 'approve',
      reason: 'The candidate matches its frozen dependencies.',
      expectedVersion: '2',
    });
    const headers = new Headers(init.headers);
    expect(headers.get('if-match')).toBe('"2"');
    expect(headers.get('idempotency-key')).toBe(KEY);
    expect(Object.keys(JSON.parse(init.body as string))).not.toContain(
      'capability',
    );
    expect(Object.keys(JSON.parse(init.body as string))).not.toContain(
      'stepUpAt',
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('review-decisions-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('Decision recorded.');
  });

  it('routes a step-up shortfall to the verification page with the draft stored and nothing replayed', async () => {
    const storage = new MemoryStorage();
    const navigate = vi.fn();
    const { container, fetcher } = mount(
      [
        jsonResponse(
          401,
          apiError('STEP_UP_REQUIRED', {
            recoveryAction: 'step_up',
            allowedMethods: ['totp'],
          }),
        ),
      ],
      {},
      storage,
      navigate,
    );
    await choose(container, 'reject');
    await typeInto(reasonField(container), 'Needs a second look.');
    await click(buttonNamed(container, /Record/u));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/step-up\?returnTo=/u);
    const stored = JSON.parse(
      storage.getItem(`wj-step-up-draft:cms:/:CMS-03B-06`) as string,
    ) as {
      values: Record<string, string>;
      idempotencyKey: string;
      expectedVersion: string;
    };
    expect(stored.values).toEqual({
      decision: 'reject',
      reason: 'Needs a second look.',
    });
    expect(stored.idempotencyKey).toBe(KEY);
    expect(stored.expectedVersion).toBe('2');
    expect(container.querySelector('a[href*="sign-in"]')).toBeNull();
    expect(
      container.querySelector('[data-cms-editorial-capability-gate]'),
    ).toBeNull();
  });

  it('restores the draft after step-up, waits for confirmation and resubmits under the original key once', async () => {
    const storage = new MemoryStorage();
    const first = mount(
      [
        jsonResponse(
          401,
          apiError('STEP_UP_REQUIRED', {
            recoveryAction: 'step_up',
            allowedMethods: ['totp'],
          }),
        ),
      ],
      {},
      storage,
    );
    await choose(first.container, 'reject');
    await typeInto(reasonField(first.container), 'Needs a second look.');
    await click(buttonNamed(first.container, /Record/u));
    await vi.waitFor(() =>
      expect(
        storage.getItem('wj-step-up-draft:cms:/:CMS-03B-06'),
      ).not.toBeNull(),
    );
    first.unmount();

    const returned = mount([decided()], {}, storage);
    await flush();
    expect(returned.fetcher).not.toHaveBeenCalled();
    expect(reasonField(returned.container).value).toBe('Needs a second look.');
    expect(
      returned.container.querySelector<HTMLInputElement>(
        'input[value="reject"]',
      )?.checked,
    ).toBe(true);
    expect(
      returned.container.querySelector('[data-cms-workflow-status]')
        ?.textContent,
    ).toBe('Your entries were restored. Review them, then confirm.');
    await click(buttonNamed(returned.container, /Record/u));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    const init = (
      returned.fetcher.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect(new Headers(init.headers).get('idempotency-key')).toBe(KEY);
  });

  it('opens a sync conflict when the review version changed while verifying', async () => {
    const storage = new MemoryStorage();
    const first = mount(
      [
        jsonResponse(
          401,
          apiError('STEP_UP_REQUIRED', {
            recoveryAction: 'step_up',
            allowedMethods: ['totp'],
          }),
        ),
      ],
      {},
      storage,
    );
    await choose(first.container, 'approve');
    await typeInto(reasonField(first.container), 'Fine.');
    await click(buttonNamed(first.container, /Record/u));
    await vi.waitFor(() =>
      expect(
        storage.getItem('wj-step-up-draft:cms:/:CMS-03B-06'),
      ).not.toBeNull(),
    );
    first.unmount();

    const returned = mount([decided()], { review: review('9') }, storage);
    await flush();
    expect(
      returned.container.querySelector('[data-cms-editorial-sync-conflict]')
        ?.textContent,
    ).toContain('version 2');
    await click(buttonNamed(returned.container, /Record/u));
    expect(returned.fetcher).not.toHaveBeenCalled();
    await click(
      buttonNamed(
        returned.container,
        'Review the current version and continue',
      ),
    );
    await click(buttonNamed(returned.container, /Record/u));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (returned.fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    ) as { expectedVersion: string };
    expect(body.expectedVersion).toBe('9');
  });

  it('shows the degraded state when no verification method is available', async () => {
    const { container } = mount([
      jsonResponse(
        401,
        apiError('STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['sms'],
        }),
      ),
    ]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(buttonNamed(container, /Record/u));
    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'No verification method is available.',
      ),
    );
  });

  it('renders the separation-of-duties gate, never a step-up route', async () => {
    const { container } = mount([
      jsonResponse(
        403,
        apiError('FORBIDDEN', { reasonCode: 'separation_of_duties' }),
      ),
    ]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(buttonNamed(container, /Record/u));
    await flush();
    const gate = container.querySelector(
      '[data-cms-editorial-capability-gate]',
    );
    expect(gate?.textContent).toContain(
      'You cannot record a decision on your own work',
    );
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it('refetches the review and states why for a closed or duplicate decision', async () => {
    const { container, refetch } = mount([
      jsonResponse(
        409,
        apiError('CONFLICT', { reasonCode: 'review_not_open' }),
      ),
    ]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(buttonNamed(container, /Record/u));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This review is no longer open.',
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the entered text and offers a reconciled retry after a lost answer', async () => {
    const { container, fetcher, refetch } = mount([
      jsonResponse(504, apiError('GATEWAY_TIMEOUT')),
      decided(),
    ]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Keep me.');
    await click(buttonNamed(container, /Record/u));
    await flush();
    expect(reasonField(container).value).toBe('Keep me.');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('The current state is loaded. You can retry the same request.');
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const keys = fetcher.mock.calls.map((call) =>
      new Headers((call as unknown as [string, RequestInit])[1].headers).get(
        'idempotency-key',
      ),
    );
    expect(keys).toEqual([KEY, KEY]);
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([decided()], {
      disabledReason: 'Reload the page.',
    });
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(buttonNamed(container, /Record/u));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
