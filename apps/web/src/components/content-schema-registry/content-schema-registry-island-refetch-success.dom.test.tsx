// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearClientBindingId,
  getClientBindingId,
} from '../../lib/client-binding';
import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  islandPropsFixture,
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
    default: (workbenchProps: Record<string, unknown>) =>
      ReactImport.createElement(
        actual.default as unknown as never,
        workbenchProps,
      ),
  };
});

const originalLocksDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  'locks',
);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  unmountMountedViews();
  if (originalLocksDescriptor === undefined) {
    delete (globalThis.navigator as { locks?: unknown }).locks;
  } else {
    Object.defineProperty(
      globalThis.navigator,
      'locks',
      originalLocksDescriptor,
    );
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-250] island canonical refresh success and transport', () => {
  it('announces a successful refresh with the exact live status text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(okBody(), { status: 200 })),
    );
    const view = mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    const status = view.container.querySelector('[data-cms-canonical-status]');
    expect(status?.textContent).toBe(
      'Current server-verified records refreshed.',
    );
    expect(status?.getAttribute('aria-live')).toBe('polite');
  });

  it('coalesces a metadata burst into a single protected GET', async () => {
    const fetcher = vi.fn(async () => new Response(okBody(), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    const afterKickoff = fetcher.mock.calls.length;
    await act(async () => {
      for (let index = 0; index < 6; index += 1)
        window.dispatchEvent(new Event('online'));
    });
    await settle();
    // Six concurrent hints coalesce into at most one additional protected GET.
    expect(fetcher.mock.calls.length - afterKickoff).toBeLessThanOrEqual(1);
  });

  it('issues exactly one protected GET carrying the binding header', async () => {
    const bodies = [
      okBody({ supportReference: 'a' }),
      okBody({ supportReference: 'b' }),
    ];
    let call = 0;
    Object.defineProperty(globalThis.navigator, 'locks', {
      configurable: true,
      value: {
        request: async (
          _name: string,
          _options: unknown,
          callback: (lock: { name: string }) => unknown,
        ) => callback({ name: 'seam' }),
      },
    });
    await clearClientBindingId();
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(bodies[Math.min(call++, 1)], { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    const expectedBindingId = await getClientBindingId();
    expect(fetcher.mock.calls.length).toBe(1);
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('GET');
    const headers = init.headers as Headers;
    expect(headers.get('accept')).toBe('text/html');
    expect(headers.get('cache-control')).toBe('no-store');
    expect(expectedBindingId).not.toBeNull();
    expect(headers.get('x-client-binding-id')).toBe(expectedBindingId);
  });
});
