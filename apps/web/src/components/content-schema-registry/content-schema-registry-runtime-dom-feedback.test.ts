// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';

let locks = createMemoryLockManager();

const formMarkup = (): void => {
  window.history.replaceState({}, '', '/app/cms-content-modeling');
  document.body.innerHTML = `
    <main>
      <section data-workbench="content-schema-registry" data-canonical-refetch-url="/app/cms-content-modeling">
        <form id="schema-form" data-cms-command-form="true" data-operation-id="CMS-03A-02" action="/app/cms-content-modeling/record" method="post">
          <input type="hidden" name="idempotency-key" value="stable-key-123" />
          <input id="field-key" name="key" value="title" />
          <input type="hidden" name="if-match" value="&quot;4&quot;" />
          <fieldset><button type="submit">Save</button></fieldset>
        </form>
      </section>
    </main>`;
};

const submit = async (completed: () => boolean): Promise<void> => {
  document
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(completed()).toBe(true));
};

beforeEach(() => {
  locks = createMemoryLockManager();
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.dispatchEvent(new Event('pagehide'));
  locks.releaseAll();
  window.dispatchEvent(new Event('pageshow'));
  window.sessionStorage.clear();
  document.body.replaceChildren();
});

describe('content schema registry command feedback', () => {
  it('reauthenticates on 401 without exposing the submitted body', async () => {
    formMarkup();
    const navigate = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });

    await submit(() => navigate.mock.calls.length > 0);

    expect(navigate).toHaveBeenCalledWith(
      '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling',
    );
    expect(document.body.textContent).not.toContain('stable-key-123');
    cleanup();
  });

  it('renders a server capability gate for a refused mutation', async () => {
    formMarkup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 403 })),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);

    await submit(
      () => document.querySelector('[data-cms-capability-gate]') !== null,
    );

    expect(document.querySelector('[data-cms-capability-gate]')).not.toBeNull();
    expect(document.querySelector('[data-cms-command-status]')).toBeNull();
    cleanup();
  });

  it('preserves input and names explicit outcomes for a 409 conflict', async () => {
    formMarkup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              details: { expectedVersion: '4', currentVersion: '5' },
            }),
            {
              status: 409,
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);

    await submit(
      () => document.querySelector('[data-cms-sync-conflict]') !== null,
    );

    expect(document.querySelector('[data-cms-sync-conflict]')).not.toBeNull();
    expect(document.body.textContent).toContain('Server version: 5');
    expect(document.body.textContent).toContain('Local version: 4');
    expect(
      document.querySelector<HTMLInputElement>('[name="key"]')?.value,
    ).toBe('title');
    cleanup();
  });

  it('links 422 pointers to invalid fields and focuses the summary', async () => {
    formMarkup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ details: { violations: [{ pointer: '/key' }] } }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);

    await submit(
      () => document.querySelector('[data-cms-validation-summary]') !== null,
    );

    const summary = document.querySelector<HTMLElement>(
      '[data-cms-validation-summary]',
    );
    expect(summary).not.toBeNull();
    expect(
      document.querySelector('[name="key"]')?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(document.activeElement).toBe(summary);
    cleanup();
  });

  it('shows the exact OD-4 locale messages in the summary and links each to its control', async () => {
    window.history.replaceState({}, '', '/app/cms-content-modeling');
    document.body.innerHTML = `
      <main>
        <section data-workbench="content-schema-registry" data-canonical-refetch-url="/app/cms-content-modeling">
          <form id="content-schema-registry-create-form" data-cms-command-form="true" data-operation-id="CMS-03A-01" action="/app/cms-content-modeling" method="post">
            <input type="hidden" name="idempotency-key" value="stable-key-123" />
            <input id="content-schema-registry-create-form-locale-tags" />
            <fieldset id="content-schema-registry-create-form-locale-chain-fr-CA" tabindex="-1"><legend>Fallback order for fr-CA</legend></fieldset>
            <input id="field-key" name="typeKey" value="release_note" />
            <fieldset><button type="submit">Save</button></fieldset>
          </form>
        </section>
      </main>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'VALIDATION_FAILED',
              details: {
                violations: [
                  {
                    pointer: '/supportedLocales/1',
                    message: 'supportedLocales must be unique',
                  },
                  {
                    pointer: '/fallbackChains/fr-CA/0',
                    message: 'fallback chain locale must be a supported locale',
                  },
                  { pointer: '/typeKey', message: 'The value is invalid.' },
                ],
              },
            }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);

    await submit(
      () => document.querySelector('[data-cms-validation-summary]') !== null,
    );

    const summary = document.querySelector<HTMLElement>(
      '[data-cms-validation-summary]',
    ) as HTMLElement;
    const items = [...summary.querySelectorAll('li')].map(
      (item) => item.textContent,
    );
    expect(items).toContain(
      'supportedLocales / 1: supportedLocales must be unique',
    );
    expect(items).toContain(
      'fallbackChains / fr-CA / 0: fallback chain locale must be a supported locale',
    );
    expect(items).toContain('Review typeKey');
    expect(summary.textContent).not.toContain('The value is invalid.');
    const hrefs = [...summary.querySelectorAll('a')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toContain('#content-schema-registry-create-form-locale-tags');
    expect(hrefs).toContain(
      '#content-schema-registry-create-form-locale-chain-fr-CA',
    );
    expect(
      document
        .getElementById('content-schema-registry-create-form-locale-tags')
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      document
        .getElementById(
          'content-schema-registry-create-form-locale-chain-fr-CA',
        )
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(document.activeElement).toBe(summary);
    cleanup();
  });

  it('keeps a 429 form busy until the server countdown completes', async () => {
    vi.useFakeTimers();
    formMarkup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', { status: 429, headers: { 'retry-after': '2' } }),
      ),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);

    await submit(
      () => document.body.textContent?.includes('Retry in 2 seconds') ?? false,
    );
    const form = document.querySelector('form')!;
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(document.body.textContent).toContain('Retry in 2 seconds');
    vi.advanceTimersByTime(2_000);
    expect(form.getAttribute('aria-busy')).toBe('false');
    expect(document.body.textContent).toContain('try again now');
    cleanup();
  });

  it('fails closed when the same-key replay remains pending', async () => {
    formMarkup();
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(init?.method ?? 'GET');
        return new Response('{}', { status: 503 });
      }),
    );
    const cleanup = installContentSchemaRegistryCommandEnhancement(document);

    await submit(
      () => document.querySelector('[data-cms-command-retry]') !== null,
    );

    expect(methods).toEqual(['POST', 'POST']);
    expect(document.querySelector('[data-cms-command-retry]')).not.toBeNull();
    expect(document.querySelector('form')?.getAttribute('aria-busy')).toBe(
      'false',
    );
    cleanup();
  });
});
