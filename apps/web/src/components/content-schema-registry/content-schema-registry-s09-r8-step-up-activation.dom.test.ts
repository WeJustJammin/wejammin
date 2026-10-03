// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import ContentSchemaRegistryActivationForm from './ContentSchemaRegistryActivationForm';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import { REQUEST_ID } from './content-schema-review-dec108.test-support';

/**
 * AC1031 for CMS-03A-04 (activation by the activator): the real activation form
 * takes the step-up detour, the draft survives with its ORIGINAL Idempotency-Key
 * and no transport secret, and the restored form waits for explicit confirmation.
 */

const PATH = '/app/cms-content-modeling/type-id/versions/version-id';
const locks = createMemoryLockManager();
const ORIGINAL_KEY = 'original-activation-key-0001';

const mountActivation = (key: string): HTMLFormElement => {
  window.history.replaceState({}, '', PATH);
  document.body.innerHTML = `<main><section data-workbench="content-schema-registry" data-canonical-refetch-url="${PATH}">${renderToStaticMarkup(
    React.createElement(ContentSchemaRegistryActivationForm, {
      action: PATH,
      contentTypeId: 'type-id',
      versionId: 'version-id',
      csrfToken: 'csrf-token',
      idempotencyKey: key,
      ifMatch: '"4"',
      expectedVersion: '4',
      dryRunId: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
      approvalIds: ['018f0c45-73fe-7dc2-9c09-68f7ecf132dd'],
    }),
  )}</section></main>`;
  return document.querySelector('form') as HTMLFormElement;
};

const stepUpBody = JSON.stringify({
  code: 'STEP_UP_REQUIRED',
  details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
  message: 'Recent verification is required.',
  requestId: REQUEST_ID,
});

const sessionEntries = (): string => {
  const entries: [string, string | null][] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key !== null) entries.push([key, window.sessionStorage.getItem(key)]);
  }
  return JSON.stringify(entries);
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

const detour = async (form: HTMLFormElement): Promise<void> => {
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
  const navigate = vi.fn();
  const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
  cleanup();
};

describe('[P2-S09-AC-1031] CMS-03A-04 step-up draft', () => {
  it('[P2-S09-AC-1031] persists the original Idempotency-Key and no CSRF token', async () => {
    const form = mountActivation(ORIGINAL_KEY);
    await detour(form);
    const raw = sessionEntries();
    expect(raw).toContain(ORIGINAL_KEY);
    expect(raw).not.toMatch(/csrf/iu);
  });

  it('[P2-S09-AC-1031] restores the original key into a freshly rendered form and does not auto-submit', async () => {
    await detour(mountActivation(ORIGINAL_KEY));
    const fresh = mountActivation('fresh-activation-key-9999');
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    expect(
      fresh.querySelector<HTMLInputElement>('[name="idempotency-key"]')?.value,
    ).toBe(ORIGINAL_KEY);
    expect(fresh.textContent).toContain(
      'Verification complete. Review and confirm to continue.',
    );
    expect(fetchStub).not.toHaveBeenCalled();
    cleanup();
  });
});
