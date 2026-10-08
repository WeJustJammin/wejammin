// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The CmsEditorialDocument shell loads this module with a plain `<script src>`,
 * so importing it is the only moment the document-level submit interceptor can
 * be installed (the same self-install shape as route-heading-focus.ts and
 * auth-scope-sync.ts). This file imports the module exactly the way the bundle
 * does and then submits a real native restore form: if the module did not
 * install itself, the browser would POST the urlencoded form to the JSON API.
 *
 * It is its own file so the self-installed listener cannot leak into another
 * test's document.
 */

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const CHAIN_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${value}" />`;

const mountRestoreForm = (): HTMLFormElement => {
  const form = document.createElement('form');
  form.setAttribute('data-cms-editorial-restore', '');
  form.setAttribute('method', 'post');
  form.setAttribute(
    'action',
    `/api/v1/cms/entries/${ENTRY_ID}/revisions/${REVISION_ID}/restore`,
  );
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

// A refusal keeps the test from navigating: jsdom cannot navigate, and the
// assertion here is only that the submit was intercepted and sent as JSON.
const refusedResponse = (): Response =>
  new Response(
    JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Forbidden.',
      details: {},
      requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
    }),
    { status: 403, headers: { 'content-type': 'application/json' } },
  );

beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});

afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  vi.unstubAllGlobals();
});

describe('cms editorial page actions module', () => {
  it('installs itself when the bundled script loads, so a submit never falls back to a native POST', async () => {
    const fetchMock = vi.fn(async () => refusedResponse());
    vi.stubGlobal('fetch', fetchMock);
    await import('./cms-editorial-page-actions');
    const form = mountRestoreForm();

    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(event);
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(event.defaultPrevented).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/revisions/${REVISION_ID}/restore`,
    );
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(headers.get('if-match')).toBe('"7"');
  });
});
