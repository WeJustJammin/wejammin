// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installCmsEditorialPageActions } from '../../apps/web/src/lib/cms-editorial-page-actions-core';
import { submitCmsEditorialRestoreForm } from '../../apps/web/src/components/cms-editorial/cms-editorial-restore-submit';

/**
 * Evidence lane EB (AC-058, AC-057): the CMS-07 restore client. The submitter and the document-level page action
 * run for real; only the network edge (fetch) and the browser navigation are replaced.
 */

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const NEW_REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132df';
const CHAIN_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const INSTANT = '2026-10-05T00:00:00+00:00';
const CSRF_TOKEN = 'csrf-token';
const KEY = 'restore-key-12345';

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${value}" />`;

const mountForm = (): HTMLFormElement => {
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

const resource = (patch: Record<string, unknown> = {}) => ({
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
  ...patch,
});

const created = (
  body: unknown = resource(),
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: 201,
    headers: {
      'content-type': 'application/json',
      location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/${NEW_REVISION_ID}`,
      etag: '"8"',
      'cache-control': 'no-store',
      ...headers,
    },
  });

const refusal = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  message = 'UPSTREAM-SECRET-TEXT',
): Response =>
  new Response(
    JSON.stringify({ code, message, details, requestId: REQUEST_ID }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );

const submit = (fetcher: () => Promise<Response>, form = mountForm()) =>
  submitCmsEditorialRestoreForm({
    form,
    csrfToken: CSRF_TOKEN,
    documentRef: { cookie: `wj_csrf=${CSRF_TOKEN}` },
    idempotencyKey: KEY,
    fetcher: async () => fetcher(),
  });

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('EB restore client: a forged or unverifiable 201 is never adopted and the same key is kept for the retry', () => {
  const FORGERIES: readonly (readonly [string, () => Response])[] = [
    [
      'a resource of another entry',
      () => created(resource({ entryId: NEW_REVISION_ID })),
    ],
    [
      'the source revision id itself',
      () => created(resource({ id: REVISION_ID })),
    ],
    ['a published revision', () => created(resource({ state: 'published' }))],
    [
      'a revision that names a conflict',
      () => created(resource({ conflictId: CHAIN_ID })),
    ],
    [
      'a Location on another origin',
      () =>
        created(resource(), {
          location: `https://evil.example/api/v1/cms/entries/${ENTRY_ID}/revisions/${NEW_REVISION_ID}`,
        }),
    ],
    [
      'a Location of another revision',
      () =>
        created(resource(), {
          location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/${CHAIN_ID}`,
        }),
    ],
    [
      'a Location with a query',
      () =>
        created(resource(), {
          location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/${NEW_REVISION_ID}?x=1`,
        }),
    ],
    [
      'an ETag that is not the committed entry version',
      () => created(resource(), { etag: '"1"' }),
    ],
    ['a weak ETag', () => created(resource(), { etag: 'W/"8"' })],
    [
      'a response that is not no-store',
      () => created(resource(), { 'cache-control': 'public, max-age=60' }),
    ],
    ['an unparseable body', () => created('not a resource')],
  ];
  for (const [label, response] of FORGERIES)
    it(`EB restore forged 201: ${label} is an unknown outcome that keeps the idempotency key and is not adopted`, async () => {
      const form = mountForm();
      const result = await submit(async () => response(), form);
      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.outcomeUnknown).toBe(true);
      expect(result.retryable).toBe(true);
      expect(result.idempotencyKey).toBe(KEY);
      expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBe(KEY);
    });

  it('EB restore forged 201 control: the verified 201 is adopted with its strong ETag and the retained key is cleared', async () => {
    const form = mountForm();
    form.dataset.cmsEditorialRestoreIdempotencyKey = KEY;
    const result = await submit(async () => created(), form);
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    expect(result.etag).toBe('"8"');
    expect(result.location).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/revisions/${NEW_REVISION_ID}`,
    );
    expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBeUndefined();
  });
});

describe('EB restore client ApiError mapping: exact code, requestId and fixed safe copy per status', () => {
  const STATUSES: readonly (readonly [number, string, boolean, boolean])[] = [
    [400, 'INVALID_REQUEST', false, false],
    [401, 'UNAUTHENTICATED', false, false],
    [403, 'FORBIDDEN', false, false],
    [404, 'NOT_FOUND', false, false],
    [409, 'CONFLICT', false, false],
    [415, 'UNSUPPORTED_MEDIA_TYPE', false, false],
    [422, 'VALIDATION_FAILED', false, false],
    [429, 'RATE_LIMITED', true, false],
    [502, 'DEPENDENCY_UNAVAILABLE', true, true],
    [503, 'DEPENDENCY_UNAVAILABLE', true, true],
    [504, 'GATEWAY_TIMEOUT', true, true],
  ];
  for (const [status, code, retryable, outcomeUnknown] of STATUSES)
    it(`EB restore ApiError ${String(status)} ${code}: keeps the code and request id, never relays the upstream text, retryable=${String(retryable)} outcomeUnknown=${String(outcomeUnknown)}`, async () => {
      const form = mountForm();
      const result = await submit(async () => refusal(status, code), form);
      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.error.code).toBe(code);
      expect(result.error.requestId).toBe(REQUEST_ID);
      expect(result.error.message).not.toContain('UPSTREAM-SECRET-TEXT');
      expect(result.error.message.length).toBeGreaterThan(10);
      expect(result.error.details).toBeNull();
      expect(result.retryable).toBe(retryable);
      expect(result.outcomeUnknown).toBe(outcomeUnknown);
      expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBe(
        retryable || outcomeUnknown ? KEY : undefined,
      );
    });

  it('EB restore ApiError: a typed 409 reason shows its own fixed copy, different from the generic conflict copy', async () => {
    const generic = await submit(async () => refusal(409, 'CONFLICT'));
    const typed = await submit(async () =>
      refusal(409, 'CONFLICT', { reasonCode: 'migration_chain_mismatch' }),
    );
    if (generic.status !== 'error' || typed.status !== 'error')
      throw new Error('expected two errors');
    expect(typed.error.message).not.toBe(generic.error.message);
    expect(typed.error.message).not.toContain('migration_chain_mismatch');
  });

  it('EB restore ApiError: an unregistered reason code is dropped and the status copy is used', async () => {
    const generic = await submit(async () => refusal(409, 'CONFLICT'));
    const unknown = await submit(async () =>
      refusal(409, 'CONFLICT', { reasonCode: 'attacker_chosen_reason' }),
    );
    if (generic.status !== 'error' || unknown.status !== 'error')
      throw new Error('expected two errors');
    expect(unknown.error.message).toBe(generic.error.message);
  });

  it('EB restore ApiError: a lost response is an unknown outcome that keeps the key for the exact-key retry', async () => {
    const form = mountForm();
    const result = await submit(
      async () => Promise.reject(new TypeError('network down')),
      form,
    );
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(result.outcomeUnknown).toBe(true);
    expect(result.retryable).toBe(true);
    expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBe(KEY);
  });
});

describe('EB restore page action: announced status, retained input and a lock that is always released', () => {
  const settle = async (): Promise<void> => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  let lifetime = new AbortController();

  beforeEach(() => {
    lifetime = new AbortController();
    document.cookie = `wj_csrf=${CSRF_TOKEN}`;
  });
  afterEach(() => {
    lifetime.abort();
    document.cookie = 'wj_csrf=; max-age=0';
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  const run = async (fetcher: () => Response | Promise<Response>) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fetcher()),
    );
    const navigate = vi.fn();
    installCmsEditorialPageActions(document, {
      navigate,
      signal: lifetime.signal,
    });
    const form = mountForm();
    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
    const status = document.querySelector(
      'p[data-cms-editorial-restore-status]',
    );
    return { form, navigate, status };
  };

  it('EB restore announce: an accepted restore announces a polite status, navigates once to the restored entry and leaves the focus mark', async () => {
    const { navigate, status } = await run(() => created());
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toBe(
      'The restore was accepted. Loading the restored draft…',
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
    expect(window.sessionStorage.getItem('wj:focus-route-heading')).toBe('1');
  });

  it('EB restore announce: an unknown outcome shows a focused failure summary with the exact-retry recovery, does not navigate and keeps the request key on the form', async () => {
    const { form, navigate, status } = await run(() =>
      refusal(503, 'DEPENDENCY_UNAVAILABLE'),
    );
    const summary = form.querySelector('[data-cms-editorial-restore-error]');
    expect(summary).not.toBeNull();
    const heading = summary?.querySelector('h4');
    expect(heading?.textContent).toBe('The restore could not be confirmed');
    expect(document.activeElement).toBe(heading);
    expect(summary?.textContent).toContain(
      'The restore is unavailable right now. Nothing was changed.',
    );
    expect(summary?.textContent).toContain(
      'Choose Confirm restore again to retry the same request; it cannot restore twice.',
    );
    expect(status?.textContent).toBe(
      'The restore is unavailable right now. Nothing was changed. Choose Confirm restore again to retry the same request; it cannot restore twice.',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toMatch(/\S{8,}/u);
  });

  it('EB restore announce: a definite refusal shows a focused failure summary with its fixed copy and releases the form with its hidden input unchanged', async () => {
    const { form, navigate, status } = await run(() =>
      refusal(403, 'FORBIDDEN'),
    );
    const summary = form.querySelector('[data-cms-editorial-restore-error]');
    expect(summary?.querySelector('h4')?.textContent).toBe(
      'The restore did not complete',
    );
    expect(document.activeElement).toBe(summary?.querySelector('h4'));
    expect(summary?.textContent).toContain(
      'You no longer have edit capability for this entry.',
    );
    expect(summary?.textContent).not.toContain('UPSTREAM-SECRET-TEXT');
    expect(status?.textContent).toBe(
      'You no longer have edit capability for this entry. Nothing was changed; the source revision and your confirmation are unchanged.',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(form.getAttribute('aria-busy')).toBe('false');
    for (const control of Array.from(
      form.querySelectorAll('button, input'),
    ) as HTMLInputElement[])
      expect(control.disabled).toBe(false);
    expect(
      form.querySelector<HTMLInputElement>('input[name="revisionId"]')?.value,
    ).toBe(REVISION_ID);
    expect(
      form.querySelector<HTMLInputElement>('input[name="migrationChainId"]')
        ?.value,
    ).toBe(CHAIN_ID);
    expect(
      form.querySelector<HTMLInputElement>('input[name="expectedVersion"]')
        ?.value,
    ).toBe('7');
    expect(form.dataset.cmsEditorialRestoreIdempotencyKey).toBeUndefined();
  });

  it('EB restore announce: while the command is in flight the form is busy and its controls are disabled, and a second submit does not send a second request', async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    installCmsEditorialPageActions(document, {
      navigate: vi.fn(),
      signal: lifetime.signal,
    });
    const form = mountForm();
    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(form.querySelector('button')?.disabled).toBe(true);
    form.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    release(refusal(403, 'FORBIDDEN'));
    await settle();
    expect(form.getAttribute('aria-busy')).toBe('false');
  });
});
