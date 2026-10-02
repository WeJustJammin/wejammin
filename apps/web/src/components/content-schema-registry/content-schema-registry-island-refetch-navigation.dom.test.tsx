// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTING_CONTEXT_CHANGED_EVENT } from '../../lib/client-binding';
import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import {
  islandPropsFixture,
  mountView,
  okBody,
  settle,
  unmountMountedViews,
} from './content-schema-registry-island-refetch.test-support';

const navigations = vi.hoisted(() => ({
  seen: [] as string[],
  elementAtNavigation: null as HTMLInputElement | null,
}));
vi.mock('./content-schema-registry-canonical-refresh-scheduler', async () => {
  const actual = await vi.importActual<
    typeof import('./content-schema-registry-canonical-refresh-scheduler')
  >('./content-schema-registry-canonical-refresh-scheduler');
  return {
    ...actual,
    canonicalAuthNavigate: (target: string) => {
      navigations.seen.push(target);
      navigations.elementAtNavigation =
        document.querySelector<HTMLInputElement>(
          '#content-schema-registry-confirmed',
        );
    },
  };
});

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

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  navigations.seen.length = 0;
});

afterEach(() => {
  unmountMountedViews();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('[P2-S09-AC-250] island refresh ownership and navigation commit', () => {
  it('does not let a stale completion overlap a newer context read', async () => {
    const pending: { resolve: (response: Response) => void }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            pending.push({ resolve });
          }),
      ),
    );
    mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    expect(pending.length).toBeGreaterThanOrEqual(1);

    act(() => {
      window.dispatchEvent(new Event(ACTING_CONTEXT_CHANGED_EVENT));
    });
    // A third ordinary hint arrives while the new-context read is in flight.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    // The stale (old-epoch) read completes; it must not release ownership or
    // start an overlapping read.
    await act(async () => {
      pending[0]?.resolve(
        new Response(okBody({ supportReference: 'stale' }), { status: 200 }),
      );
      await Promise.resolve();
    });
    expect(pending.length).toBe(2);
  });

  it('commits the disabled DOM before navigating on a redirect outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('sign in', { status: 401 })),
    );
    mountView(
      <ContentSchemaRegistryWorkbenchIsland {...islandPropsFixture()} />,
    );
    await settle();
    // The observer recorded the protected control at the exact navigation call.
    expect(navigations.seen.length).toBe(1);
    expect(navigations.seen[0]).toContain('/auth/sign-in');
    expect(navigations.elementAtNavigation).toBeNull();
  });
});
