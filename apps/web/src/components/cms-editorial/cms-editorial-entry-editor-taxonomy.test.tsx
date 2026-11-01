// @vitest-environment jsdom

/**
 * The CMS-05 draft editor and the CMS-03C-17 taxonomy field: component and
 * transport integration (FE03 Slice 12 governed definition, composition,
 * related-content surfaces; P2-S12-AC-135; BE03b value encodings by field
 * kind: taxonomy { termIds: UUID[] <= 128 }).
 *
 * The draft host supplies the taxonomy context from the SERVER-derived init:
 * `init.typeKey` and `init.locale` (never a label, a content type id, or a
 * designer choice) plus the island's `fetcher`, so the first selector read is
 * `GET /api/v1/cms/taxonomies/selector` with exactly typeKey/fieldKey/locale.
 * A verified `term_unavailable` refusal is the only thing that bumps the field's
 * refresh token; the stale selection survives the re-read and only an explicit
 * correction changes it, and no save is retried automatically. An unknown outcome
 * replays the identical save under the same key and never refreshes the selector.
 *
 * These render the REAL island with the REAL revision transport and only `fetch`
 * replaced: component/transport integration, never a real E2E run.
 */

import { type JsonValue } from '@wejammin/contracts';
import { act } from 'react';
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
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  taxonomyPage,
  termUid,
} from '../cms-editorial-fields/cms-taxonomy-field-fixtures.test-support';
import CmsEditorialEntryEditorIsland from './CmsEditorialEntryEditorIsland';
import {
  ENTRY_ID,
  editorInit,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import {
  createFakeClock,
  settleAsyncWork,
} from './cms-editorial-fake-clock.test-support';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';
import { CMS_EDITORIAL_REASON_COPY } from './cms-editorial-reason-copy';

beforeAll(enableReactAct);
// This semantic host test preloads the lazily imported transports, exactly as the
// island tests do, so a cold dynamic import cannot outrun `settleAsyncWork`; the
// production island still loads them on first save (no cold-load proof claimed).
beforeAll(preloadCmsEditorialTransports);
afterAll(disableReactAct);
beforeEach(() => {
  document.cookie = 'wj_csrf=csrf-token';
});
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
});

const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';
const TYPE_KEY = 'article';
const FIELD_KEY = 'topics';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const TITLE = fieldUuid(1);
const TOPICS = fieldUuid(13);
const GUITAR = termUid(1);

const draftFields = () => [
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

/** The editor init the draft page builds: the type key and locale come from the server. */
const draftInit = (
  values: Readonly<Record<string, JsonValue | null>>,
  locale = 'en-US',
) =>
  editorInit({
    typeKey: TYPE_KEY,
    locale,
    descriptors: describeCmsAuthoringFields(draftFields()),
    values,
  });

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
const savePosts = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.method === 'POST');
const bodyOf = (call: Call): Record<string, unknown> =>
  JSON.parse(String(call.body)) as Record<string, unknown>;
const statusOf = (container: HTMLElement): string =>
  container.querySelector('[data-cms-editorial-status]')?.textContent ?? '';
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

const servedPage = (): Response =>
  json(200, taxonomyPage([{ n: 1, termKey: 'guitar', label: 'Guitar' }]), {
    etag: '"7"',
    'cache-control': 'no-store',
  });

const termUnavailable = (): Response =>
  json(422, {
    code: 'VALIDATION_FAILED',
    message: 'Server text that must never be shown.',
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
  readonly saves?: readonly (Response | Error)[];
}

const mountEditor = (
  script: Script,
  init = draftInit({ [TITLE]: 'Release notes', [TOPICS]: null }),
) => {
  const selectors = [...(script.selectors ?? [])];
  const saves = [...(script.saves ?? [])];
  const calls: Call[] = [];
  const clock = createFakeClock();
  const navigate = vi.fn();
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, requestInit?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: requestInit?.method ?? 'GET',
        headers: new Headers(requestInit?.headers),
        body: typeof requestInit?.body === 'string' ? requestInit.body : null,
      });
      const queue = pathOf(url) === SELECTOR_PATH ? selectors : saves;
      const step = queue.shift();
      if (step === undefined) throw new Error(`unexpected request ${url}`);
      if (step instanceof Error) throw step;
      return step;
    },
  );
  const mounted = mountElement(
    <CmsEditorialEntryEditorIsland
      init={init}
      clock={clock}
      fetcher={fetcher}
      navigate={navigate}
    />,
  );
  const advance = async (milliseconds: number): Promise<void> => {
    await act(async () => {
      await clock.advance(milliseconds);
    });
  };
  const settle = async (): Promise<void> => {
    await act(async () => {
      await settleAsyncWork();
    });
  };
  return { ...mounted, calls, navigate, advance, settle };
};

describe('CmsEditorialEntryEditorIsland: the taxonomy selector read', () => {
  it('[P2-S12-AC-135] reads the first page with the server-derived type key and the draft locale', async () => {
    const first = mountEditor({ selectors: [servedPage()] });
    await first.settle();
    const gets = selectorGets(first.calls);
    expect(gets).toHaveLength(1);
    expect(pathOf(gets[0]!.url)).toBe(SELECTOR_PATH);
    expect(searchOf(gets[0]!.url)).toEqual({
      typeKey: TYPE_KEY,
      fieldKey: FIELD_KEY,
      locale: 'en-US',
      limit: '50',
    });
    const guitar = byLabel<HTMLInputElement>(first.container, 'Guitar');
    expect(guitar.getAttribute('type')).toBe('checkbox');
    expect(guitar.value).toBe(GUITAR);

    const second = mountEditor(
      { selectors: [servedPage()] },
      draftInit({ [TITLE]: 'Titre', [TOPICS]: null }, 'fr-FR'),
    );
    await second.settle();
    expect(searchOf(selectorGets(second.calls)[0]!.url).locale).toBe('fr-FR');
  });
});

describe('CmsEditorialEntryEditorIsland: writing the taxonomy value', () => {
  it('[P2-S12-AC-135] writes exactly { termIds } keyed by the stable field into the revision save, keeping other text', async () => {
    const { container, calls, settle } = mountEditor({
      selectors: [servedPage()],
      saves: [revisionCreated({ revisionNumber: '3', entryVersion: '5' })],
    });
    await settle();
    await typeIntoTitle(container, 'Now');
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await click(buttonNamed(container, 'Save draft'));
    await settle();
    const posts = savePosts(calls);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.url).toBe(`/api/v1/cms/entries/${ENTRY_ID}/revisions`);
    const body = bodyOf(posts[0]!);
    expect(Object.hasOwn(body, 'typeKey')).toBe(false);
    const values = body.values as Record<string, unknown>;
    expect(values[TOPICS]).toEqual({ termIds: [GUITAR] });
    expect(Object.keys(values[TOPICS] as object)).toEqual(['termIds']);
    expect(values[TITLE]).toBe('Now');
    expect(body.locale).toBe('en-US');
    expect(body.changedPaths).toEqual(
      [`/fields/${TOPICS}`, `/fields/${TITLE}`].sort(),
    );
  });
});

describe('CmsEditorialEntryEditorIsland: a taxonomy refusal', () => {
  it('[P2-S12-AC-135] refreshes the selector once on a verified term_unavailable, keeps the values and the stale selection, and sends nothing again', async () => {
    const { container, calls, advance, settle } = mountEditor({
      selectors: [servedPage(), servedPage()],
      saves: [
        termUnavailable(),
        revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
      ],
    });
    await settle();
    await typeIntoTitle(container, 'Now');
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await click(buttonNamed(container, 'Save draft'));
    await settle();
    expect(savePosts(calls)).toHaveLength(1);
    const gets = selectorGets(calls);
    expect(gets).toHaveLength(2);
    expect(searchOf(gets[1]!.url)).toEqual(searchOf(gets[0]!.url));
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Now',
    );
    expect(byLabel<HTMLInputElement>(container, 'Guitar').checked).toBe(true);
    expect(statusOf(container)).toContain(
      CMS_EDITORIAL_REASON_COPY.term_unavailable,
    );
    expect(statusOf(container)).not.toContain(
      'Server text that must never be shown.',
    );
    // No automatic resubmit of the same refused request.
    await advance(5_000);
    expect(savePosts(calls)).toHaveLength(1);
    // Explicit correction: clearing the stale selection is what changes it.
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await click(buttonNamed(container, 'Save draft'));
    await settle();
    const posts = savePosts(calls);
    expect(posts).toHaveLength(2);
    const values = bodyOf(posts[1]!).values as Record<string, unknown>;
    expect(values[TOPICS]).toEqual({ termIds: [] });
    expect(values[TITLE]).toBe('Now');
  });

  it('[P2-S12-AC-135] of an unknown outcome, replays the identical save under the same key and never refreshes the selector', async () => {
    const { container, calls, advance, settle } = mountEditor({
      selectors: [servedPage()],
      saves: [
        new TypeError('Failed to fetch'),
        revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
      ],
    });
    await settle();
    await typeIntoTitle(container, 'Now');
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await click(buttonNamed(container, 'Save draft'));
    await settle();
    expect(savePosts(calls)).toHaveLength(1);
    expect(selectorGets(calls)).toHaveLength(1);
    expect(statusOf(container)).toContain('could not be confirmed');
    await advance(2_000);
    const posts = savePosts(calls);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toBe(posts[0]!.body);
    expect(posts[1]!.headers.get('idempotency-key')).toBe(
      posts[0]!.headers.get('idempotency-key'),
    );
    expect(selectorGets(calls)).toHaveLength(1);
  });
});
