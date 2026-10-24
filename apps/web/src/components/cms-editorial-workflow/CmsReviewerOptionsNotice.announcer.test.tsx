// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import CmsReviewerOptionsNotice from './CmsReviewerOptionsNotice';

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
const limited = (retryAfterSeconds: number | null) => ({
  kind: 'unavailable' as const,
  rateLimit: { retryAfterSeconds },
});
const message = (seconds: number | null): string =>
  `Reviewer choices could not be loaded yet. ${rateLimitMessage(seconds)}`;

describe('reviewer-options polite announcement lifecycle', () => {
  it.each([5, null])(
    'B-ANN-REV-001 starts empty and mutates the same mounted node for wait %s',
    async (seconds) => {
      const { container, root } = host();
      await act(async () =>
        root.render(<CmsReviewerOptionsNotice reviewers={null} />),
      );
      expect(container.textContent).toContain('Loading reviewers…');
      const region = container.querySelector<HTMLElement>(
        '[data-cms-reviewers-rate-limit]',
      );
      expect(
        region,
        'announcer must exist before the asynchronous list read answers',
      ).not.toBeNull();
      if (region === null)
        throw new Error('Missing initially empty reviewer announcer');
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
      await act(async () =>
        root.render(<CmsReviewerOptionsNotice reviewers={limited(seconds)} />),
      );
      await Promise.resolve();
      expect(container.querySelector('[data-cms-reviewers-rate-limit]')).toBe(
        region,
      );
      expect(region.textContent).toBe(message(seconds));
      expect(
        mutations.some(
          (record) =>
            record.target === region || region.contains(record.target),
        ),
      ).toBe(true);
      expect(container.querySelector('[role="alert"]')).toBeNull();
    },
  );

  it('B-ANN-REV-002 commits an empty region before announcing an already rate-limited result', async () => {
    const { container, root } = host();
    const atLayout: { node: HTMLElement | null; text: string | null }[] = [];
    const mutations: MutationRecord[] = [];
    function Probe(): React.ReactElement {
      React.useLayoutEffect(() => {
        const node = container.querySelector<HTMLElement>(
          '[data-cms-reviewers-rate-limit]',
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
      return <CmsReviewerOptionsNotice reviewers={limited(5)} />;
    }
    await act(async () => root.render(<Probe />));
    await Promise.resolve();
    expect(
      atLayout[0]?.text,
      'the first commit must be empty, before announcement',
    ).toBe('');
    const region = atLayout[0]?.node;
    expect(container.querySelector('[data-cms-reviewers-rate-limit]')).toBe(
      region,
    );
    expect(region?.textContent).toBe(message(5));
    expect(
      mutations.some(
        (record) => record.target === region || region?.contains(record.target),
      ),
    ).toBe(true);
  });
});
