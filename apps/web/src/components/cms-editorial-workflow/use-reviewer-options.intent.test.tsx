// @vitest-environment jsdom
import * as React from 'react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { installLazyIntent, resetLazyIntentForTest } from './cms-lazy-intent';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';
import { useReviewerOptions } from './use-reviewer-options';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => {
  resetLazyIntentForTest();
  installLazyIntent();
});

const OK: ReviewerOptionsResult = { kind: 'ok', options: [] };

/*
 * The reviewer choices are read on the first sign of intent in the assignment region, not when
 * the form mounts: the read fetches the contract validators (a 51 KB gzip chunk), which would
 * otherwise be part of the cold load of every review page an owner opens (FE03 "Performance
 * budgets and loading strategy": lazy modules load on explicit entry; P2-S11-AC-106).
 */
const Probe = ({
  load,
  region,
}: {
  load: () => Promise<ReviewerOptionsResult>;
  region?: string;
}): React.ReactElement => {
  const { reviewers, retry } = useReviewerOptions(load, true, region);
  return (
    <section data-cms-lazy-region={region} data-testid="region">
      <input id="inside" />
      <button type="button" id="again" onClick={retry}>
        again
      </button>
      <p data-state="">{reviewers === null ? 'loading' : reviewers.kind}</p>
    </section>
  );
};

const fire = (target: Element, type: string): void => {
  target.dispatchEvent(new Event(type, { bubbles: true }));
};

describe('useReviewerOptions with a region', () => {
  it('reads nothing at mount and nothing for a scroll or the passing of time', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => OK);
    mountElement(<Probe load={load} region="reviewers-a" />);
    await flush();
    document.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it.each(['pointerover', 'pointerdown', 'touchstart', 'focusin', 'keydown'])(
    'reads once on %s inside the region',
    async (type) => {
      const load = vi.fn(async () => OK);
      const { container } = mountElement(
        <Probe load={load} region={`reviewers-${type}`} />,
      );
      await flush();
      expect(load).not.toHaveBeenCalled();
      fire(container.querySelector('#inside')!, type);
      await flush();
      await flush();
      expect(load).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[data-state]')?.textContent).toBe('ok');
      fire(container.querySelector('#inside')!, type);
      await flush();
      expect(load).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores intent in another region', async () => {
    const load = vi.fn(async () => OK);
    const { container } = mountElement(
      <div>
        <Probe load={load} region="reviewers-b" />
        <section data-cms-lazy-region="elsewhere">
          <input id="other" />
        </section>
      </div>,
    );
    await flush();
    fire(container.querySelector('#other')!, 'pointerover');
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it('reads again on retry, showing the list as loading until the new answer', async () => {
    let answer: (value: ReviewerOptionsResult) => void = () => undefined;
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValueOnce({ kind: 'unavailable' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );
    const { container } = mountElement(
      <Probe load={load} region="reviewers-r" />,
    );
    fire(container.querySelector('#inside')!, 'pointerover');
    await flush();
    await flush();
    expect(container.querySelector('[data-state]')?.textContent).toBe(
      'unavailable',
    );
    (container.querySelector('#again') as HTMLElement).click();
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-state]')?.textContent).toBe(
      'loading',
    );
    answer(OK);
    await flush();
    await flush();
    expect(container.querySelector('[data-state]')?.textContent).toBe('ok');
  });

  it('reads at mount when no region is named', async () => {
    const load = vi.fn(async () => OK);
    mountElement(<Probe load={load} />);
    await flush();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
