// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  ACTOR_ID,
  DETAIL,
  PARTY_ID,
  RESOURCE,
  capturedWorkbench,
  islandMarkup,
  islandPropsFixture,
  mountView,
  settle,
  unmountMountedViews,
} from './content-schema-registry-island-refetch.test-support';

/**
 * [P2-S09-AC-250] Strong, actual-DOM feedback tests for the canonical refetch
 * island. Every assertion reads a real value (activeElement, disabled state,
 * rendered countdown digits) from the actual React Workbench, never presence.
 *
 * The Workbench module is partial-mocked only to capture the props the island
 * passes downstream; the real component still renders (existing principle).
 */

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

const emptyList = { status: 'empty', reason: 'no-records' } as const;

const detailSuccess = {
  status: 'success',
  data: DETAIL,
  version: '1',
  stale: false,
} as const;

const detailWithLabel = (label: string) => ({
  status: 'success',
  data: { ...DETAIL, resource: { ...RESOURCE, label } },
  version: '1',
  stale: false,
});

const rateLimitedList = (requestId: string, retryAfterSeconds: number) => ({
  status: 'error',
  error: { code: 'RATE_LIMITED', message: 'Too many requests.', requestId },
  retryable: true,
  httpStatus: 429,
  retryAfterSeconds,
});

const readyMarkup = (overrides: Record<string, unknown>): string =>
  islandMarkup({
    state: 'ready',
    variant: 'ownerFull',
    access: 'full',
    actorId: ACTOR_ID,
    actingPartyId: PARTY_ID,
    actingContextLabel: 'Northwind Collective',
    stepUpState: 'verified',
    stepUpFreshUntil: '2026-10-01T12:05:00.000Z',
    requestId: 'r',
    initialList: emptyList,
    initialDetail: detailSuccess,
    ...overrides,
  });

const sequentialFetch = (
  bodies: readonly string[],
): ReturnType<typeof vi.fn> => {
  let call = 0;
  return vi.fn(async () => {
    const body = bodies[Math.min(call, bodies.length - 1)] ?? '';
    call += 1;
    return new Response(body, { status: 200 });
  });
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  capturedWorkbench.props.length = 0;
});

afterEach(() => {
  unmountMountedViews();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-250] island canonical refetch actual DOM feedback', () => {
  it('restores focus to the exact same stable field after a successful refresh', async () => {
    const fetcher = sequentialFetch([
      readyMarkup({
        initialDetail: detailWithLabel('Before refresh'),
        requestId: 'before',
      }),
      readyMarkup({
        initialDetail: detailWithLabel('After refresh'),
        requestId: 'after',
      }),
    ]);
    vi.stubGlobal('fetch', fetcher);

    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();

    // Establish a stable, keyed control inside the protected workbench.
    const field = view.container.querySelector<HTMLInputElement>(
      '#content-schema-registry-dry-run-id',
    );
    expect(field).not.toBeNull();
    field?.focus();
    expect(document.activeElement).toBe(field);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();

    // The refresh actually replaced the record with new canonical content.
    expect(view.container.textContent).toContain('After refresh');
    expect(view.container.textContent).not.toContain('Before refresh');
    expect(fetcher.mock.calls.length).toBe(2);

    // A successful refresh must not move focus: the previously focused stable
    // field is still the active element, and it is the live node the refreshed
    // tree actually contains (never a detached stale node).
    const refreshed = view.container.querySelector<HTMLInputElement>(
      '#content-schema-registry-dry-run-id',
    );
    expect(refreshed).not.toBeNull();
    expect(view.container.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(refreshed);
    expect(document.activeElement?.id).toBe(
      'content-schema-registry-dry-run-id',
    );
    expect(document.activeElement?.tagName).toBe('INPUT');
  });

  it('removes every protected control on a 403 and focuses the safe boundary heading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Forbidden', { status: 403 })),
    );

    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();

    // Protected surfaces are gone.
    expect(
      view.container.querySelector(
        '[data-workbench="content-schema-registry"]',
      ),
    ).toBeNull();
    expect(
      view.container.querySelector('#content-schema-registry-activation-form'),
    ).toBeNull();
    expect(
      view.container.querySelector('#content-schema-registry-dry-run-id'),
    ).toBeNull();

    // The safe capability boundary is the only remaining authority message.
    const heading = view.container.querySelector<HTMLElement>(
      '#content-schema-registry-capability-heading',
    );
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Schema changes unavailable');
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
    expect(document.activeElement?.id).toBe(
      'content-schema-registry-capability-heading',
    );
  });

  it('counts a 429 down to an enabled retry, then re-arms on a same retry-after 429', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
    const fetcher = sequentialFetch([
      readyMarkup({
        initialList: rateLimitedList('a', 3),
        initialDetail: null,
        requestId: 'a',
      }),
      readyMarkup({
        initialList: rateLimitedList('b', 3),
        initialDetail: null,
        requestId: 'b',
      }),
    ]);
    vi.stubGlobal('fetch', fetcher);

    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    // Flush the 0ms kickoff read and its async body parse.
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const countdown = () =>
      view.container
        .querySelector('[data-retry-after-seconds]')
        ?.getAttribute('data-retry-after-seconds');
    const disabledRetry = () =>
      view.container.querySelector('[data-cms-retry-control="disabled"]');
    const enabledRetry = () =>
      view.container.querySelector('[data-cms-retry-control="enabled"]');

    // Armed at the exact server value, retry strictly disabled.
    expect(countdown()).toBe('3');
    expect(view.container.textContent).toContain(
      'Retry available in 3 seconds.',
    );
    expect(disabledRetry()).not.toBeNull();
    expect(disabledRetry()?.getAttribute('disabled')).not.toBeNull();
    expect(enabledRetry()).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(countdown()).toBe('2');

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(countdown()).toBe('1');
    expect(disabledRetry()).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    // Deadline reached: the control flips from a disabled button to a live link.
    expect(countdown()).toBe('0');
    expect(disabledRetry()).toBeNull();
    const live = enabledRetry() as HTMLAnchorElement | null;
    expect(live).not.toBeNull();
    expect(live?.tagName).toBe('A');
    expect(live?.getAttribute('href')).toContain('/app/cms-content-modeling/');
    expect(view.container.textContent).toContain('Retry is available now.');

    // A second canonical 429 carrying the SAME retry-after must re-arm the
    // deadline to 3 rather than staying expired.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(countdown()).toBe('3');
    expect(disabledRetry()).not.toBeNull();
    expect(enabledRetry()).toBeNull();
    expect(fetcher.mock.calls.length).toBe(2);
  });
});
