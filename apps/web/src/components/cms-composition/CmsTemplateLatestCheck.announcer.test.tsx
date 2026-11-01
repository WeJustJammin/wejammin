// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import CmsTemplateLatestCheck from './CmsTemplateLatestCheck';

const roots: ReturnType<typeof createRoot>[] = [];
const observers: MutationObserver[] = [];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  for (const observer of observers.splice(0)) observer.disconnect();
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
const host = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  return { container, root };
};
const props = {
  offered: true,
  checking: false,
  waiting: false,
  onCheck: vi.fn(),
};

describe('template latest-check polite announcement lifecycle', () => {
  it.each([5, null])(
    'B-ANN-TPL-001 starts empty and mutates the same mounted node for wait %s',
    async (seconds) => {
      const { container, root } = host();
      await act(async () =>
        root.render(
          <CmsTemplateLatestCheck {...props} error="" rateLimited={false} />,
        ),
      );
      const region = container.querySelector<HTMLElement>(
        '[data-cms-template-rate-limit]',
      );
      expect(
        region,
        'announcer must exist before the asynchronous read answers',
      ).not.toBeNull();
      if (region === null)
        throw new Error('Missing initially empty template announcer');
      expect(region.textContent).toBe('');
      expect(region.getAttribute('role')).toBe('status');
      const mutations: MutationRecord[] = [];
      const observer = new MutationObserver((records) =>
        mutations.push(...records),
      );
      observers.push(observer);
      observer.observe(region, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      const message = rateLimitMessage(seconds);
      await act(async () =>
        root.render(
          <CmsTemplateLatestCheck {...props} error={message} rateLimited />,
        ),
      );
      await Promise.resolve();
      expect(container.querySelector('[data-cms-template-rate-limit]')).toBe(
        region,
      );
      expect(region.textContent).toBe(message);
      expect(
        mutations.some(
          (record) =>
            record.target === region || region.contains(record.target),
        ),
      ).toBe(true);
      expect(container.querySelector('[role="alert"]')).toBeNull();
    },
  );

  it('B-ANN-TPL-002 commits an empty region before announcing an already rate-limited result', async () => {
    const { container, root } = host();
    const message = rateLimitMessage(5);
    const atLayout: { node: HTMLElement | null; text: string | null }[] = [];
    const mutations: MutationRecord[] = [];
    function Probe(): React.ReactElement {
      React.useLayoutEffect(() => {
        const node = container.querySelector<HTMLElement>(
          '[data-cms-template-rate-limit]',
        );
        atLayout.push({ node, text: node?.textContent ?? null });
        if (node !== null) {
          const observer = new MutationObserver((records) =>
            mutations.push(...records),
          );
          observers.push(observer);
          observer.observe(node, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      }, []);
      return <CmsTemplateLatestCheck {...props} error={message} rateLimited />;
    }
    await act(async () => root.render(<Probe />));
    await Promise.resolve();
    expect(
      atLayout[0]?.text,
      'the first commit must be empty, before announcement',
    ).toBe('');
    const region = atLayout[0]?.node;
    expect(container.querySelector('[data-cms-template-rate-limit]')).toBe(
      region,
    );
    expect(region?.textContent).toBe(message);
    expect(
      mutations.some(
        (record) => record.target === region || region?.contains(record.target),
      ),
    ).toBe(true);
  });
});
