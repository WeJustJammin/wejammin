import { act } from 'react';
import { vi } from 'vitest';

import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import {
  buttonNamed,
  byLabel,
  click,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { draftDetail } from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  ENTRY_ID,
  id,
  mount,
  submitStub,
} from './related-content.test-support';

export const DRAFT_PATH = `/api/v1/cms/entries/${ENTRY_ID}`;
export const RULE_PATH = `/api/v1/cms/entries/${ENTRY_ID}/related-content`;
export const SNAPSHOT_SELECTOR =
  'section[aria-labelledby="cms-related-server-heading"]';

export const name = (n: number): string => `entry ${id(n).slice(-12)}`;
export const heading = (container: HTMLElement): string =>
  container.querySelector('#cms-related-result-heading')?.textContent ?? '';
export const boundField = (container: HTMLElement): HTMLInputElement =>
  byLabel(container, /Most entries the rule may choose/u) as HTMLInputElement;
export const sent = (stub: ReturnType<typeof submitStub>, call = 0) =>
  stub.mock.calls[call] as unknown as [
    RelatedContentRuleRequest,
    string,
    string,
  ];
export const localVersion = (container: HTMLElement): string | null =>
  Array.from(container.querySelectorAll('form > dl dt')).find(
    (term) => term.textContent === 'Entry version',
  )?.nextElementSibling?.textContent ?? null;
export const reviewMessage = (container: HTMLElement): string =>
  container.querySelector(
    'section[aria-label="Related content conflict review"] > [role="status"]',
  )?.textContent ?? '';

export const conflictedDraft = async (
  submit: ReturnType<typeof submitStub>,
) => {
  const mounted = mount({ submit });
  await click(buttonNamed(mounted.container, `Pin ${name(1)}`));
  await click(byLabel(mounted.container, /Shared terms/u));
  await typeInto(boundField(mounted.container), '12');
  await click(buttonNamed(mounted.container, 'Save related content'));
  return mounted;
};

export const json = (
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** The strict CMS-03B-11 200 whose strong ETag binds the entry version. */
export const draftAnswer = (entryVersion: string): Response =>
  draftDetail({ entryVersion, revisionNumber: '5', values: {} });

/** A real-shaped saved rule, with server-only fixtures supplied through `extra`. */
export const ruleAnswer = (extra: Record<string, unknown> = {}): Response => {
  const rule = {
    id: id(9),
    version: '9',
    contentHash: 'b'.repeat(64),
    createdAt: '2026-10-15T12:00:00Z',
    updatedAt: '2026-10-15T12:00:00Z',
    state: 'active',
    sourceEntryId: ENTRY_ID,
    pins: [id(2)],
    exclusions: [],
    derivedRule: { key: 'shared-terms', version: '1' },
    eligibleCount: 2,
    ...extra,
  };
  return json(
    { rule },
    { etag: `"${rule.version}"`, 'cache-control': 'no-store' },
  );
};
export const noRuleAnswer = (): Response => json({ rule: null });
export const rateLimited = (seconds: number): Response =>
  new Response(
    JSON.stringify({
      code: 'RATE_LIMITED',
      message: 'x',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: { retryAfterSeconds: seconds },
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(seconds),
      },
    },
  );

/** No precondition, media type, CSRF or idempotency belongs on either review GET. */
export const PROHIBITED_READ_HEADERS = [
  'if-match',
  'if-none-match',
  'if-modified-since',
  'idempotency-key',
  'x-csrf-token',
  'content-type',
] as const;

interface Read {
  readonly url: string;
  readonly path: string;
  readonly method: string;
  readonly headers: Headers;
  readonly init: RequestInit | undefined;
}
const absolute = (input: RequestInfo | URL): string =>
  input instanceof Request
    ? input.url
    : new URL(
        input instanceof URL ? input.href : String(input),
        'https://web.test',
      ).href;
export const pathOf = (input: RequestInfo | URL): string =>
  new URL(absolute(input)).pathname;
export const reads = (fetcher: ReturnType<typeof vi.fn>): Read[] =>
  (fetcher.mock.calls as unknown as [RequestInfo | URL, RequestInit?][]).map(
    ([input, init]) => {
      const url = absolute(input);
      return {
        url,
        path: new URL(url).pathname,
        method:
          init?.method ?? (input instanceof Request ? input.method : 'GET'),
        headers: new Headers(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined),
        ),
        init,
      };
    },
  );
export const canonicalReads = (
  answers: Readonly<Record<string, () => Response | Promise<Response>>>,
) =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const answer = answers[pathOf(input)];
    if (answer === undefined)
      throw new Error(`unexpected read ${pathOf(input)}`);
    return answer();
  });

/** `abort-ignores` really delivers a still-pending answer after cancellation. */
export const controllingFetch = (
  mode: 'abort-rejects' | 'abort-ignores' = 'abort-rejects',
) => {
  const signals: AbortSignal[] = [];
  const releases: Array<(response: Response) => void> = [];
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    const signal = init?.signal as AbortSignal;
    signals.push(signal);
    return new Promise<Response>((resolve, reject) => {
      releases.push(resolve);
      if (mode === 'abort-rejects')
        signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        );
    });
  });
  return { fetcher, signals, releases };
};

export const settle = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

export const nativeSubmit = async (container: HTMLElement): Promise<void> => {
  const form = container.querySelector('form');
  if (form === null) throw new Error('Expected the real related-content form');
  await act(async () => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
};

export const dependencyFailure = (retryable = true): Response =>
  new Response(
    JSON.stringify({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Server detail must not render',
      requestId: '50000000-0000-4000-8000-000000000005',
      details: { retryable },
    }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  );
