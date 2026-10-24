import { expect } from 'vitest';

import {
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsCompositionPage from './CmsCompositionPage';
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
}
type Reply = Response | (() => Response);

export const scriptedFetch = (script: Record<string, Reply[]>) => {
  const calls: Call[] = [];
  const unexpected: string[] = [];
  const queues = new Map(
    Object.entries(script).map(([key, replies]) => [key, [...replies]]),
  );
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://app.example.test');
    const method = init?.method ?? 'GET';
    const key = `${method} ${url.pathname}`;
    calls.push({
      method,
      path: url.pathname,
      search: url.search,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const queue = queues.get(key);
    const next = queue?.shift();
    if (next === undefined) {
      unexpected.push(key);
      throw new Error(`Unscripted request ${key}`);
    }
    return typeof next === 'function' ? next() : next;
  }) as typeof fetch;
  return { fetcher, calls, unexpected };
};

export const json = (body: unknown, status = 200, etag?: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(etag ? { etag } : {}) },
  });
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
  const scripted = scriptedFetch(script);
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
