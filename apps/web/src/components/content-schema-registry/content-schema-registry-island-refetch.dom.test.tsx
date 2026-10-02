// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTING_CONTEXT_CHANGED_EVENT } from '../../lib/client-binding';
import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import { readContentSchemaRegistryCanonicalOutcome } from './content-schema-registry-canonical-read';
import {
  ACTOR_ID,
  DETAIL,
  OTHER_PARTY_ID,
  PARTY_ID,
  capturedWorkbench,
  islandMarkup,
  islandPropsFixture,
  lastWorkbenchProps,
  mountView,
  okBody,
  settle,
  unmountMountedViews,
} from './content-schema-registry-island-refetch.test-support';

vi.mock('./ContentSchemaRegistryWorkbench', async () => {
  const actual = await vi.importActual<
    typeof import('./ContentSchemaRegistryWorkbench')
  >('./ContentSchemaRegistryWorkbench');
  const ReactImport = await import('react');
  return {
    __esModule: true,
    default: (workbenchProps: Record<string, unknown>) => {
      capturedWorkbench.props.push(workbenchProps);
      const Component = actual.default as unknown as (
        props: Record<string, unknown>,
      ) => unknown;
      return ReactImport.createElement(Component as never, workbenchProps);
    },
  };
});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  capturedWorkbench.props.length = 0;
});

afterEach(() => {
  unmountMountedViews();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-250] island canonical refetch is React-owned', () => {
  it('maps a browser-seen opaque redirect to a safe sign-in navigation', async () => {
    const opaque = new Response(null, { status: 200 });
    Object.defineProperty(opaque, 'type', { value: 'opaqueredirect' });
    Object.defineProperty(opaque, 'status', { value: 0 });
    Object.defineProperty(opaque, 'ok', { value: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => opaque),
    );
    const outcome = await readContentSchemaRegistryCanonicalOutcome(
      document,
      '/app/cms-content-modeling/x?limit=25',
    );
    expect(outcome.kind).toBe('navigate');
    if (outcome.kind === 'navigate')
      expect(outcome.target).toContain('/auth/sign-in');
  });

  it('recovers from network and malformed reads to a safe disabled gate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network unavailable');
      }),
    );
    const networkView = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    expect(
      networkView.container.querySelector(
        '[data-workbench="content-schema-registry"]',
      ),
    ).toBeNull();

    unmountMountedViews();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html><body>nope</body></html>')),
    );
    const malformedView = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    expect(
      malformedView.container.querySelector(
        '[data-workbench="content-schema-registry"]',
      ),
    ).toBeNull();
  });

  it('removes protected UI on a 403 denial and focuses the safe boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Forbidden', { status: 403 })),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    expect(
      view.container.querySelector(
        '[data-workbench="content-schema-registry"]',
      ),
    ).toBeNull();
    expect(view.container.textContent).toContain('Schema changes unavailable');
    expect(document.activeElement?.textContent).toBe(
      'Schema changes unavailable',
    );
  });

  it('restores focus to a stable locator after a successful refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(okBody(), { status: 200 })),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    const field = view.container.querySelector<HTMLInputElement>(
      '#content-schema-registry-dry-run-id',
    );
    expect(field).not.toBeNull();
    field?.focus();
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(document.activeElement?.id).toBe(
      'content-schema-registry-dry-run-id',
    );
  });

  it('clears protected controls before a stale response lands, then applies the new context', async () => {
    let call = 0;
    const bodies = [
      okBody({ requestId: 'old' }),
      okBody({
        actingPartyId: OTHER_PARTY_ID,
        actingContextLabel: 'Other Collective',
        requestId: 'new',
      }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(bodies[Math.min(call++, 1)], { status: 200 }),
      ),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    expect(view.container.textContent).toContain('Northwind Collective');

    await act(async () => {
      window.dispatchEvent(new Event(ACTING_CONTEXT_CHANGED_EVENT));
    });
    await settle();
    expect(view.container.textContent).toContain('Other Collective');
    const consumed = lastWorkbenchProps();
    // #4 proof: the consumer received the CURRENT validated tuple, not SSR props.
    expect(consumed.actorId).toBe(ACTOR_ID);
    expect(consumed.actingPartyId).toBe(OTHER_PARTY_ID);
    expect(consumed.expectedVersion).toBe('1');
  });

  it('disables controls immediately on context change, ignoring the in-flight read', async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    act(() => {
      window.dispatchEvent(new Event(ACTING_CONTEXT_CHANGED_EVENT));
    });
    expect(
      view.container.querySelector(
        '[data-workbench="content-schema-registry"]',
      ),
    ).toBeNull();
    await act(async () => {
      release(new Response(okBody({ requestId: 'late' }), { status: 200 }));
      await Promise.resolve();
    });
    expect(
      view.container.querySelector(
        '[data-workbench="content-schema-registry"]',
      ),
    ).toBeNull();
  });

  it('does not inherit omitted label or step-up fields from the original SSR props', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            islandMarkup({
              state: 'ready',
              variant: 'ownerFull',
              access: 'full',
              actorId: ACTOR_ID,
              actingPartyId: PARTY_ID,
              requestId: 'omitted',
              initialList: { status: 'empty', reason: 'no-records' },
              initialDetail: {
                status: 'success',
                data: DETAIL,
                version: '1',
                stale: false,
              },
            }),
            { status: 200 },
          ),
      ),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    const consumed = lastWorkbenchProps();
    expect(consumed.actingContextLabel).toBeUndefined();
    expect(consumed.stepUpState).toBeUndefined();
    expect(consumed.stepUpFreshUntil).toBeUndefined();
    const text = view.container.textContent ?? '';
    expect(text).toContain('Server-verified acting context unavailable');
    expect(text).toContain('Step-up required before commit');
    expect(text).not.toContain('Verified until');
  });

  it('shows an offline notice and marks the region busy during refresh', async () => {
    vi.useFakeTimers();
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(view.container.textContent).toContain('Registry is offline');
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(
      view.container.querySelector('[data-cms-loading-skeleton]'),
    ).not.toBeNull();
    expect(
      view.container
        .querySelector('[data-workbench="content-schema-registry"]')
        ?.getAttribute('aria-busy'),
    ).toBe('true');
    await act(async () => {
      release(new Response(okBody(), { status: 200 }));
      await Promise.resolve();
    });
    vi.useRealTimers();
    expect(
      view.container.querySelector('[data-cms-loading-skeleton]'),
    ).toBeNull();
  });

  it('re-arms the 429 countdown when a new canonical projection keeps the same retry-after', async () => {
    const bodies = [
      okBody({
        initialDetail: {
          status: 'error',
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests.',
            requestId: 'a',
          },
          retryable: true,
          retryAfterSeconds: 3,
        },
      }),
      okBody({
        initialDetail: {
          status: 'error',
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests.',
            requestId: 'b',
          },
          retryable: true,
          retryAfterSeconds: 3,
        },
      }),
    ];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(bodies[Math.min(call++, 1)], { status: 200 }),
      ),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    expect(view.container.textContent).toContain('Retry');
    expect(
      view.container.querySelector('[data-retry-after-seconds]')?.textContent,
    ).toBeDefined();
  });
});
