// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { takeCmsEditorialResult } from '../components/cms-editorial/cms-editorial-result-handoff';
import { installCmsEditorialPageActions } from './cms-editorial-page-actions-core';

/*
 * The restore confirmation is a native form that cannot express the JSON body
 * or the CSRF / Idempotency-Key / If-Match headers, so the document-level
 * submit interceptor is the only thing that makes it work. These tests drive
 * the real submit event through the real submitters; only the network edge
 * (fetch) and the browser navigation are replaced.
 */

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const NEW_REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132df';
const CHAIN_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const INSTANT = '2026-10-05T00:00:00+00:00';
const CSRF_TOKEN = 'csrf-token';

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${value.replace(/"/g, '&quot;')}" />`;

const mountRestoreForm = (): HTMLFormElement => {
  const form = document.createElement('form');
  form.setAttribute('data-cms-editorial-restore', '');
  form.innerHTML = [
    hidden('entryId', ENTRY_ID),
    hidden('revisionId', REVISION_ID),
    hidden('migrationChainId', CHAIN_ID),
    hidden('edgeCount', '2'),
    hidden('availability', 'available'),
    hidden('expectedVersion', '7'),
    '<button type="submit">Restore</button>',
  ].join('');
  document.body.appendChild(form);
  return form;
};

const restoredResponse = (): Response =>
  new Response(
    JSON.stringify({
      entryId: ENTRY_ID,
      id: NEW_REVISION_ID,
      version: '1',
      entryVersion: '8',
      revisionNumber: '9',
      createdAt: INSTANT,
      updatedAt: INSTANT,
      locale: 'en-US',
      state: 'draft',
      schemaVersionId: VERSION_ID,
      templateVersionId: null,
      taxonomyVersionIds: [],
      parentRevisionIds: [],
      conflictId: null,
      contentHash: 'b'.repeat(64),
      validationState: 'valid',
    }),
    {
      status: 201,
      headers: {
        'content-type': 'application/json',
        location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/${NEW_REVISION_ID}`,
        etag: '"8"',
        'cache-control': 'no-store',
      },
    },
  );

const settle = async (): Promise<void> => {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const submit = (form: HTMLFormElement): SubmitEvent => {
  const event = new SubmitEvent('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
};

let lifetime = new AbortController();

const install = (navigate: (path: string) => void): void =>
  installCmsEditorialPageActions(document, {
    navigate,
    signal: lifetime.signal,
  });

beforeEach(() => {
  lifetime = new AbortController();
  document.cookie = `wj_csrf=${CSRF_TOKEN}`;
});

afterEach(() => {
  lifetime.abort();
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('installCmsEditorialPageActions navigation', () => {
  it('opens the restored draft on its APP route and leaves the one-shot heading-focus mark', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => restoredResponse()),
    );
    const navigate = vi.fn();
    install(navigate);
    const form = mountRestoreForm();

    submit(form);
    await settle();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
    expect(window.sessionStorage.getItem('wj:focus-route-heading')).toBe('1');
  });

  it('leaves the restored lineage (parents, migration chain, edge count) and the new version for the entry page', async () => {
    const parents = ['018f0c45-73fe-7dc2-9c09-68f7ecf132a1', REVISION_ID];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const base = restoredResponse();
        const body = (await base.json()) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ ...body, parentRevisionIds: parents }),
          { status: base.status, headers: base.headers },
        );
      }),
    );
    install(vi.fn());
    submit(mountRestoreForm());
    await settle();
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY_ID)).toEqual({
      kind: 'restored',
      entryId: ENTRY_ID,
      revisionNumber: '9',
      entryVersion: '8',
      state: 'draft',
      parentRevisionIds: parents,
      migrationChainId: CHAIN_ID,
      edgeCount: 2,
    });
  });

  it('leaves no result behind when the restore is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'CONFLICT' }), { status: 409 }),
      ),
    );
    install(vi.fn());
    submit(mountRestoreForm());
    await settle();
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY_ID)).toBeNull();
  });

  it('announces the refusal and does not navigate when the restore is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'FORBIDDEN',
              message: 'Forbidden.',
              details: {},
              requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
            }),
            { status: 403, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const navigate = vi.fn();
    install(navigate);
    submit(mountRestoreForm());
    await settle();

    expect(navigate).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-cms-editorial-restore-status]')?.textContent
        ?.length,
    ).toBeGreaterThan(0);
  });

  it('turns the create type selector into a navigation to the selected compiled version', async () => {
    const navigate = vi.fn();
    install(navigate);
    const form = document.createElement('form');
    form.setAttribute('data-cms-editorial-create-type-selector', '');
    form.innerHTML =
      '<select name="contentTypeVersionId"><option value="">Select</option>' +
      `<option value="${VERSION_ID}" selected>Release note</option></select>`;
    document.body.appendChild(form);

    const event = submit(form);

    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      expect.stringContaining(`contentTypeVersionId=${VERSION_ID}`),
    );
  });
});

describe('restore review disclosure', () => {
  const mountReview = (): {
    readonly details: HTMLDetailsElement;
    readonly summary: HTMLElement;
    readonly heading: HTMLElement;
    readonly cancel: HTMLButtonElement;
  } => {
    const details = document.createElement('details');
    details.setAttribute('data-cms-editorial-restore-review', '');
    details.innerHTML =
      '<summary>Restore this revision</summary>' +
      '<section><h3 id="history-restore-title" tabindex="-1">Confirm restore</h3>' +
      '<button type="submit">Confirm restore</button>' +
      '<button type="button" data-cms-editorial-restore-cancel>Cancel</button></section>';
    document.body.appendChild(details);
    return {
      details,
      summary: details.querySelector('summary') as HTMLElement,
      heading: details.querySelector('h3') as HTMLElement,
      cancel: details.querySelector(
        '[data-cms-editorial-restore-cancel]',
      ) as HTMLButtonElement,
    };
  };

  const open = (details: HTMLDetailsElement): void => {
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
  };

  it('moves focus to the confirmation heading when the review opens', () => {
    install(vi.fn());
    const { details, heading } = mountReview();
    open(details);
    expect(document.activeElement).toBe(heading);
  });

  it('closes on Escape before any commit and returns focus to the summary', () => {
    install(vi.fn());
    const { details, summary, heading } = mountReview();
    open(details);
    heading.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it('closes on Cancel and returns focus to the summary, never submitting', () => {
    const navigate = vi.fn();
    install(navigate);
    const { details, summary, cancel } = mountReview();
    open(details);
    cancel.click();
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves Escape alone while the review is closed', () => {
    install(vi.fn());
    const { details, heading } = mountReview();
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    heading.dispatchEvent(event);
    expect(details.open).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});

/**
 * AC-058 (lane EB R1), FE03 error behavior (:2599-:2604) and Unsaved changes
 * (:921, :1178, :2640): a typed restore failure moves focus to an error summary
 * INSIDE the confirmation (never leaves it on a control that did nothing), the
 * refusal leaves the source and the confirmation intact ("a refusal preserves the
 * source and draft", :582), and the scoped draft (the intent to restore, with the
 * idempotency key of an unconfirmed attempt) survives an interruption and a
 * same-record navigation until the restore succeeds or the author cancels.
 */
describe('restore confirmation: typed failures and the scoped draft', () => {
  const REVIEW_HEADING = 'history-restore-title';

  const mountReview = (
    expectedVersion = '7',
  ): {
    readonly details: HTMLDetailsElement;
    readonly form: HTMLFormElement;
  } => {
    const details = document.createElement('details');
    details.setAttribute('data-cms-editorial-restore-review', '');
    details.innerHTML =
      '<summary>Restore this revision</summary>' +
      `<section><h3 id="${REVIEW_HEADING}" tabindex="-1">Confirm restore</h3>` +
      '<form data-cms-editorial-restore="">' +
      [
        hidden('entryId', ENTRY_ID),
        hidden('revisionId', REVISION_ID),
        hidden('migrationChainId', CHAIN_ID),
        hidden('edgeCount', '2'),
        hidden('availability', 'available'),
        hidden('expectedVersion', expectedVersion),
      ].join('') +
      '<button type="submit">Confirm restore</button> ' +
      '<button type="button" data-cms-editorial-restore-cancel>Cancel</button>' +
      '</form></section>';
    document.body.appendChild(details);
    return {
      details,
      form: details.querySelector('form') as HTMLFormElement,
    };
  };

  const typed = (
    status: number,
    code: string,
    details: unknown = {},
  ): Response =>
    new Response(
      JSON.stringify({
        code,
        message: 'Server text that must never be shown.',
        details,
        requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
      }),
      { status, headers: { 'content-type': 'application/json' } },
    );

  const summaryOf = (form: HTMLFormElement): HTMLElement | null =>
    form.querySelector<HTMLElement>('[data-cms-editorial-restore-error]');

  it.each([
    [
      409,
      'CONFLICT',
      { reasonCode: 'migration_chain_mismatch' },
      'did not complete',
    ],
    [422, 'VALIDATION_FAILED', {}, 'did not complete'],
    [403, 'FORBIDDEN', {}, 'did not complete'],
    [404, 'NOT_FOUND', {}, 'did not complete'],
    // A 5xx may have been applied: the heading says it could not be confirmed.
    [503, 'DEPENDENCY_UNAVAILABLE', {}, 'could not be confirmed'],
  ])(
    'a %i focuses a summary inside the form, keeps the source untouched and re-enables the confirm control',
    async (status, code, details, heading) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => typed(status, code, details)),
      );
      install(vi.fn());
      const { details: review, form } = mountReview();
      review.open = true;
      // The disclosure's own toggle (which focuses its heading) has fired by
      // the time a person reaches Confirm restore.
      await settle();
      const confirm = form.querySelector(
        '[type="submit"]',
      ) as HTMLButtonElement;
      confirm.focus();
      submit(form);
      await settle();
      const summary = summaryOf(form);
      expect(summary, String(status)).not.toBeNull();
      expect(summary?.textContent).toContain(heading);
      expect(summary?.textContent).not.toContain('Server text');
      expect(summary?.textContent).toContain('Nothing was changed');
      expect(document.activeElement).toBe(summary?.querySelector('h4'));
      expect(confirm.disabled).toBe(false);
      expect(review.open).toBe(true);
      // The carrier is exactly what the author confirmed.
      expect(
        (form.elements.namedItem('migrationChainId') as HTMLInputElement).value,
      ).toBe(CHAIN_ID);
      // The polite status announcement other surfaces rely on is kept.
      expect(
        document.querySelector('[data-cms-editorial-restore-status]')
          ?.textContent?.length,
      ).toBeGreaterThan(0);
    },
  );

  it('a repeated failure replaces the summary instead of stacking another', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => typed(409, 'CONFLICT')),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    submit(form);
    await settle();
    expect(
      form.querySelectorAll('[data-cms-editorial-restore-error]'),
    ).toHaveLength(1);
  });

  it('removes the summary when the next attempt starts', async () => {
    const responses = [typed(409, 'CONFLICT'), typed(409, 'CONFLICT')];
    let release: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const next = responses.shift() as Response;
        if (responses.length === 0)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        return next;
      }),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    expect(summaryOf(form)).not.toBeNull();
    submit(form);
    await settle();
    expect(summaryOf(form)).toBeNull();
    release?.();
    await settle();
  });

  it('an expired session offers sign-in in a NEW tab so the confirmation stays in this page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => typed(401, 'UNAUTHENTICATED')),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    const link = summaryOf(form)?.querySelector('a');
    expect(link?.textContent).toContain('Sign in again');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('href')).toContain('/auth/sign-in?returnTo=');
  });

  it('an unconfirmed attempt keeps the idempotency key and a scoped draft, and says the retry cannot restore twice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    const key = form.dataset.cmsEditorialRestoreIdempotencyKey;
    expect(key).toBeTruthy();
    expect(summaryOf(form)?.textContent).toContain('cannot restore twice');
    expect(
      window.sessionStorage.getItem(`wj-step-up-draft:${draftScope()}`),
    ).not.toBeNull();
  });

  it('re-opens the kept confirmation on the same record after navigation, reuses the key, and submits nothing by itself', async () => {
    const lost = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', lost);
    install(vi.fn());
    const first = mountReview();
    submit(first.form);
    await settle();
    const key = first.form.dataset.cmsEditorialRestoreIdempotencyKey;
    // Same-record navigation: the page is rendered again.
    lifetime.abort();
    document.body.replaceChildren();
    lifetime = new AbortController();
    const fetchAgain = vi.fn(async () => restoredResponse());
    vi.stubGlobal('fetch', fetchAgain);
    // The page is rendered by the server with the form in place; the bundled
    // script then installs and recovers the kept confirmation.
    const second = mountReview();
    install(vi.fn());
    expect(second.details.open).toBe(true);
    expect(second.form.dataset.cmsEditorialRestoreIdempotencyKey).toBe(key);
    expect(
      document.querySelector('[data-cms-editorial-restore-status]')
        ?.textContent,
    ).toContain('confirmation was kept');
    expect(fetchAgain).not.toHaveBeenCalled();
  });

  it('does not reuse the key once the entry version changed meanwhile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    install(vi.fn());
    const first = mountReview('7');
    submit(first.form);
    await settle();
    lifetime.abort();
    document.body.replaceChildren();
    lifetime = new AbortController();
    const second = mountReview('8');
    install(vi.fn());
    expect(
      second.form.dataset.cmsEditorialRestoreIdempotencyKey,
    ).toBeUndefined();
  });

  it('forgets the draft when the author cancels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    (
      form.querySelector('[data-cms-editorial-restore-cancel]') as HTMLElement
    ).click();
    expect(
      window.sessionStorage.getItem(`wj-step-up-draft:${draftScope()}`),
    ).toBeNull();
    expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBeUndefined();
  });

  it('forgets the draft when the restore succeeds', async () => {
    const responses = [
      () => {
        throw new TypeError('Failed to fetch');
      },
      () => restoredResponse(),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (responses.shift() as () => Response)()),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    submit(form);
    await settle();
    expect(
      window.sessionStorage.getItem(`wj-step-up-draft:${draftScope()}`),
    ).toBeNull();
  });

  it('leaves no draft behind for a definite refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => typed(409, 'CONFLICT')),
    );
    install(vi.fn());
    const { form } = mountReview();
    submit(form);
    await settle();
    expect(
      window.sessionStorage.getItem(`wj-step-up-draft:${draftScope()}`),
    ).toBeNull();
  });
});

const draftScope = (): string =>
  `cms-editorial-restore:${ENTRY_ID}:${REVISION_ID}`;
