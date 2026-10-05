// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { announce } from './content-schema-registry-runtime-dom-feedback';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';

/**
 * R8 proofs for AC248 (form validation feedback) through the real enhancement
 * runtime: the server's 422 violations, in server order, drive the summary, the
 * field markers and the focus; the client never pre-empts the server.
 */

const locks = createMemoryLockManager();

const formMarkup = (): void => {
  window.history.replaceState({}, '', '/app/cms-content-modeling');
  document.body.innerHTML = `
    <main>
      <section data-workbench="content-schema-registry" data-canonical-refetch-url="/app/cms-content-modeling">
        <form id="schema-form" data-cms-command-form="true" data-operation-id="CMS-03A-02" action="/app/cms-content-modeling/record" method="post">
          <input type="hidden" name="idempotency-key" value="stable-key-123" />
          <label for="field-key">Key</label>
          <input id="field-key" name="key" value="title" aria-describedby="key-help" />
          <p id="key-help">Lowercase key.</p>
          <label for="field-kind">Kind</label>
          <input id="field-kind" name="kind" value="text" />
          <fieldset><button type="submit">Save</button></fieldset>
        </form>
      </section>
    </main>`;
};

const respond422 = (paths: readonly string[]): void => {
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

const submit = async (): Promise<HTMLElement> => {
  document
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() =>
    expect(
      document.querySelector('[data-cms-validation-summary]'),
    ).not.toBeNull(),
  );
  return document.querySelector<HTMLElement>('[data-cms-validation-summary]')!;
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

describe('422 validation feedback', () => {
  it('[P2-S09-AC-248] lists the invalid fields in server violation order with the first link targeting the first invalid field', async () => {
    formMarkup();
    respond422(['/kind', '/key']);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const summary = await submit();
    const links = [...summary.querySelectorAll('a')];
    expect(links.map((link) => link.textContent)).toEqual([
      'Review kind',
      'Review key',
    ]);
    expect(links[0]?.getAttribute('href')).toBe('#field-kind');
    cleanup();
  });

  it('[P2-S09-AC-248] marks each invalid field and links its description to the summary while keeping its persistent help', async () => {
    formMarkup();
    respond422(['/key']);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const summary = await submit();
    const key = document.querySelector('#field-key');
    expect(key?.getAttribute('aria-invalid')).toBe('true');
    expect(key?.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'key-help',
      summary.id,
    ]);
    expect(document.querySelector('label[for="field-key"]')?.textContent).toBe(
      'Key',
    );
    expect(
      document.querySelector('#field-kind')?.hasAttribute('aria-invalid'),
    ).toBe(false);
    cleanup();
  });

  it('[P2-S09-AC-248] resolves a nested JSON pointer to the field named by its last segment', async () => {
    formMarkup();
    respond422(['/fields/0/key']);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const summary = await submit();
    expect(summary.querySelector('a')?.getAttribute('href')).toBe('#field-key');
    cleanup();
  });

  it('[P2-S09-AC-248] moves focus to the summary, an assertive alert named by its heading', async () => {
    formMarkup();
    respond422(['/key']);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    const summary = await submit();
    expect(document.activeElement).toBe(summary);
    expect(summary.getAttribute('role')).toBe('alert');
    const labelledBy = summary.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(labelledBy)?.textContent).toBe(
      'Review the highlighted schema fields',
    );
    cleanup();
  });

  it('[P2-S09-AC-248] submits a client-valid form and lets the server decide (no client pre-emption)', async () => {
    formMarkup();
    respond422(['/key']);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);
    await submit();
    expect(fetch).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

describe('polite status', () => {
  it('[P2-S09-AC-248] announces progress in a polite atomic status and errors in an assertive alert', () => {
    formMarkup();
    const form = document.querySelector('form') as HTMLFormElement;
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
