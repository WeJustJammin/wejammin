// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { saveStepUpDraft } from '../identity-authority/step-up-mfa/step-up-draft';
import {
  createHydrationFence,
  type HydrationFence,
} from './content-schema-registry-hydration-fence';
import {
  islandPropsFixture,
  okBody,
} from './content-schema-registry-island-refetch.test-support';
import { stepUpDraftScope } from './content-schema-registry-step-up-scope';
import { useContentSchemaRegistryIslandRuntime } from './use-content-schema-registry-island-runtime';

/**
 * The detail, review and editor views are loaded on demand in the browser, so
 * a hydrating route keeps their server HTML until the chunk arrives. A step-up
 * draft restored into that HTML before React has hydrated it is discarded when
 * React client-renders the boundary. This is the production composition: the
 * server renders eagerly (as the Astro server and Vitest do), the browser
 * hydrates with the lazy views (as the production client bundle does), and the
 * restore must survive. The island holds the restore until the lazy boundaries
 * have hydrated.
 */

const RESTORED = 'Verification complete. Review and confirm to continue.';
const locks = createMemoryLockManager();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
  window.history.replaceState({}, '', '/app/cms-content-modeling');
  // The mount read answers the same canonical page the server rendered.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(okBody(), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  locks.releaseAll();
  document.body.replaceChildren();
});

const serverHtml = async (): Promise<string> => {
  vi.stubEnv('MODE', 'test');
  const { default: Island } =
    await import('./ContentSchemaRegistryWorkbenchIsland');
  return renderToString(<Island {...islandPropsFixture()} />);
};

const clientIsland = async () => {
  // The production client bundle: not the server, not a test, so lazy views.
  vi.resetModules();
  vi.stubEnv('MODE', 'production');
  return (await import('./ContentSchemaRegistryWorkbenchIsland')).default;
};

const saveDraft = (): void => {
  saveStepUpDraft(
    window.sessionStorage,
    stepUpDraftScope('/app/cms-content-modeling', 'CMS-03A-02'),
    {
      values: { key: 'headline' },
      idempotencyKey: 'key-original',
      expectedVersion: null,
    },
  );
};

describe('[P2-S09-AC-261] lazy views hydrate before the island edits their DOM', () => {
  it('[P2-S09-AC-261] a step-up draft saved before the detour is restored after the lazy views hydrate, and the announcement survives', async () => {
    const html = await serverHtml();
    expect(html).toContain('content-schema-registry-field-form');
    saveDraft();
    const Island = await clientIsland();
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Island {...islandPropsFixture()} />);
      await Promise.resolve();
    });
    await vi.waitFor(
      () =>
        expect(
          container.querySelector('[data-cms-command-status]')?.textContent,
        ).toBe(RESTORED),
      { timeout: 5_000 },
    );
    const key = container.querySelector<HTMLInputElement>(
      '#content-schema-registry-field-form input[name="key"]',
    );
    expect(key?.value).toBe('headline');
    // The restore is consumed, and the workbench reports itself hydrated only
    // once the enhancement owns the forms.
    expect(
      window.sessionStorage.getItem(
        `wj-step-up-draft:${stepUpDraftScope('/app/cms-content-modeling', 'CMS-03A-02')}`,
      ),
    ).toBeNull();
    expect(
      container
        .querySelector('[data-workbench="content-schema-registry"]')
        ?.getAttribute('data-content-schema-registry-hydrated'),
    ).toBe('true');
    act(() => root?.unmount());
  });

  it('[P2-S09-AC-261] the island runtime reports hydrated, enhances forms and reads the canonical page only after every expected lazy boundary has hydrated', async () => {
    document.body.innerHTML =
      '<section data-workbench="content-schema-registry"><form data-cms-command-form data-operation-id="CMS-03A-01" action="/x"><input name="typeKey" id="t"></form></section>';
    saveDraft();
    const fence = createHydrationFence();
    fence.expect(1);
    const fetchSpy = vi.fn(async () => new Response(okBody(), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const Probe = ({ gate }: { readonly gate: HydrationFence }): null => {
      useContentSchemaRegistryIslandRuntime(islandPropsFixture(), true, gate);
      return null;
    };
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const root = createRoot(mount);
    await act(async () => {
      root.render(<Probe gate={fence} />);
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    const marker = document.querySelector(
      '[data-workbench="content-schema-registry"]',
    );
    // A lazy boundary is still dehydrated: nothing is enhanced, announced or
    // read, and the saved draft is untouched.
    expect(marker?.getAttribute('data-content-schema-registry-hydrated')).toBe(
      null,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-cms-command-status]')).toBeNull();
    expect(window.sessionStorage.length).toBeGreaterThan(0);
    await act(async () => {
      fence.ready();
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(marker?.getAttribute('data-content-schema-registry-hydrated')).toBe(
      'true',
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    act(() => root.unmount());
  });
});

describe('[P2-S09-AC-261] hydration fence', () => {
  const fence = (): HydrationFence => createHydrationFence();

  it('[P2-S09-AC-261] is ready at once when no lazy boundary is expected', () => {
    const callback = vi.fn();
    fence().whenReady(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-261] waits for every expected boundary, in either order of report', () => {
    const subject = fence();
    const callback = vi.fn();
    subject.expect(2);
    subject.whenReady(callback);
    subject.ready();
    expect(callback).not.toHaveBeenCalled();
    subject.ready();
    expect(callback).toHaveBeenCalledTimes(1);

    const early = fence();
    const earlyCallback = vi.fn();
    early.ready();
    early.expect(1);
    early.whenReady(earlyCallback);
    expect(earlyCallback).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-261] runs a waiting callback once and never after it is cancelled', () => {
    const subject = fence();
    const once = vi.fn();
    const cancelled = vi.fn();
    subject.expect(1);
    subject.whenReady(once);
    const cancel = subject.whenReady(cancelled);
    cancel();
    subject.ready();
    subject.ready();
    expect(once).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-261] a fence with a lower expectation than reports is ready', () => {
    const subject = fence();
    const callback = vi.fn();
    subject.ready();
    subject.ready();
    subject.expect(1);
    subject.whenReady(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
