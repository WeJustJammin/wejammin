// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { PatternLatestResult } from './pattern-latest-read';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * FE03 "Network and retry contract" (:1172): the latest-version read after a conflict or an
 * unknown outcome answered 429. The wait is announced, the unsent tree stays in the form, and the
 * check cannot be repeated before the stated wait has elapsed.
 */
const limited = (retryAfterSeconds?: number): PatternLatestResult => ({
  kind: 'rejected',
  status: 429,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

const mount = (...reads: PatternLatestResult[]) => {
  const queue = [...reads];
  const readLatest = vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected read');
    return next;
  });
  const mounted = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submitStub({ kind: 'conflict', currentVersion: '5' })}
      readLatest={readLatest}
    />,
  );
  return { ...mounted, readLatest };
};

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const toConflict = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Save successor draft'));
  await settle();
};
const check = (container: HTMLElement): HTMLButtonElement =>
  buttonNamed(container, /^Check(ing)? latest version/u);
const conflictAlert = (container: HTMLElement): string =>
  container.querySelector(
    '.cms-pattern-conflict [role="alert"], .cms-pattern-conflict [role="status"]',
  )?.textContent ?? '';

describe('the latest-version check after a 429', () => {
  it('announces the stated wait, keeps the tree and re-enables the check once the wait elapsed', async () => {
    const { container, readLatest } = mount(limited(5), {
      kind: 'loaded',
      detail: latestDetail({ version: '5', patternVersion: 5 }),
    });
    await toConflict(container);
    await click(check(container));
    await settle();
    expect(conflictAlert(container)).toBe(rateLimitMessage(5));
    expect(check(container).disabled).toBe(true);
    expect(container.textContent).toContain('Node 1 · Level 1 of 8');
    await settle(1_000);
    expect(conflictAlert(container)).toBe(rateLimitMessage(4));
    expect(check(container).disabled).toBe(true);
    await settle(3_999);
    expect(check(container).disabled).toBe(true);
    await settle(1);
    expect(check(container).disabled).toBe(false);
    expect(conflictAlert(container)).not.toContain('Try again in');
    await click(check(container));
    await settle();
    expect(readLatest).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Latest saved version: 5');
  });

  it('asks for a moment, and leaves the check available, when no wait was stated', async () => {
    const { container } = mount(limited());
    await toConflict(container);
    await click(check(container));
    await settle();
    expect(conflictAlert(container)).toBe(rateLimitMessage(null));
    expect(check(container).disabled).toBe(false);
  });

  it('announces it politely instead of interrupting, in a live region that was already there', async () => {
    const { container } = mount(limited(8));
    await toConflict(container);
    const region = container.querySelector(
      '.cms-pattern-conflict [data-cms-pattern-rate-limit]',
    );
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(region?.textContent).toBe('');
    await click(check(container));
    await settle();
    const notice = container.querySelector(
      '.cms-pattern-conflict [data-cms-pattern-rate-limit]',
    );
    expect(notice).toBe(region);
    expect(notice?.textContent).toBe(rateLimitMessage(8));
  });

  it('keeps the alert for a read refused for another reason', async () => {
    const { container } = mount({ kind: 'rejected', status: 403 });
    await toConflict(container);
    await click(check(container));
    await settle();
    expect(
      container.querySelector('.cms-pattern-conflict [role="alert"]')
        ?.textContent,
    ).toContain('Template designer access is required');
    expect(
      container.querySelector('[data-cms-pattern-rate-limit]')?.textContent,
    ).toBe('');
    expect(check(container).disabled).toBe(false);
  });
});
