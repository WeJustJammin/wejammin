// @vitest-environment jsdom
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HYDRATED_ATTRIBUTE,
  REGION_ATTRIBUTE,
  installLazyIntent,
  markRegionHydrated,
  resetLazyIntentForTest,
  takePreHydrationValue,
  whenRegionIntent,
} from './cms-lazy-intent';

/*
 * P2-S11-AC-106 / FE03 "Performance budgets and loading strategy" (lazy modules "load on explicit
 * entry/visibility"): a form that is not part of the cold load loads on the first sign of intent in
 * its region (pointer over, press, touch, focus, key, a control change). The server markup stays in place until the
 * chunk arrives, and a submit that happens before the form hydrates must not navigate: it is held,
 * the region is armed, and the submit is replayed once the form has hydrated.
 */
beforeEach(installLazyIntent);

afterEach(() => {
  resetLazyIntentForTest();
  document.body.replaceChildren();
});

const tick = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const addRegion = (region: string, extra = ''): HTMLElement => {
  const host = document.createElement('section');
  host.setAttribute(REGION_ATTRIBUTE, region);
  host.innerHTML = `<form><button type="submit">Go</button></form><input aria-label="x" ${extra} />`;
  document.body.appendChild(host);
  return host;
};

const settled = async (promise: Promise<void>): Promise<boolean> => {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await tick(5);
  return done;
};

describe('whenRegionIntent', () => {
  it('resolves at once when no server markup of the region is in the document (a client mount)', async () => {
    expect(await settled(whenRegionIntent('absent'))).toBe(true);
  });

  it('waits while the region is in the document and nobody has shown intent', async () => {
    addRegion('decision');
    expect(await settled(whenRegionIntent('decision'))).toBe(false);
  });

  it.each(['pointerover', 'pointerdown', 'touchstart', 'focusin', 'keydown'])(
    'resolves on %s inside the region and only for that region',
    async (type) => {
      const host = addRegion('decision');
      const other = addRegion('assign');
      const decision = whenRegionIntent('decision');
      const assign = whenRegionIntent('assign');
      host
        .querySelector('input')!
        .dispatchEvent(new Event(type, { bubbles: true }));
      expect(await settled(decision)).toBe(true);
      expect(await settled(assign)).toBe(false);
      expect(other).not.toBeNull();
    },
  );

  it('ignores intent outside every region', async () => {
    addRegion('decision');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const waiting = whenRegionIntent('decision');
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(await settled(waiting)).toBe(false);
  });

  it('stays resolved once armed, and a hydrated region no longer waits', async () => {
    const host = addRegion('decision');
    const first = whenRegionIntent('decision');
    host.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(await settled(first)).toBe(true);
    expect(await settled(whenRegionIntent('decision'))).toBe(true);
    resetLazyIntentForTest();
    const second = addRegion('assign');
    markRegionHydrated(second);
    expect(second.hasAttribute(HYDRATED_ATTRIBUTE)).toBe(true);
    expect(await settled(whenRegionIntent('assign'))).toBe(true);
  });

  it('arms every region named on one element', async () => {
    const host = addRegion('a b');
    const a = whenRegionIntent('a');
    const b = whenRegionIntent('b');
    host.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(await settled(a)).toBe(true);
    expect(await settled(b)).toBe(true);
  });
});

describe('what does not arm a region', () => {
  it('is not armed by visibility: no IntersectionObserver is ever created', async () => {
    const created = vi.fn();
    class Spy {
      constructor() {
        created();
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', Spy);
    addRegion('decision');
    expect(await settled(whenRegionIntent('decision'))).toBe(false);
    expect(created).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('is not armed by time', async () => {
    vi.useFakeTimers();
    addRegion('decision');
    const waiting = whenRegionIntent('decision');
    let done = false;
    void waiting.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    vi.useRealTimers();
    expect(done).toBe(false);
  });

  it.each(['scroll', 'resize', 'load', 'visibilitychange'])(
    'is not armed by %s',
    async (type) => {
      const host = addRegion('decision');
      const waiting = whenRegionIntent('decision');
      host.dispatchEvent(new Event(type, { bubbles: true }));
      window.dispatchEvent(new Event(type));
      expect(await settled(waiting)).toBe(false);
    },
  );
});

describe('a value entered before the region has hydrated', () => {
  const field = (extra: string): HTMLElement => {
    const host = document.createElement('section');
    host.setAttribute(REGION_ATTRIBUTE, 'decision');
    host.innerHTML = extra;
    document.body.appendChild(host);
    return host;
  };

  it('is recorded for a text control and read back once', () => {
    const host = field('<textarea id="reason"></textarea>');
    const box = host.querySelector('textarea')!;
    box.value = 'typed early';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(takePreHydrationValue('reason')).toBe('typed early');
    expect(takePreHydrationValue('reason')).toBeUndefined();
  });

  it('keeps the latest value of the control', () => {
    const host = field('<input id="a" type="text" />');
    const input = host.querySelector('input')!;
    for (const value of ['x', 'xy', 'xyz']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(takePreHydrationValue('a')).toBe('xyz');
  });

  it('is recorded for a select', () => {
    const host = field(
      '<select id="who"><option value="a">A</option><option value="b">B</option></select>',
    );
    const select = host.querySelector('select')!;
    select.value = 'b';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(takePreHydrationValue('who')).toBe('b');
  });

  it('is recorded for a radio group by its name, the checked one only', () => {
    const host = field(
      '<input id="r-a" type="radio" name="d" value="approve" /><input id="r-b" type="radio" name="d" value="reject" />',
    );
    const [approve, reject] = Array.from(host.querySelectorAll('input'));
    approve!.checked = true;
    approve!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(takePreHydrationValue('radio:d')).toBe('approve');
    reject!.checked = true;
    approve!.checked = false;
    approve!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(takePreHydrationValue('radio:d')).toBeUndefined();
    reject!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(takePreHydrationValue('radio:d')).toBe('reject');
  });

  it('arms the region (a robot that changes a control without focusing it)', async () => {
    const host = field('<input id="a" type="text" />');
    const waiting = whenRegionIntent('decision');
    host
      .querySelector('input')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    expect(await settled(waiting)).toBe(true);
  });

  it('is not recorded outside a region or inside one that has hydrated', () => {
    const outside = document.createElement('input');
    outside.id = 'outside';
    document.body.appendChild(outside);
    outside.value = 'x';
    outside.dispatchEvent(new Event('input', { bubbles: true }));
    const host = field('<input id="inside" type="text" />');
    markRegionHydrated(host);
    const input = host.querySelector('input')!;
    input.value = 'y';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(takePreHydrationValue('outside')).toBeUndefined();
    expect(takePreHydrationValue('inside')).toBeUndefined();
  });

  it('is forgotten when the region marks itself hydrated, and a control without an id is ignored', () => {
    const host = field('<input id="a" type="text" /><input type="text" />');
    for (const input of Array.from(host.querySelectorAll('input'))) {
      input.value = 'v';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    markRegionHydrated(host);
    expect(takePreHydrationValue('a')).toBeUndefined();
  });
});

describe('a submit before the region has hydrated', () => {
  it('is cancelled, arms the region and is replayed once after hydration', async () => {
    const host = addRegion('decision');
    const form = host.querySelector('form')!;
    const submitted = vi.fn();
    const waiting = whenRegionIntent('decision');
    const first = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(await settled(waiting)).toBe(true);
    form.requestSubmit = vi.fn(() => submitted());
    markRegionHydrated(host);
    await tick();
    expect(submitted).toHaveBeenCalledTimes(1);
    markRegionHydrated(host);
    await tick();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('replays a form held several times once, with the submitter of the first press', async () => {
    const host = addRegion('decision');
    const form = host.querySelector('form')!;
    const button = form.querySelector('button')!;
    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;
    for (let press = 0; press < 3; press += 1) {
      const event = new Event('submit', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'submitter', { value: button });
      form.dispatchEvent(event);
    }
    markRegionHydrated(host);
    await tick();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(requestSubmit).toHaveBeenCalledWith(button);
  });

  it('replays only the forms of the region that hydrated, and later the others', async () => {
    const first = addRegion('first');
    const second = addRegion('second');
    const firstSubmit = vi.fn();
    const secondSubmit = vi.fn();
    first.querySelector('form')!.requestSubmit = firstSubmit;
    second.querySelector('form')!.requestSubmit = secondSubmit;
    first
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    second
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    markRegionHydrated(first);
    await tick();
    expect(firstSubmit).toHaveBeenCalledTimes(1);
    expect(secondSubmit).not.toHaveBeenCalled();
    markRegionHydrated(second);
    await tick();
    expect(secondSubmit).toHaveBeenCalledTimes(1);
    expect(firstSubmit).toHaveBeenCalledTimes(1);
  });

  it('passes through untouched once the region has hydrated', () => {
    const host = addRegion('decision');
    markRegionHydrated(host);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    host.querySelector('form')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not touch a submit outside every region', () => {
    addRegion('decision');
    const form = document.createElement('form');
    document.body.appendChild(form);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('hydrating the server markup of a gated form', () => {
  const roots: Root[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) root.unmount();
  });

  function Gated({ onSubmit }: { onSubmit: () => void }): React.ReactElement {
    const ref = React.useRef<HTMLElement>(null);
    React.useLayoutEffect(() => {
      if (ref.current !== null) markRegionHydrated(ref.current);
    }, []);
    return (
      <section ref={ref} {...{ [REGION_ATTRIBUTE]: 'gated' }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <button type="submit">Go</button>
        </form>
      </section>
    );
  }

  it('keeps the server markup until intent, then hydrates and delivers the held submit once', async () => {
    const onSubmit = vi.fn();
    const loaded = vi.fn();
    const Lazy = React.lazy(async () => {
      await whenRegionIntent('gated');
      loaded();
      return { default: Gated };
    });
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <React.Suspense fallback={null}>
        <Gated onSubmit={onSubmit} />
      </React.Suspense>,
    );
    document.body.appendChild(host);
    roots.push(
      hydrateRoot(
        host,
        <React.Suspense fallback={null}>
          <Lazy onSubmit={onSubmit} />
        </React.Suspense>,
      ),
    );
    await tick(30);
    expect(loaded).not.toHaveBeenCalled();
    expect(host.querySelector('button')).not.toBeNull();

    const early = new Event('submit', { bubbles: true, cancelable: true });
    host.querySelector('form')!.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(true);
    await tick(80);
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
