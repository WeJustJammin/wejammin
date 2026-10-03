// @vitest-environment jsdom

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ALIAS_CONTEXT_ID,
  ALIAS_PARTY_ID,
  cleanupMounted,
  flushAsyncWork,
  installBrowserState,
  mountIsland,
  restoreReactActEnvironment,
  sessionResource,
  CLIENT_BINDING_ID_STORAGE_KEY,
  initial,
  SELF_CONTEXT_ID,
} from './acting-context-test-support';

let browserState: ReturnType<typeof installBrowserState>;

beforeEach(() => {
  browserState = installBrowserState();
});

afterEach(() => {
  cleanupMounted(browserState.locks);
  vi.restoreAllMocks();
});

afterAll(restoreReactActEnvironment);

type RecordedCall = Readonly<{ input: RequestInfo | URL; init?: RequestInit }>;

const requestUrl = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : String(input);

describe('acting context island session', () => {
  it('waits for the tab lock before the first authenticated request', async () => {
    let releaseLock: () => void = () => undefined;
    const lockReady = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    browserState = installBrowserState(() => lockReady);
    const requestedUrls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(requestUrl(input));
      return requestedUrls.length === 1
        ? Response.json(sessionResource())
        : Response.json(initial);
    });
    vi.stubGlobal('fetch', fetcher);

    const { container } = mountIsland();
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="acting-context-indicator"]')
        ?.textContent,
    ).toContain('Checking');

    releaseLock();
    await flushAsyncWork();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(requestedUrls[0]).toBe('/api/v1/auth/session');
  });

  it('keeps context reads unavailable if this browser has no tab lock manager', async () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
    const fetcher = vi.fn(async () => Response.json(sessionResource()));
    vi.stubGlobal('fetch', fetcher);

    const { container } = mountIsland();
    await flushAsyncWork();

    expect(fetcher).not.toHaveBeenCalled();
    expect(
      container
        .querySelector('[data-testid="acting-context-indicator"]')
        ?.getAttribute('data-context-id'),
    ).toBe('unverified');
    const select = container.querySelector(
      '#acting-context-select',
    ) as HTMLSelectElement | null;
    expect(select?.disabled).toBe(true);
  });

  it('reconciles the selected party from the locked server session after reload', async () => {
    const clientBindingId = '44444444-4444-4444-8444-444444444444';
    window.sessionStorage.setItem(
      CLIENT_BINDING_ID_STORAGE_KEY,
      clientBindingId,
    );
    const calls: RecordedCall[] = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(init === undefined ? { input } : { input, init });
        if (requestUrl(input).endsWith('/api/v1/auth/session'))
          return Response.json(sessionResource(ALIAS_PARTY_ID));
        return Response.json(initial);
      },
    );
    vi.stubGlobal('fetch', fetcher);

    const { container } = mountIsland();
    await flushAsyncWork();

    const indicator = container.querySelector<HTMLElement>(
      '[data-testid="acting-context-indicator"]',
    );
    expect(indicator?.getAttribute('data-context-id')).toBe(ALIAS_CONTEXT_ID);
    expect(indicator?.textContent).toContain('Neon Harbor');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(requestUrl(calls[0]?.input as RequestInfo | URL)).toBe(
      '/api/v1/auth/session',
    );
    expect(requestUrl(calls[1]?.input as RequestInfo | URL)).toBe(
      '/api/v1/me/acting-contexts',
    );
    for (const call of calls)
      expect(new Headers(call.init?.headers).get('x-client-binding-id')).toBe(
        clientBindingId,
      );
  });

  it('reclaims and revalidates the context when a BFCache page resumes', async () => {
    let sessionReads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (requestUrl(input).endsWith('/api/v1/auth/session')) {
        sessionReads += 1;
        return Response.json(
          sessionResource(sessionReads === 1 ? ALIAS_PARTY_ID : null),
        );
      }
      return Response.json(initial);
    });
    vi.stubGlobal('fetch', fetcher);
    const { container } = mountIsland();
    await flushAsyncWork();
    expect(
      container
        .querySelector('[data-testid="acting-context-indicator"]')
        ?.getAttribute('data-context-id'),
    ).toBe(ALIAS_CONTEXT_ID);

    const pagehide = new Event('pagehide');
    Object.defineProperty(pagehide, 'persisted', { value: true });
    window.dispatchEvent(pagehide);
    await flushAsyncWork();
    const pageshow = new Event('pageshow');
    Object.defineProperty(pageshow, 'persisted', { value: true });
    window.dispatchEvent(pageshow);
    await flushAsyncWork();

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      container
        .querySelector('[data-testid="acting-context-indicator"]')
        ?.getAttribute('data-context-id'),
    ).toBe(SELF_CONTEXT_ID);
  });

  it.each([
    ['CONTEXT_REVOKED', 403],
    ['CONTEXT_RECONFIRM_REQUIRED', 403],
    ['CONTEXT_NOT_FOUND', 404],
  ] as const)(
    'clears only this tab and confirms self after %s',
    async (code, status) => {
      const clientBindingId = '55555555-5555-4555-8555-555555555555';
      window.sessionStorage.setItem(
        CLIENT_BINDING_ID_STORAGE_KEY,
        clientBindingId,
      );
      window.sessionStorage.setItem('unrelated-tab-state', 'keep-me');
      // r14: a context the server no longer honours also drops the pending
      // step-up envelope, so the self context never inherits its key.
      window.sessionStorage.setItem(
        'wj:cms-grants:step-up-return',
        JSON.stringify({ kind: 'grant', grantId: null, idempotencyKey: 'k1' }),
      );
      window.localStorage.setItem(
        CLIENT_BINDING_ID_STORAGE_KEY,
        'other-tab-binding',
      );
      const calls: RecordedCall[] = [];
      const fetcher = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          calls.push(init === undefined ? { input } : { input, init });
          if (requestUrl(input).endsWith('/api/v1/auth/session')) {
            const sessionReads = calls.filter((call) =>
              requestUrl(call.input).endsWith('/api/v1/auth/session'),
            ).length;
            if (sessionReads === 1)
              return Response.json(
                {
                  code,
                  details: {},
                  message: 'The acting context is no longer available.',
                  requestId: '66666666-6666-4666-8666-666666666666',
                },
                { status },
              );
            return Response.json(sessionResource());
          }
          return Response.json(initial);
        },
      );
      vi.stubGlobal('fetch', fetcher);

      const { container } = mountIsland();
      await flushAsyncWork();

      expect(fetcher).toHaveBeenCalledTimes(3);
      const originalHeader = new Headers(calls[0]?.init?.headers).get(
        'x-client-binding-id',
      );
      const retriedHeader = new Headers(calls[1]?.init?.headers).get(
        'x-client-binding-id',
      );
      expect(originalHeader).toBe(clientBindingId);
      expect(retriedHeader).not.toBe(clientBindingId);
      expect(
        new Headers(calls[2]?.init?.headers).get('x-client-binding-id'),
      ).toBe(retriedHeader);
      expect(window.sessionStorage.getItem('unrelated-tab-state')).toBe(
        'keep-me',
      );
      expect(
        window.sessionStorage.getItem('wj:cms-grants:step-up-return'),
      ).toBeNull();
      expect(window.localStorage.getItem(CLIENT_BINDING_ID_STORAGE_KEY)).toBe(
        'other-tab-binding',
      );
      expect(
        container
          .querySelector('[data-testid="acting-context-indicator"]')
          ?.getAttribute('data-context-id'),
      ).toBe(SELF_CONTEXT_ID);
      expect(
        container.querySelector('[data-testid="acting-context-reverted"]')
          ?.textContent,
      ).toContain('server confirmed My profile');
    },
  );

  it.each([
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['DEPENDENCY_UNAVAILABLE', 503],
  ] as const)(
    'does not clear this tab binding or retry after unrelated %s errors',
    async (code, status) => {
      const clientBindingId = '77777777-7777-4777-8777-777777777777';
      window.sessionStorage.setItem(
        CLIENT_BINDING_ID_STORAGE_KEY,
        clientBindingId,
      );
      const fetcher = vi.fn(async () =>
        Response.json(
          {
            code,
            details: {},
            message: 'The request could not be completed.',
            requestId: '88888888-8888-4888-8888-888888888888',
          },
          { status },
        ),
      );
      vi.stubGlobal('fetch', fetcher);

      const { container } = mountIsland();
      await flushAsyncWork();

      expect(fetcher).toHaveBeenCalledOnce();
      expect(window.sessionStorage.getItem(CLIENT_BINDING_ID_STORAGE_KEY)).toBe(
        clientBindingId,
      );
      expect(
        container.querySelector('[data-testid="acting-context-reverted"]'),
      ).toBeNull();
      expect(
        container
          .querySelector('[data-testid="acting-context-indicator"]')
          ?.getAttribute('data-context-id'),
      ).toBe('unverified');
    },
  );
});
