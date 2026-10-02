// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import ContentSchemaRegistryActivationForm from './ContentSchemaRegistryActivationForm';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  REQUEST_ID,
  REVIEW_ID,
} from './content-schema-review-dec108.test-support';

/**
 * BE03a CMS-03A-04/-12/-14: a missing or stale MFA is a 401 STEP_UP_REQUIRED
 * whose recovery is `step_up`. The native-form enhancement must route the
 * user to the step-up page with a safe relative returnTo, never to the
 * password sign-in page that a plain 401 uses.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
const locks = createMemoryLockManager();

const formMarkup = (operationId: string, path: string, query = ''): void => {
  window.history.replaceState({}, '', `${path}${query}`);
  document.body.innerHTML = `
    <main>
      <section data-workbench="content-schema-registry" data-canonical-refetch-url="${path}">
        <form id="dec108-form" data-cms-command-form="true" data-operation-id="${operationId}" action="${path}" method="post">
          <input type="hidden" name="idempotency-key" value="stable-key-123" />
          <input type="hidden" name="if-match" value="&quot;3&quot;" />
          <input name="decision" value="approve" />
          <fieldset><button type="submit">Save</button></fieldset>
        </form>
      </section>
    </main>`;
};

const stepUpBody = JSON.stringify({
  code: 'STEP_UP_REQUIRED',
  details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
  message: 'Recent verification is required.',
  requestId: REQUEST_ID,
});

const submitUntil = async (done: () => boolean): Promise<void> => {
  document
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(done()).toBe(true));
};

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  document.body.replaceChildren();
});

describe('[DEC-108] 401 STEP_UP_REQUIRED routing', () => {
  it.each([
    ['CMS-03A-12', REVIEW_PATH, ''],
    ['CMS-03A-14', REVIEW_PATH, ''],
    [
      'CMS-03A-04',
      '/app/cms-content-modeling/type-id/versions/version-id',
      '?limit=25',
    ],
  ])(
    '%s routes to /step-up with the encoded relative returnTo',
    async (op, path, query) => {
      formMarkup(op, path, query);
      const navigate = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(stepUpBody, {
              status: 401,
              headers: { 'content-type': 'application/json' },
            }),
        ),
      );
      const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
        navigate,
      });
      await submitUntil(() => navigate.mock.calls.length > 0);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(
        `/step-up?returnTo=${encodeURIComponent(`${path}${query}`)}`,
      );
      cleanup();
    },
  );

  it('routes the real activation form (no token field) to /step-up on 401 STEP_UP_REQUIRED', async () => {
    const path = '/app/cms-content-modeling/type-id/versions/version-id';
    window.history.replaceState({}, '', path);
    document.body.innerHTML = `<main><section data-workbench="content-schema-registry" data-canonical-refetch-url="${path}">${renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryActivationForm, {
        action: path,
        contentTypeId: 'type-id',
        versionId: 'version-id',
        csrfToken: 'csrf-token',
        idempotencyKey: 'stable-key-123',
        ifMatch: '"4"',
        expectedVersion: '4',
        dryRunId: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
        approvalIds: ['018f0c45-73fe-7dc2-9c09-68f7ecf132dd'],
      }),
    )}</section></main>`;
    expect(document.querySelector('[name="stepUpToken"]')).toBeNull();
    const navigate = vi.fn();
    const fetchMock = vi.fn(
      async () =>
        new Response(stepUpBody, {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    await submitUntil(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalledWith(
      `/step-up?returnTo=${encodeURIComponent(path)}`,
    );
    cleanup();
  });

  it('keeps a plain 401 on the sign-in page, not the step-up page', async () => {
    formMarkup('CMS-03A-12', REVIEW_PATH);
    const navigate = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'UNAUTHENTICATED',
              details: { recoveryAction: 'reauthenticate' },
              message: 'Sign in.',
              requestId: REQUEST_ID,
            }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    await submitUntil(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalledWith(
      `/auth/sign-in?returnTo=${encodeURIComponent(REVIEW_PATH)}`,
    );
    cleanup();
  });

  it('announces step-up honestly and never echoes the submitted fields or key', async () => {
    formMarkup('CMS-03A-12', REVIEW_PATH);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(stepUpBody, {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    await submitUntil(
      () => document.querySelector('[data-cms-command-status]') !== null,
    );
    const status = document.querySelector('[data-cms-command-status]');
    expect(status?.textContent?.toLowerCase()).toMatch(
      /verif|step-up|confirm/u,
    );
    expect(status?.textContent?.toLowerCase()).not.toContain('sign in again');
    expect(document.body.textContent).not.toContain('stable-key-123');
    cleanup();
  });
});

describe('[DEC-108] CMS-03A-12 conflict recovery', () => {
  it('preserves input and names the server and local version for a 409', async () => {
    formMarkup('CMS-03A-12', REVIEW_PATH);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details: { expectedVersion: '3', currentVersion: '4' },
              message: 'Stale.',
              requestId: REQUEST_ID,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    await submitUntil(
      () => document.querySelector('[data-cms-sync-conflict]') !== null,
    );
    expect(document.body.textContent).toContain('Server version: 4');
    expect(document.body.textContent).toContain('Local version: 3');
    expect(
      document.querySelector<HTMLInputElement>('[name="decision"]')?.value,
    ).toBe('approve');
    cleanup();
  });
});
