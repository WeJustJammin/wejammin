// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { resetLazyIntentForTest } from './cms-lazy-intent';
import {
  WhenOffered,
  eagerRenderFor,
  selectView,
  selectViewOnIntent,
} from './cms-lazy-view';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * FE03 "Performance budgets and loading strategy": a command form is a module that loads when
 * it is first offered, never with the island. The server and the test renderer include it
 * eagerly so the served HTML is complete; the browser fetches the chunk only for a person the
 * server offers the action to.
 */
const Probe = (): React.ReactElement => <p data-probe="">probe</p>;

describe('eagerRenderFor', () => {
  it('is eager where the loader supplies no Vite environment (the Playwright fixtures)', () => {
    expect(eagerRenderFor(undefined)).toBe(true);
  });

  it('is eager for the server render and under Vitest', () => {
    expect(eagerRenderFor({ SSR: true, MODE: 'production' })).toBe(true);
    expect(eagerRenderFor({ SSR: false, MODE: 'test' })).toBe(true);
    expect(eagerRenderFor({ MODE: 'test' })).toBe(true);
  });

  it('is lazy in the browser build', () => {
    expect(eagerRenderFor({ SSR: false, MODE: 'production' })).toBe(false);
    expect(eagerRenderFor({ MODE: 'production' })).toBe(false);
    expect(eagerRenderFor({})).toBe(false);
  });
});

describe('selectView', () => {
  it('uses the component itself where the render is eager (server, tests)', async () => {
    const view = await selectView(true, async () => ({ default: Probe }));
    expect(view).toBe(Probe);
  });

  it('wraps the loader in a retryable lazy view in the browser and does not call it yet', async () => {
    let called = 0;
    const view = await selectView(false, async () => {
      called += 1;
      return { default: Probe };
    });
    expect(view).not.toBe(Probe);
    expect(called).toBe(0);
    const View = view;
    const { container } = mountElement(
      <React.Suspense fallback={null}>
        <View />
      </React.Suspense>,
    );
    await flush();
    await flush();
    expect(called).toBe(1);
    expect(container.querySelector('[data-probe]')).not.toBeNull();
  });
});

describe('WhenOffered', () => {
  const mount = (offered: boolean) =>
    mountElement(
      <WhenOffered offered={offered}>
        <Probe />
      </WhenOffered>,
    );

  it('renders nothing while the action has never been offered', async () => {
    const { container } = mount(false);
    await flush();
    expect(container.querySelector('[data-probe]')).toBeNull();
  });

  it('renders the form once it is offered', async () => {
    const { container } = mount(true);
    await flush();
    expect(container.querySelector('[data-probe]')).not.toBeNull();
  });

  it('keeps the form mounted after the offer is withdrawn, so a refusal outlives its permission', async () => {
    const view = mount(false);
    await flush();
    view.rerender(
      <WhenOffered offered>
        <Probe />
      </WhenOffered>,
    );
    await flush();
    expect(view.container.querySelector('[data-probe]')).not.toBeNull();
    view.rerender(
      <WhenOffered offered={false}>
        <Probe />
      </WhenOffered>,
    );
    await flush();
    expect(view.container.querySelector('[data-probe]')).not.toBeNull();
  });
});

describe('loadViewOnIntent', () => {
  it('uses the component itself where the render is eager (server, tests)', async () => {
    const view = await selectViewOnIntent(true, 'probe', async () => ({
      default: Probe,
    }));
    expect(view).toBe(Probe);
  });

  it('wraps the loader in a retryable lazy view and loads nothing until the region shows intent', async () => {
    const host = document.createElement('section');
    host.setAttribute('data-cms-lazy-region', 'probe-region');
    document.body.appendChild(host);
    let called = 0;
    const view = await selectViewOnIntent(false, 'probe-region', async () => {
      called += 1;
      return { default: Probe };
    });
    expect(view).not.toBe(Probe);
    const mounted = mountElement(
      <React.Suspense fallback={null}>
        {React.createElement(view)}
      </React.Suspense>,
    );
    await flush();
    expect(called).toBe(0);
    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flush();
    await flush();
    expect(called).toBe(1);
    expect(mounted.container.querySelector('[data-probe]')).not.toBeNull();
    host.remove();
    resetLazyIntentForTest();
  });

  it('loads at once when the server markup has no such region', async () => {
    let called = 0;
    const view = await selectViewOnIntent(false, 'nowhere', async () => {
      called += 1;
      return { default: Probe };
    });
    const mounted = mountElement(
      <React.Suspense fallback={null}>
        {React.createElement(view)}
      </React.Suspense>,
    );
    await flush();
    await flush();
    expect(called).toBe(1);
    expect(mounted.container.querySelector('[data-probe]')).not.toBeNull();
  });
});
