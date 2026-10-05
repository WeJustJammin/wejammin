// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  renderDocument,
  requireForm,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import { announce } from './content-schema-registry-runtime-dom-feedback';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';

/**
 * AC248 on the REAL rendered CMS-03A-02 form (the production component's own
 * labels, ids and descriptions), not a hand-written fixture: the server's 422
 * violations, in server order, drive the summary, the field markers and focus,
 * and the typed values stay in place.
 */

const locks = createMemoryLockManager();

const mountRealForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', '/app/cms-content-modeling');
  document.body.innerHTML = renderDocument(versionPageProps()).body.innerHTML;
  return requireForm(document, 'CMS-03A-02');
};

const field = (
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLSelectElement => {
  const element = form.elements.namedItem(name);
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement)
  )
    throw new Error(`the real form has no ${name} control`);
  return element;
};

const respond422 = (...paths: readonly string[]): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'VALIDATION_FAILED',
            details: { violations: paths.map((path) => ({ path })) },
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
};

const submit = async (form: HTMLFormElement): Promise<HTMLElement> => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() =>
    expect(form.querySelector('[data-cms-validation-summary]')).not.toBeNull(),
  );
  return form.querySelector<HTMLElement>('[data-cms-validation-summary]')!;
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

describe('[P2-S09-AC-248] 422 feedback on the rendered CMS-03A-02 form', () => {
  it('[P2-S09-AC-248] lists the invalid fields in server violation order and links each to the real field id', async () => {
    const form = mountRealForm();
    respond422('/kind', '/key');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const summary = await submit(form);
    const links = [...summary.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${field(form, 'kind').id}`,
      `#${field(form, 'key').id}`,
    ]);
    expect(field(form, 'kind').id).not.toBe('');
    cleanup();
  });

  it('[P2-S09-AC-248] marks the invalid field, keeps its persistent label and help, and moves focus to the alert summary', async () => {
    const form = mountRealForm();
    const key = field(form, 'key');
    const helpBefore = key.getAttribute('aria-describedby');
    const label = form.querySelector(`label[for="${key.id}"]`)?.textContent;
    expect(label).toBeTruthy();
    key.value = 'headline';
    respond422('/key');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const summary = await submit(form);
    expect(key.getAttribute('aria-invalid')).toBe('true');
    expect(key.getAttribute('aria-describedby')?.split(' ')).toEqual([
      ...(helpBefore?.split(' ') ?? []),
      summary.id,
    ]);
    expect(form.querySelector(`label[for="${key.id}"]`)?.textContent).toBe(
      label,
    );
    expect(key.value).toBe('headline');
    expect(document.activeElement).toBe(summary);
    expect(summary.getAttribute('role')).toBe('alert');
    expect(
      document.getElementById(summary.getAttribute('aria-labelledby') ?? '')
        ?.textContent,
    ).toBe('Review the highlighted schema fields');
    cleanup();
  });

  it('[P2-S09-AC-248] sends a client-valid form to the server once and lets the server decide', async () => {
    const form = mountRealForm();
    respond422('/key');
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    await submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('[P2-S09-AC-248] announces progress in a polite atomic status and errors in an assertive alert on the rendered form', () => {
    const form = mountRealForm();
    const status = announce(form, 'Saving the field.');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    const alert = announce(form, 'The change failed.', true);
    expect(alert).toBe(status);
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });
});
