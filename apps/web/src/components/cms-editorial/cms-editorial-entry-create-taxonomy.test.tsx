// @vitest-environment jsdom

/**
 * The CMS-03B-10 create host and the CMS-03C-17 taxonomy field: component and
 * transport integration (FE03 Slice 12 governed definition, composition,
 * related-content surfaces; P2-S12-AC-135; BE03b value encodings by field
 * kind: taxonomy { termIds: UUID[] <= 128 }).
 *
 * The host, never the field, owns the selector context: the create form supplies
 * the requested content type key (`options.type.typeKey`, server-derived), the
 * authoring locale the form currently holds, and the island's `fetcher`, so the
 * field's first selector read is `GET /api/v1/cms/taxonomies/selector` with
 * exactly `typeKey`/`fieldKey`/`locale`, answered `cache-control: no-store` and a
 * quoted ETag that IS its `pageVersion`. A verified `term_unavailable` refusal is
 * the only thing that bumps the field's refresh token, so the control re-reads
 * its first page and keeps every value; an unknown outcome never refreshes the
 * selector and replays the identical create under the same key.
 *
 * These render the REAL island with the REAL submit/transport and only `fetch`
 * replaced: component/transport integration, never a real E2E run.
 */

import {
  AuthoringContextTypeSchema,
  type AuthoringContextType,
} from '@wejammin/contracts';
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

import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import {
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
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  taxonomyPage,
  termUid,
} from '../cms-editorial-fields/cms-taxonomy-field-fixtures.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';
import { CMS_EDITORIAL_REASON_COPY } from './cms-editorial-reason-copy';

beforeAll(enableReactAct);
beforeAll(preloadCmsEditorialTransports);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
  window.sessionStorage.clear();
});

const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';
const TYPE_KEY = 'article';
const FIELD_KEY = 'topics';
const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-10-05T00:00:00+00:00';
const TITLE = fieldUuid(1);
const TOPICS = fieldUuid(13);
const GUITAR = termUid(1);

/** The type the create form authors, carrying its server-derived content type key. */
const createType = (): AuthoringContextType =>
  AuthoringContextTypeSchema.parse({ ...selectedType(), typeKey: TYPE_KEY });

const createFields = () => [
  authoringField({
    n: 1,
    key: 'title',
    kind: 'short_text',
    label: 'Title',
    required: true,
    constraints: { minLength: 2, maxLength: 40 },
  }),
  authoringField({ n: 13, key: FIELD_KEY, kind: 'taxonomy', label: 'Topics' }),
];

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
}

const pathOf = (url: string): string => {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
};
const searchOf = (url: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1)));
const selectorGets = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.method === 'GET');
const createPosts = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.method === 'POST');
const bodyOf = (call: Call): Record<string, unknown> =>
  JSON.parse(String(call.body)) as Record<string, unknown>;
const typeIntoTitle = (container: HTMLElement, text: string): Promise<void> =>
  typeInto(byLabel<HTMLInputElement>(container, 'Title (required)'), text);

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** A selector page relayed only when its quoted ETag IS its pageVersion. */
const servedPage = (
  page = taxonomyPage([{ n: 1, termKey: 'guitar', label: 'Guitar' }]),
  over: { readonly etag?: string; readonly cacheControl?: string } = {},
): Response =>
  json(200, page, {
    etag: over.etag ?? '"7"',
    'cache-control': over.cacheControl ?? 'no-store',
  });

const created = (): Response =>
  json(
    201,
    {
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
    },
    {
      location: `/api/v1/cms/entries/${ENTRY_ID}`,
      etag: '"1"',
      'cache-control': 'no-store',
    },
  );

/** The canonical verified term_unavailable refusal (BE03b error matrix). */
const termUnavailable = (): Response =>
  json(422, {
    code: 'VALIDATION_FAILED',
    message: 'Safe.',
    requestId: REQUEST_ID,
    details: {
      reasonCode: 'term_unavailable',
      violations: [
        { path: `/fields/${TOPICS}`, code: 'invalid_value', message: 'x' },
      ],
    },
  });

interface Script {
  readonly selectors?: readonly Response[];
  readonly creates?: readonly (Response | Error)[];
}

const mountCreate = (script: Script) => {
  const selectors = [...(script.selectors ?? [])];
  const creates = [...(script.creates ?? [])];
  const calls: Call[] = [];
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? init.body : null,
      });
      const queue = pathOf(url) === SELECTOR_PATH ? selectors : creates;
      const step = queue.shift();
      if (step === undefined) throw new Error(`unexpected request ${url}`);
      if (step instanceof Error) throw step;
      return step;
    },
  );
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsEditorialEntryCreateIsland
      type={createType()}
      fields={createFields()}
      descriptors={describeCmsAuthoringFields(createFields())}
      fetcher={fetcher}
      navigate={navigate}
    />,
  );
  return { ...mounted, calls, navigate };
};

const submit = async (
  container: HTMLElement,
  name = 'Create entry',
): Promise<void> => {
  await click(buttonNamed(container, name));
  await flush();
};

describe('CmsEditorialEntryCreateIsland: the taxonomy selector read', () => {
  it('[P2-S12-AC-135] reads the first page with the type key, the field key and the form locale, and offers one checkbox per term', async () => {
    const { container, calls } = mountCreate({ selectors: [servedPage()] });
    await flush();
    const gets = selectorGets(calls);
    expect(gets).toHaveLength(1);
    expect(pathOf(gets[0]!.url)).toBe(SELECTOR_PATH);
    expect(searchOf(gets[0]!.url)).toEqual({
      typeKey: TYPE_KEY,
      fieldKey: FIELD_KEY,
      locale: 'en-US',
      limit: '50',
    });
    expect(gets[0]!.body).toBeNull();
    expect(gets[0]!.headers.get('idempotency-key')).toBeNull();
    const guitar = byLabel<HTMLInputElement>(container, 'Guitar');
    expect(guitar.getAttribute('type')).toBe('checkbox');
    expect(guitar.value).toBe(GUITAR);
    expect(guitar.checked).toBe(false);
    expect(createPosts(calls)).toHaveLength(0);
  });

  it('[P2-S12-AC-135] offers no term and invents none when the page is not the strict no-store page of this request', async () => {
    const mismatched = mountCreate({
      selectors: [servedPage(undefined, { etag: '"8"' })],
    });
    await flush();
    expect(
      mismatched.container.querySelectorAll('input[type="checkbox"]'),
    ).toHaveLength(0);

    const cached = mountCreate({
      selectors: [servedPage(undefined, { cacheControl: 'max-age=60' })],
    });
    await flush();
    expect(
      cached.container.querySelectorAll('input[type="checkbox"]'),
    ).toHaveLength(0);
  });
});

describe('CmsEditorialEntryCreateIsland: writing the taxonomy value', () => {
  it('[P2-S12-AC-135] writes exactly { termIds } keyed by the stable field into the create body, keeping other typed text', async () => {
    const { container, calls } = mountCreate({
      selectors: [servedPage()],
      creates: [created()],
    });
    await flush();
    await typeIntoTitle(container, 'Launch notes');
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await submit(container);
    const posts = createPosts(calls);
    expect(posts).toHaveLength(1);
    const body = bodyOf(posts[0]!);
    expect(Object.hasOwn(body, 'typeKey')).toBe(false);
    const values = body.values as Record<string, unknown>;
    expect(values[TOPICS]).toEqual({ termIds: [GUITAR] });
    expect(Object.keys(values[TOPICS] as object)).toEqual(['termIds']);
    expect(values[TITLE]).toBe('Launch notes');
    expect(body.changedPaths).toEqual(
      [`/fields/${TOPICS}`, `/fields/${TITLE}`].sort(),
    );
  });
});

describe('CmsEditorialEntryCreateIsland: a taxonomy refusal', () => {
  it('[P2-S12-AC-135] refreshes the selector once on a verified term_unavailable, keeps the text and the stale selection, and sends nothing again', async () => {
    const { container, calls } = mountCreate({
      selectors: [servedPage(), servedPage()],
      creates: [termUnavailable(), created()],
    });
    await flush();
    await typeIntoTitle(container, 'Launch notes');
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await submit(container);
    expect(createPosts(calls)).toHaveLength(1);
    const gets = selectorGets(calls);
    expect(gets).toHaveLength(2);
    expect(searchOf(gets[1]!.url)).toEqual(searchOf(gets[0]!.url));
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Launch notes',
    );
    expect(byLabel<HTMLInputElement>(container, 'Guitar').checked).toBe(true);
    const summary = container.querySelector<HTMLElement>(
      '[data-cms-editorial-validation-summary]',
    );
    expect(summary?.textContent).toContain(
      CMS_EDITORIAL_REASON_COPY.term_unavailable,
    );
    expect(summary?.textContent).not.toContain('Safe.');
    // No automatic resubmit of the same refused request.
    await flush();
    expect(createPosts(calls)).toHaveLength(1);
    // Explicit correction: clear the stale selection, then create again.
    await click(buttonNamed(container, 'Clear selection'));
    await submit(container);
    const posts = createPosts(calls);
    expect(posts).toHaveLength(2);
    const values = bodyOf(posts[1]!).values as Record<string, unknown>;
    expect(values[TOPICS]).toBeUndefined();
    expect(values[TITLE]).toBe('Launch notes');
  });

  it('[P2-S12-AC-135] of an unknown outcome, replays the identical create under the same key and never refreshes the selector', async () => {
    const { container, calls, navigate } = mountCreate({
      selectors: [servedPage()],
      creates: [new TypeError('Failed to fetch'), created()],
    });
    await flush();
    await typeIntoTitle(container, 'Launch notes');
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await submit(container);
    expect(createPosts(calls)).toHaveLength(1);
    expect(selectorGets(calls)).toHaveLength(1);
    await submit(container, 'Retry create');
    const posts = createPosts(calls);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toBe(posts[0]!.body);
    expect(posts[1]!.headers.get('idempotency-key')).toBe(
      posts[0]!.headers.get('idempotency-key'),
    );
    expect(selectorGets(calls)).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith(
      `/app/cms-content-modeling/entries/${ENTRY_ID}`,
    );
  });
});
