// @vitest-environment jsdom

import * as React from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  CONTENT_TYPE_ID,
  CONTENT_TYPE_VERSION_ID,
  allKindFields,
  authoringField,
  fieldUuid,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  selectBy,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { takeCmsEditorialResult } from './cms-editorial-result-handoff';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-10-05T00:00:00+00:00';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const created = (): Response =>
  new Response(
    JSON.stringify({
      entry: {
        id: ENTRY_ID,
        version: '1',
        createdAt: INSTANT,
        updatedAt: INSTANT,
      },
      revision: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
        version: '1',
        createdAt: INSTANT,
        updatedAt: INSTANT,
      },
      revisionNumber: '1',
      lifecycle: 'active',
      state: 'draft',
      locale: 'en-US',
      contentHash: HASH,
      validationState: 'valid',
    }),
    {
      status: 201,
      headers: {
        'content-type': 'application/json',
        location: `/api/v1/cms/entries/${ENTRY_ID}`,
        etag: '"1"',
        'cache-control': 'no-store',
      },
    },
  );

const apiError = (status: number, code: string, details: unknown = {}) =>
  new Response(
    JSON.stringify({ code, message: 'Safe.', requestId: REQUEST_ID, details }),
    { status, headers: { 'content-type': 'application/json' } },
  );

beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});

afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const render = (
  fetcher: Fetcher,
  fields = allKindFields(),
  navigate: (path: string) => void = vi.fn(),
) => {
  const mounted = mountElement(
    <CmsEditorialEntryCreateIsland
      type={selectedType()}
      fields={fields}
      fetcher={fetcher}
      navigate={navigate}
    />,
  );
  return { ...mounted, navigate };
};

const submitForm = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Create entry'));
  await flush();
};

describe('CmsEditorialEntryCreateIsland: rendering', () => {
  it('renders a native control per kind and a typed unavailable state where nothing can be authored', () => {
    const { container } = render(vi.fn());
    expect(byLabel(container, 'Title (required)').tagName).toBe('INPUT');
    expect(byLabel(container, 'Category').tagName).toBe('SELECT');
    expect(container.querySelector('.cms-rich-text-editor')).not.toBeNull();
    expect(container.textContent).toContain(
      'Links can be added after the entry is created.',
    );
    expect(container.textContent).toContain('Taxonomy terms cannot be set yet');
    expect(container.textContent).toContain('Media cannot be set yet');
    // No JSON box anywhere.
    for (const area of Array.from(container.querySelectorAll('textarea')))
      expect(area.value.trim().startsWith('{')).toBe(false);
    expect(
      Array.from(container.querySelectorAll('select')).some(
        (select) => select.id === 'entry-locale',
      ),
    ).toBe(true);
    expect(
      Array.from(
        container.querySelectorAll<HTMLOptionElement>('#entry-locale option'),
      ).map((option) => option.value),
    ).toEqual(['en-US', 'fr-FR']);
  });

  it('prefills a literal default and creates with it', async () => {
    const fetcher = vi.fn(async () => created());
    const fields = [
      authoringField({
        n: 1,
        key: 'title',
        kind: 'short_text',
        label: 'Title',
        defaultValue: 'Untitled',
      }),
    ];
    const { container } = render(fetcher, fields);
    expect(byLabel<HTMLInputElement>(container, 'Title').value).toBe(
      'Untitled',
    );
    await submitForm(container);
    const body = JSON.parse(
      String(
        (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as { values: Record<string, unknown> };
    expect(body.values).toEqual({ [fieldUuid(1)]: 'Untitled' });
  });
});

describe('CmsEditorialEntryCreateIsland: local validation', () => {
  it('refuses an invalid form without a request, links the summary to the field and focuses it', async () => {
    const fetcher = vi.fn();
    const { container } = render(fetcher as unknown as Fetcher);
    await submitForm(container);
    expect(fetcher).not.toHaveBeenCalled();
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary).not.toBeNull();
    expect(document.activeElement).toBe(summary);
    const link = Array.from(summary?.querySelectorAll('a') ?? []).find(
      (anchor) => anchor.textContent?.startsWith('Title'),
    );
    expect(link?.getAttribute('href')).toBe(`#field-${fieldUuid(1)}`);
    expect(
      byLabel(container, 'Title (required)').getAttribute('aria-invalid'),
    ).toBe('true');
    await click(link!);
    expect(document.activeElement).toBe(byLabel(container, 'Title (required)'));
  });

  it('keeps every typed value when the form is refused', async () => {
    const { container } = render(vi.fn() as unknown as Fetcher);
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Blurb'), 'Keep me');
    await submitForm(container);
    expect(byLabel<HTMLTextAreaElement>(container, 'Blurb').value).toBe(
      'Keep me',
    );
  });
});

describe('CmsEditorialEntryCreateIsland: submit', () => {
  it('creates with only the fields that hold a value, then opens the APP route of the entry', async () => {
    const fetcher = vi.fn(async () => created());
    const { container, navigate } = render(fetcher);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await submitForm(container);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/entries');
    const headers = new Headers(init.headers);
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    expect(headers.get('idempotency-key')).toBeTruthy();
    expect(headers.get('if-match')).toBeNull();
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.contentTypeId).toBe(CONTENT_TYPE_ID);
    expect(body.contentTypeVersionId).toBe(CONTENT_TYPE_VERSION_ID);
    expect(body.locale).toBe('en-US');
    expect(body.values).toEqual({ [fieldUuid(1)]: 'Launch notes' });
    expect(body.changedPaths).toEqual([`/fields/${fieldUuid(1)}`]);
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
    expect(window.sessionStorage.getItem('wj:focus-route-heading')).toBe('1');
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'The entry was created',
    );
  });

  it('leaves the canonical result (revision, entry version, state) for the entry page it opens', async () => {
    const fetcher = vi.fn(async () => created());
    const { container } = render(fetcher);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await submitForm(container);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY_ID)).toEqual({
      kind: 'created',
      entryId: ENTRY_ID,
      revisionNumber: '1',
      entryVersion: '1',
      state: 'draft',
      parentRevisionIds: [],
      migrationChainId: null,
      edgeCount: null,
    });
  });

  it('leaves no result behind when the create is refused', async () => {
    const fetcher = vi.fn(async () => apiError(409, 'CONFLICT'));
    const { container } = render(fetcher);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await submitForm(container);
    expect(takeCmsEditorialResult(window.sessionStorage, ENTRY_ID)).toBeNull();
  });

  it('sends the chosen locale', async () => {
    const fetcher = vi.fn(async () => created());
    const { container } = render(fetcher);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Bonjour',
    );
    const select = selectBy(container, '#entry-locale');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    )?.set;
    await React.act(async () => {
      setter?.call(select, 'fr-FR');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await submitForm(container);
    const body = JSON.parse(
      String(
        (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    ) as { locale: string };
    expect(body.locale).toBe('fr-FR');
  });
});

describe('CmsEditorialEntryCreateIsland: failures keep the work', () => {
  it('maps a typed server refusal to its field, keeps values and never shows the server message', async () => {
    const { container } = render(
      vi.fn(async () =>
        apiError(422, 'VALIDATION_FAILED', {
          reasonCode: 'object_property_invalid',
          violations: [
            {
              path: `/values/${fieldUuid(1)}`,
              code: 'invalid_value',
              message: 'x',
            },
          ],
        }),
      ),
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await submitForm(container);
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary?.textContent).toContain('object properties are invalid');
    expect(summary?.textContent).not.toContain('Safe.');
    expect(
      byLabel<HTMLInputElement>(container, 'Title (required)').getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Launch notes',
    );
    expect(document.activeElement).toBe(summary);
  });

  it('on a lost response locks the form, keeps the key, and replays the identical request', async () => {
    const calls: Array<{ key: string | null; body: string }> = [];
    let attempt = 0;
    const fetcher: Fetcher = async (_input, init) => {
      calls.push({
        key: new Headers(init?.headers).get('idempotency-key'),
        body: String(init?.body),
      });
      attempt += 1;
      if (attempt === 1) throw new TypeError('Failed to fetch');
      return created();
    };
    const { container, navigate } = render(fetcher);
    const title = byLabel<HTMLInputElement>(container, 'Title (required)');
    await typeInto(title, 'Launch notes');
    await submitForm(container);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'could not be confirmed',
    );
    // Editing now would change the body under a key that may already be used.
    expect(container.querySelector('fieldset[disabled]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    await click(buttonNamed(container, 'Retry create'));
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.key).toBe(calls[0]?.key);
    expect(calls[1]?.body).toBe(calls[0]?.body);
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
  });

  it('offers sign-in with a safe return target on an expired session, and keeps the values', async () => {
    const { container } = render(
      vi.fn(async () => apiError(401, 'UNAUTHENTICATED')),
    );
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await submitForm(container);
    const signIn = Array.from(container.querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.includes('Sign in'),
    );
    expect(signIn?.getAttribute('href')).toMatch(
      /^\/auth\/sign-in\?returnTo=/u,
    );
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Launch notes',
    );
  });
});

describe('CmsEditorialEntryCreateIsland: text the database cannot store', () => {
  it('refuses a lone surrogate or NUL with the field message and sends nothing, keeping the typed text', async () => {
    const fetcher = vi.fn(async () => created());
    const { container } = render(fetcher as unknown as Fetcher);
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'A fine title',
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Blurb'),
      'broken \uD800 text',
    );
    await submitForm(container);
    expect(fetcher).not.toHaveBeenCalled();
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary?.textContent).toContain(
      'This text contains a character that cannot be saved.',
    );
    expect(byLabel<HTMLTextAreaElement>(container, 'Blurb').value).toBe(
      'broken \uD800 text',
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Blurb'),
      'null \u0000 byte',
    );
    await submitForm(container);
    expect(fetcher).not.toHaveBeenCalled();
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Blurb'),
      'fixed \u{1F600}',
    );
    await submitForm(container);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
