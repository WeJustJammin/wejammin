import { afterEach, expect } from 'vitest';

import {
  flush,
  mountElement,
  unmountEveryMountedRoot,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsCompositionPage from './CmsCompositionPage';
import { listModel, withBody } from './composition-list-model.test-support';
import type { InstanceRow } from './composition-types';
import type { CompositionPageOptions } from './use-composition-page';
import {
  ENTRY_ID,
  REVISION_ID,
  entryFacts,
  selectorItem,
  selectorPage,
} from './composition.test-support';

/*
 * A scripted browser for the composition island: every request is matched by method and path, answered in order, and
 * recorded. A request nobody scripted is recorded as unexpected, so a stray call fails the test instead of passing
 * silently as a network failure.
 */
export interface Call {
  readonly method: string;
  readonly path: string;
  readonly search: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  /** The fetch options the island set, for the closing words of FE03 1042 (no-store, same-origin). */
  readonly cache: string | undefined;
  readonly credentials: string | undefined;
}
type Reply = Response | (() => Response);

/** `cmsCompositionInstancesRead` through its browser proxy: the instance-list refetch after a command (DEC-206). */
const isListRead = (method: string, pathname: string): boolean =>
  method === 'GET' &&
  /^\/api\/v1\/cms\/entries\/[^/]+\/compositions$/u.test(pathname);

/**
 * Instance-list reads are recorded in `lists`, not in `calls`: the suites that predate the list refetch (FE03 1047, 1049)
 * pin the command, entry and diff sequence in `calls`, and the list refetch is pinned through `lists`. A list read
 * nobody scripted is answered by the server model (`composition-list-model.test-support.ts`: the rows the page was given
 * and every mutation answered, a real 200) and recorded in `unscriptedLists`. A test whose command refetches the list
 * must ASSERT the refetch through `page.lists` (a count, or `noListReads(page)` for a command that must not refetch):
 * the registry below fails a test that left an unscripted read without looking at `lists` (review V20 n4: 74 tests
 * passed on an unscripted read answered 503, whether or not the refetch ran).
 */
interface Browser {
  readonly lists: readonly Call[];
  readonly unscriptedLists: readonly Call[];
  inspected: boolean;
  allowed: boolean;
}
const browsers: Browser[] = [];
afterEach(() => {
  const ignored = browsers.filter(
    (browser) =>
      browser.unscriptedLists.length > 0 &&
      !browser.inspected &&
      !browser.allowed,
  );
  browsers.length = 0;
  // A failed check must not leave the island mounted for the next test.
  if (ignored.length > 0) unmountEveryMountedRoot();
  if (ignored.length > 0)
    throw new Error(
      `${ignored.length} scripted browser(s) refetched the instance list without the test asserting it: assert page.lists (a count) or script the read [lists=${ignored.map((browser) => browser.lists.length).join(',')}]`,
    );
});

export const scriptedFetch = (
  script: Record<string, Reply[]>,
  options: { readonly rows?: readonly InstanceRow[] } = {},
) => {
  const calls: Call[] = [];
  const rawLists: Call[] = [];
  const unscriptedLists: Call[] = [];
  const unexpected: string[] = [];
  const model = listModel(options.rows ?? []);
  const browser: Browser = {
    lists: rawLists,
    unscriptedLists,
    inspected: false,
    allowed: false,
  };
  browsers.push(browser);
  // Any look at `lists` (a length, an index, an iteration) is the test asserting the refetch.
  const lists = new Proxy(rawLists, {
    get: (target, property, receiver) => {
      browser.inspected = true;
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const queues = new Map(
    Object.entries(script).map(([key, replies]) => [key, [...replies]]),
  );
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://app.example.test');
    const method = init?.method ?? 'GET';
    const key = `${method} ${url.pathname}`;
    const call: Call = {
      method,
      path: url.pathname,
      search: url.search,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      cache: init?.cache,
      credentials: init?.credentials,
    };
    const next = queues.get(key)?.shift();
    if (isListRead(method, url.pathname)) {
      rawLists.push(call);
      if (next !== undefined) return typeof next === 'function' ? next() : next;
      unscriptedLists.push(call);
      return model.answer();
    }
    calls.push(call);
    if (next === undefined) {
      unexpected.push(key);
      throw new Error(`Unscripted request ${key}`);
    }
    const reply = typeof next === 'function' ? next() : next;
    if (method === 'POST') model.observe(reply);
    return reply;
  }) as typeof fetch;
  return {
    fetcher,
    calls,
    lists,
    unscriptedLists,
    unexpected,
    /** A test about a list the island never asks for may leave its reads unasserted; it says so here. */
    allowUnscriptedLists: (): void => {
      browser.allowed = true;
    },
  };
};

/** The page asked for no instance list at all: neither a scripted nor an unscripted read. */
export const noListReads = (page: {
  readonly lists: readonly Call[];
}): void => {
  expect(page.lists.map((call) => `${call.method} ${call.path}`)).toEqual([]);
};

export const json = (body: unknown, status = 200, etag?: string): Response =>
  withBody(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        ...(etag ? { etag } : {}),
      },
    }),
    body,
  );
export const refusal = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'r',
      details,
    }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );
export const entryDetail = (
  version: string,
  extra: Record<string, unknown> = {},
): Response =>
  json(
    {
      entry: { id: ENTRY_ID, version, createdAt: 'x', updatedAt: 'x' },
      revision: {
        id: REVISION_ID,
        version: '2',
        createdAt: 'x',
        updatedAt: 'x',
      },
      revisionNumber: '2',
      lifecycle: 'active',
      state: 'draft',
      ...extra,
    },
    200,
    '"x"',
  );

export const PLACE = 'POST /api/v1/cms/compositions/pattern-instances';
export const UPDATE = 'POST /api/v1/cms/compositions/pattern-updates';
export const ENTRY = `GET /api/v1/cms/entries/${ENTRY_ID}`;
export const diffPath = (id: string): string =>
  `GET /api/v1/cms/compositions/instances/${id}/update-diff`;
export const SELECTOR = 'GET /api/v1/cms/patterns/selector';

export const mountPage = (
  script: Record<string, Reply[]>,
  options: Partial<CompositionPageOptions> = {},
) => {
  const scripted = scriptedFetch(script, { rows: options.instances ?? [] });
  const mounted = mountElement(
    <CmsCompositionPage
      entry={entryFacts()}
      selector={selectorPage([
        selectorItem('hero-block', 2),
        selectorItem('side-note', 1),
      ])}
      instances={[]}
      csrfToken="csrf-token"
      fetcher={scripted.fetcher}
      {...options}
    />,
  );
  return { ...mounted, ...scripted };
};

export const settle = async (): Promise<void> => {
  await flush();
};

export const noStrayRequests = (unexpected: readonly string[]): void => {
  expect(unexpected).toEqual([]);
};
