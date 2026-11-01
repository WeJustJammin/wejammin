// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ROUTE_PAGE_LOAD_EVENT,
  installRouteHeadingFocus,
  type RouteHeadingFocusDocument,
} from './route-heading-focus';

/*
 * FE03 / P2-S11-AC-060: a route "moves focus to the heading on navigation
 * only". `installRouteHeadingFocus` is that rule for Astro client navigation:
 * the first `astro:page-load` is the browser's own initial load (its focus
 * stands), every later one is a navigation that focuses the page heading, and a
 * fragment navigation keeps the browser's fragment target.
 */

const heading = (): HTMLElement => {
  const element = document.createElement('h1');
  element.id = 'page-title';
  element.tabIndex = -1;
  document.body.appendChild(element);
  return element;
};

/** A document double: real DOM lookups, page-load events delivered by the test. */
const pageLoads = () => {
  const events = new EventTarget();
  const source: RouteHeadingFocusDocument = {
    addEventListener: (type, listener) =>
      events.addEventListener(type, listener),
    getElementById: (id) => document.getElementById(id),
  };
  return {
    source,
    load: () => events.dispatchEvent(new Event(ROUTE_PAGE_LOAD_EVENT)),
  };
};

beforeEach(() => {
  document.body.replaceChildren();
  (document.activeElement as HTMLElement | null)?.blur();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('installRouteHeadingFocus', () => {
  it('[P2-S11-AC-060] leaves the browser focus alone on the first page load', () => {
    const element = heading();
    const focus = vi.spyOn(element, 'focus');
    const loads = pageLoads();
    installRouteHeadingFocus(loads.source, { hash: '' });
    loads.load();
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it('[P2-S11-AC-060] focuses the heading, without scrolling, on every navigation after the first load', () => {
    const element = heading();
    const focus = vi.spyOn(element, 'focus');
    const loads = pageLoads();
    installRouteHeadingFocus(loads.source, { hash: '' });
    loads.load();
    loads.load();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(element);
    // A control the person moved to is not reclaimed until the next navigation.
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    expect(document.activeElement).toBe(other);
    loads.load();
    expect(focus).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(element);
  });

  it('[P2-S11-AC-060] keeps the browser fragment target when the location carries a fragment', () => {
    const element = heading();
    const focus = vi.spyOn(element, 'focus');
    const location = { hash: '' };
    const loads = pageLoads();
    installRouteHeadingFocus(loads.source, location);
    loads.load();
    // The fragment is read when the navigation completes, not when installed.
    location.hash = '#details';
    loads.load();
    expect(focus).not.toHaveBeenCalled();
    location.hash = '';
    loads.load();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('[P2-S11-AC-060] does nothing on a page without a page heading', () => {
    const loads = pageLoads();
    installRouteHeadingFocus(loads.source, { hash: '' });
    loads.load();
    expect(() => loads.load()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it('[P2-S11-AC-060] counts only the page loads of its own document, one first load each', () => {
    const element = heading();
    const focus = vi.spyOn(element, 'focus');
    const first = pageLoads();
    const second = pageLoads();
    installRouteHeadingFocus(first.source, { hash: '' });
    installRouteHeadingFocus(second.source, { hash: '' });
    first.load();
    second.load();
    expect(focus).not.toHaveBeenCalled();
    first.load();
    expect(focus).toHaveBeenCalledTimes(1);
    second.load();
    expect(focus).toHaveBeenCalledTimes(2);
  });
});

describe('route-heading-focus module wiring', () => {
  const registered: [string, EventListener][] = [];
  const realAddEventListener = EventTarget.prototype.addEventListener;

  beforeEach(() => {
    // Records what the module registers on the document so a test can remove it.
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, listener: unknown, options?: unknown) => {
        registered.push([type, listener as EventListener]);
        realAddEventListener.call(
          document,
          type,
          listener as EventListener,
          options as boolean,
        );
      },
    );
  });

  const importFresh = async (url: string): Promise<void> => {
    vi.resetModules();
    window.history.replaceState(null, '', url);
    await import('./route-heading-focus');
  };

  afterEach(() => {
    for (const [type, listener] of registered.splice(0))
      document.removeEventListener(type, listener);
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });

  it('[P2-S11-AC-060] installs on the document: the first page load keeps focus, a later navigation moves it to the heading', async () => {
    const element = heading();
    await importFresh('/');
    expect(document.activeElement).toBe(document.body);
    document.dispatchEvent(new Event(ROUTE_PAGE_LOAD_EVENT));
    expect(document.activeElement).toBe(document.body);
    document.dispatchEvent(new Event(ROUTE_PAGE_LOAD_EVENT));
    expect(document.activeElement).toBe(element);
  });

  it('[P2-S11-AC-060] does not move focus on an ordinary initial load, with or without a fragment', async () => {
    heading();
    await importFresh('/app/cms-content-modeling');
    expect(document.activeElement).toBe(document.body);
    for (const url of ['/#details', '/?tab=evidence#details']) {
      document.body.replaceChildren();
      heading();
      await importFresh(url);
      expect(document.activeElement).toBe(document.body);
    }
  });

  it('[P2-S11-AC-060] focuses the heading on an initial load that arrived by navigation (tab, selected or a commit mark)', async () => {
    for (const url of ['/?tab=evidence', '/?selected=abc']) {
      document.body.replaceChildren();
      const element = heading();
      await importFresh(url);
      expect(document.activeElement).toBe(element);
    }
    document.body.replaceChildren();
    const element = heading();
    window.sessionStorage.setItem('wj:focus-route-heading', '1');
    await importFresh('/');
    expect(document.activeElement).toBe(element);
    expect(window.sessionStorage.getItem('wj:focus-route-heading')).toBeNull();
  });
});
