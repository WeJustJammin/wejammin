// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import ContentSchemaRegistryCreateForm from './ContentSchemaRegistryCreateForm';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import { activationPreparation } from './content-schema-registry-activation-preparation.test-support';
import {
  REQUEST_ID,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 "Locale configuration" states on the REAL server-rendered create form
 * driven by the REAL enhancement runtime: pending shows "Saving…" on the commit
 * action only, and a server 409 shows the locale-specific conflict copy with
 * Review changes, Reapply and Discard while the preserved draft is untouched.
 */

const locks = createMemoryLockManager();
const PATH = '/app/cms-content-modeling';

const mountCreateForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', PATH);
  document.body.innerHTML = renderToStaticMarkup(
    React.createElement(ContentSchemaRegistryCreateForm, {
      action: PATH,
      csrfToken: 'csrf-token-value',
      idempotencyKey: 'cms-schema-cms-03a-01-support',
    }),
  );
  const form = document.querySelector<HTMLFormElement>(
    'form[data-operation-id="CMS-03A-01"]',
  );
  if (form === null) throw new Error('create form was not rendered');
  const supported = form.querySelector<HTMLInputElement>(
    '[name="supportedLocales"]',
  );
  if (supported !== null) supported.value = JSON.stringify(['en-US']);
  return form;
};

const submit = (form: HTMLFormElement): void => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

const commitButton = (form: HTMLFormElement): HTMLButtonElement => {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button === null) throw new Error('commit button missing');
  return button;
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

describe('locale configuration pending state', () => {
  it('[P2-S09-AC-1229] shows Saving… on the commit action, marks the locale fields aria-disabled and ignores a duplicate submit', async () => {
    const form = mountCreateForm();
    const idleLabel = commitButton(form).textContent;
    let release: (response: Response) => void = () => undefined;
    const fetchStub = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    submit(form);
    await vi.waitFor(() => expect(commitButton(form).disabled).toBe(true));
    expect(commitButton(form).textContent).toBe('Saving…');
    expect(
      form.querySelector('[data-locale-fields]')?.getAttribute('aria-disabled'),
    ).toBe('true');
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
    submit(form);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchStub).toHaveBeenCalledTimes(1);
    release(
      new Response(JSON.stringify({ code: 'RATE_LIMITED', details: {} }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await vi.waitFor(() => expect(commitButton(form).disabled).toBe(true));
    cleanup();
    expect(idleLabel).not.toBe('Saving…');
  });

  it('[P2-S09-AC-1229] restores the idle label and enables the fields once the command settles', async () => {
    const form = mountCreateForm();
    const idleLabel = commitButton(form).textContent;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'VALIDATION_FAILED',
              details: { violations: [{ path: '/typeKey' }] },
            }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    submit(form);
    await vi.waitFor(() =>
      expect(
        form.querySelector('[data-cms-validation-summary]'),
      ).not.toBeNull(),
    );
    expect(commitButton(form).disabled).toBe(false);
    expect(commitButton(form).textContent).toBe(idleLabel);
    expect(
      form.querySelector('[data-locale-fields]')?.getAttribute('aria-disabled'),
    ).not.toBe('true');
    cleanup();
  });
});

describe('locale configuration server 409', () => {
  it('[P2-S09-AC-1231] shows the locale conflict copy with Review changes, Reapply and Discard and keeps the draft', async () => {
    const form = mountCreateForm();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'CONFLICT',
              details: { expectedVersion: '4', currentVersion: '5' },
              message: 'stale',
              requestId: REQUEST_ID,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    submit(form);
    await vi.waitFor(() =>
      expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull(),
    );
    const conflict = form.querySelector<HTMLElement>(
      '[data-cms-sync-conflict]',
    )!;
    expect(conflict.textContent).toContain(
      'This version changed while you were editing. Review the current version, then reapply your languages.',
    );
    const labels = [...conflict.querySelectorAll('button')].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual(['Review changes', 'Reapply', 'Discard']);
    expect(
      form.querySelector<HTMLInputElement>('[name="supportedLocales"]')?.value,
    ).toBe(JSON.stringify(['en-US']));
    cleanup();
  });
});

describe('locale configuration forbidden or hidden', () => {
  it.each([
    [
      'a hidden variant',
      { variant: 'forbiddenHidden', access: 'not-rendered' },
    ],
    [
      'a disabled prerequisite',
      { variant: 'disabledPrerequisite', access: 'disabled' },
    ],
    [
      'a read-only projection',
      { variant: 'entitledRead', access: 'read-only' },
    ],
  ] as const)(
    '[P2-S09-AC-1233] renders no locale control for %s',
    (_label, override) => {
      const doc = renderDocument(
        versionPageProps({
          ...override,
          initialDetail: successDetail(
            draftDetail(
              activationPreparation({
                permittedNextActions: ['create_successor'],
              }),
            ),
          ),
        }),
      );
      expect(doc.querySelector('[data-locale-fields]')).toBeNull();
      expect(
        doc.querySelector('form[data-operation-id="CMS-03A-09"]'),
      ).toBeNull();
      expect(
        doc.querySelector('form[data-operation-id="CMS-03A-01"]'),
      ).toBeNull();
    },
  );

  it('[P2-S09-AC-1233] renders the successor locale controls for the designer the form is gated to', () => {
    const doc = renderDocument(
      versionPageProps({
        initialDetail: successDetail(
          draftDetail(
            activationPreparation({
              permittedNextActions: ['create_successor'],
            }),
          ),
        ),
      }),
    );
    const form = doc.querySelector('form[data-operation-id="CMS-03A-09"]');
    expect(form).not.toBeNull();
    expect(form?.querySelector('[data-locale-choice]')).not.toBeNull();
  });
});

describe('locale configuration is fixed at insert and changed only by a successor', () => {
  it('[P2-S09-AC-1239] offers locale controls only on the create and successor forms, never on another draft command or the read-only detail', () => {
    const doc = renderDocument(
      versionPageProps({
        initialDetail: successDetail(
          draftDetail(
            activationPreparation({
              permittedNextActions: [
                'create_successor',
                'start_dry_run',
                'submit_review',
              ],
            }),
          ),
        ),
      }),
    );
    const withLocale = [
      ...doc.querySelectorAll<HTMLFormElement>('form[data-operation-id]'),
    ].filter(
      (form) => form.querySelector('[name="supportedLocales"]') !== null,
    );
    expect(withLocale.map((form) => form.dataset.operationId)).toEqual([
      'CMS-03A-09',
    ]);
    const otherDraftCommands = ['CMS-03A-02', 'CMS-03A-03', 'CMS-03A-10'].map(
      (id) => doc.querySelector(`form[data-operation-id="${id}"]`),
    );
    for (const form of otherDraftCommands)
      expect(
        form?.querySelector(
          '[name^="supportedLocales"], [name^="fallbackChains"]',
        ) ?? null,
      ).toBeNull();
  });

  it('[P2-S09-AC-1239] mounts the create form with locale controls so a draft sets its configuration at insert', () => {
    const form = mountCreateForm();
    expect(form.querySelector('[data-locale-fields]')).not.toBeNull();
    expect(form.dataset.operationId).toBe('CMS-03A-01');
  });
});
