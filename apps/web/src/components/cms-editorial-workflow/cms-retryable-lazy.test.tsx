// @vitest-environment jsdom
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  LAZY_VIEW_UNAVAILABLE_COPY,
  retryableLazy,
} from './cms-retryable-lazy';

/*
 * A lazy view whose chunk cannot be fetched must not crash its island or stay blank: it says so
 * in an alert and offers the load again, and the next attempt imports again (React.lazy itself
 * remembers a rejection for good).
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const Form = ({ label }: { label: string }): React.ReactElement => (
  <p data-form="">{label}</p>
);

const flaky = () => {
  let down = true;
  const load = vi.fn(async () => {
    if (down)
      throw new TypeError('Failed to fetch dynamically imported module');
    return { default: Form };
  });
  return {
    load,
    heal: () => {
      down = false;
    },
  };
};

describe('retryableLazy', () => {
  it('renders the component once its chunk loads', async () => {
    const View = retryableLazy(async () => ({ default: Form }));
    const { container } = mountElement(
      <React.Suspense fallback={null}>
        <View label="ready" />
      </React.Suspense>,
    );
    await flush();
    await flush();
    expect(container.querySelector('[data-form]')?.textContent).toBe('ready');
  });

  it('says the form could not be loaded, keeps the page, and the retry imports again', async () => {
    const chunk = flaky();
    const View = retryableLazy(chunk.load);
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { container } = mountElement(
      <div>
        <p data-page="">page</p>
        <React.Suspense fallback={null}>
          <View label="ready" />
        </React.Suspense>
      </div>,
    );
    await flush();
    await flush();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(LAZY_VIEW_UNAVAILABLE_COPY);
    expect(container.querySelector('[data-page]')).not.toBeNull();
    expect(container.querySelector('[data-form]')).toBeNull();

    chunk.heal();
    await click(buttonNamed(container, /Try loading/u));
    await flush();
    await flush();
    expect(container.querySelector('[data-form]')?.textContent).toBe('ready');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(chunk.load).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('can fail more than once before it loads', async () => {
    let attempts = 0;
    const load = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new TypeError('offline');
      return { default: Form };
    });
    const View = retryableLazy(load);
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { container } = mountElement(
      <React.Suspense fallback={null}>
        <View label="ready" />
      </React.Suspense>,
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await flush();
      await flush();
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      await click(buttonNamed(container, /Try loading/u));
    }
    await flush();
    await flush();
    expect(container.querySelector('[data-form]')).not.toBeNull();
    error.mockRestore();
  });
});

describe('retryableLazy over server markup', () => {
  const roots: Root[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) root.unmount();
    document.body.replaceChildren();
  });

  it('replaces the server markup by the alert when the chunk cannot load, and recovers on retry', async () => {
    disableReactAct();
    const chunk = flaky();
    const View = retryableLazy(chunk.load);
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const host = document.createElement('div');
    host.innerHTML = renderToString(
      <React.Suspense fallback={null}>
        <Form label="from the server" />
      </React.Suspense>,
    );
    document.body.appendChild(host);
    roots.push(
      hydrateRoot(
        host,
        <React.Suspense fallback={null}>
          <View label="from the server" />
        </React.Suspense>,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      LAZY_VIEW_UNAVAILABLE_COPY,
    );
    chunk.heal();
    host.querySelector('button')!.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(host.querySelector('[data-form]')?.textContent).toBe(
      'from the server',
    );
    error.mockRestore();
    enableReactAct();
  });
});
