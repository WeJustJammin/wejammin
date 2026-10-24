// @vitest-environment jsdom

/**
 * The create surface's taxonomy-refresh boundary at the HTTP status layer
 * (BE03b CMS-03B-10, BE03c CMS-03C-17).
 *
 * A verified 400 `INVALID_REQUEST` may carry the same `term_unavailable` token as
 * the 422 that legitimately re-reads the taxonomy selector, because
 * `cmsEditorialOutcomeForStatus` maps both 400 and 422 to the `validation`
 * outcome and `ApiErrorSchema.details` is an open bounded JsonValue record
 * (packages/contracts/src/api-error.ts). The strict scope is the VALIDATION
 * status, not the outcome class, so a 400 must not bump `taxonomyRefreshToken`:
 * no selector re-read, every value kept, no automatic create.
 *
 * The island and its real create transport are driven through the injected
 * fetcher; only `fetch` is replaced, no module is mocked. RED until the create
 * hook scopes its bump to a verified 422 VALIDATION_FAILED plus the token.
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
import { taxonomyPage } from '../cms-editorial-fields/cms-taxonomy-field-fixtures.test-support';
import CmsEditorialEntryCreateIsland from './CmsEditorialEntryCreateIsland';
import { preloadCmsEditorialTransports } from './cms-editorial-lazy-transports.test-support';

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
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const TOPICS = fieldUuid(13);

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
  readonly body: string | null;
}

const pathOf = (url: string): string => {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
};
const selectorGets = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.method === 'GET');
const createPosts = (calls: readonly Call[]): Call[] =>
  calls.filter((call) => call.method === 'POST');

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** The mount-time selector page: relayed only when its ETag IS its pageVersion. */
const servedPage = (): Response =>
  json(200, taxonomyPage([{ n: 1, termKey: 'guitar', label: 'Guitar' }]), {
    etag: '"7"',
    'cache-control': 'no-store',
  });

const created = (): Response =>
  json(
    201,
    {
      entry: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
        version: '1',
        createdAt: '2026-10-05T00:00:00+00:00',
        updatedAt: '2026-10-05T00:00:00+00:00',
      },
      revision: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
        version: '1',
        createdAt: '2026-10-05T00:00:00+00:00',
        updatedAt: '2026-10-05T00:00:00+00:00',
      },
      revisionNumber: '1',
      lifecycle: 'active',
      state: 'draft',
      locale: 'en-US',
      contentHash: 'a'.repeat(64),
      validationState: 'valid',
    },
    {
      location: '/api/v1/cms/entries/018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
      etag: '"1"',
      'cache-control': 'no-store',
    },
  );

/** A verified 400 INVALID_REQUEST that still names the taxonomy token. */
const invalidRequestTerm = (): Response =>
  json(400, {
    code: 'INVALID_REQUEST',
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
        body: typeof init?.body === 'string' ? init.body : null,
      });
      const queue = pathOf(url) === SELECTOR_PATH ? selectors : creates;
      const step = queue.shift();
      if (step === undefined) throw new Error(`unexpected request ${url}`);
      if (step instanceof Error) throw step;
      return step;
    },
  );
  const mounted = mountElement(
    <CmsEditorialEntryCreateIsland
      type={createType()}
      fields={createFields()}
      descriptors={describeCmsAuthoringFields(createFields())}
      fetcher={fetcher}
      navigate={vi.fn()}
    />,
  );
  return { ...mounted, calls };
};

const submit = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Create entry'));
  await flush();
};

describe('CmsEditorialEntryCreateIsland: the 400 taxonomy boundary', () => {
  it('[P2-S12-AC-135] does not refresh the selector for a verified 400 INVALID_REQUEST carrying term_unavailable', async () => {
    const { container, calls } = mountCreate({
      selectors: [servedPage()],
      creates: [invalidRequestTerm(), created()],
    });
    await flush();
    const mountGets = selectorGets(calls).length;
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Title (required)'),
      'Launch notes',
    );
    await click(byLabel<HTMLInputElement>(container, 'Guitar'));
    await submit(container);
    expect(createPosts(calls)).toHaveLength(1);
    // The 400 is a definite refusal: the selector is not re-read.
    expect(selectorGets(calls)).toHaveLength(mountGets);
    // Every value is kept, including the taxonomy selection.
    expect(byLabel<HTMLInputElement>(container, 'Title (required)').value).toBe(
      'Launch notes',
    );
    expect(byLabel<HTMLInputElement>(container, 'Guitar').checked).toBe(true);
    // No automatic create, and no extra read of any kind.
    await flush();
    expect(createPosts(calls)).toHaveLength(1);
    expect(selectorGets(calls)).toHaveLength(mountGets);
  });
});
