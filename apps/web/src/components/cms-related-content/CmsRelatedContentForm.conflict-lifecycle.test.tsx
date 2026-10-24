// @vitest-environment jsdom
import { act } from 'react';
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
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  id,
  listItems,
  mount,
  submitStub,
  text,
} from './related-content.test-support';

import {
  DRAFT_PATH,
  RULE_PATH,
  boundField,
  controllingFetch,
  canonicalReads,
  dependencyFailure,
  draftAnswer,
  heading,
  name,
  localVersion,
  pathOf,
  ruleAnswer,
  reads,
  reviewMessage,
  settle,
  SNAPSHOT_SELECTOR,
} from './related-conflict.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/*
 * FE03 :1224 with the network/deadline contract (:1173; BE03c route registry: cmsRelatedContentRead, 8,000 ms):
 * the Review-changes reads are cancelable protected reads. Each carries the component's own AbortSignal, which
 * aborts at the 8-second deadline and on unmount; a held read that settles late is ignored and starts no next
 * read, no POST and no navigation. Asserted on the actual signal and on the absence of further requests, never
 * on the absence of React warnings.
 */

/** Save a preserved draft into the 409 conflict and return the mounted root. */
const conflicted = async (submit: ReturnType<typeof submitStub>) => {
  const mounted = mount({ submit });
  await click(buttonNamed(mounted.container, `Pin ${name(1)}`));
  await click(byLabel(mounted.container, /Shared terms/u));
  await typeInto(boundField(mounted.container), '12');
  await click(buttonNamed(mounted.container, 'Save related content'));
  return mounted;
};

const holdStage = async (
  stage: 'draft' | 'rule',
  container: HTMLElement,
  control: ReturnType<typeof controllingFetch>,
): Promise<number> => {
  await click(buttonNamed(container, 'Review changes'));
  await settle(0);
  if (stage === 'rule') {
    await act(async () => {
      control.releases[0]!(draftAnswer('9'));
    });
    await flush();
  }
  const index = stage === 'draft' ? 0 : 1;
  expect(control.fetcher).toHaveBeenCalledTimes(index + 1);
  expect(pathOf(control.fetcher.mock.calls[index]![0])).toBe(
    stage === 'draft' ? DRAFT_PATH : RULE_PATH,
  );
  return index;
};

describe('CmsRelatedContentForm: review read lifecycle', () => {
  it('aborts the held review read at the 8-second deadline, keeping the draft and token and offering no Reapply', async () => {
    vi.useFakeTimers();
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const { container } = await conflicted(submit);
    const { fetcher, signals } = controllingFetch();
    vi.stubGlobal('fetch', fetcher);
    await click(buttonNamed(container, 'Review changes'));
    await settle(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(pathOf(fetcher.mock.calls[0]![0])).toBe(DRAFT_PATH);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0]!.aborted).toBe(false);
    await settle(7_999);
    expect(signals[0]!.aborted).toBe(false);
    await settle(1);
    expect(signals[0]!.aborted).toBe(true);
    expect(heading(container)).toBe('This entry changed');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(boundField(container).value).toBe('12');
    expect(text(container)).toContain('Your choices are kept.');
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
  });

  it('aborts the owned signal on unmount during the draft read and ignores a late answer, starting no next read, POST or navigation', async () => {
    vi.useFakeTimers();
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const mounted = await conflicted(submit);
    // 'abort-ignores': the held promise stays pending so this test can resolve it AFTER the abort.
    const { fetcher, signals, releases } = controllingFetch('abort-ignores');
    vi.stubGlobal('fetch', fetcher);
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    await click(buttonNamed(mounted.container, 'Review changes'));
    await settle(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signals[0]!.aborted).toBe(false);
    mounted.unmount();
    expect(signals[0]!.aborted).toBe(true);
    // The late answer is really delivered (the promise resolves, it does not reject) and must be ignored.
    await act(async () => {
      releases[0]!(draftAnswer('9'));
      await Promise.resolve();
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('aborts the owned signal on unmount during the rule read and ignores a late answer, starting no POST or navigation', async () => {
    vi.useFakeTimers();
    const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
    const mounted = await conflicted(submit);
    const { fetcher, signals, releases } = controllingFetch('abort-ignores');
    vi.stubGlobal('fetch', fetcher);
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    await click(buttonNamed(mounted.container, 'Review changes'));
    await settle(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      releases[0]!(draftAnswer('9'));
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(pathOf(fetcher.mock.calls[1]![0])).toBe(RULE_PATH);
    expect(signals[1]!.aborted).toBe(false);
    mounted.unmount();
    expect(signals[1]!.aborted).toBe(true);
    // The late rule answer is really delivered after the abort and must be ignored.
    await act(async () => {
      releases[1]!(ruleAnswer());
      await Promise.resolve();
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(['draft', 'rule'] as const)(
    'settles a mounted %s deadline even when fetch ignores abort, then ignores a real late answer',
    async (stage) => {
      vi.useFakeTimers();
      const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
      const { container } = await conflicted(submit);
      const control = controllingFetch('abort-ignores');
      vi.stubGlobal('fetch', control.fetcher);
      const push = vi.spyOn(window.history, 'pushState');
      const replace = vi.spyOn(window.history, 'replaceState');
      const index = await holdStage(stage, container, control);
      expect(control.signals[index]).toBeInstanceOf(AbortSignal);
      await settle(7_999);
      expect(control.signals[index]!.aborted).toBe(false);
      await settle(1);
      expect(control.signals[index]!.aborted).toBe(true);
      // This must settle BEFORE releasing the ignored-abort fetch: it discriminates the abort race.
      expect(reviewMessage(container)).toContain('could not be verified');
      expect(reviewMessage(container)).not.toContain(
        'Reading the current server state',
      );
      expect(buttonNamed(container, 'Review changes').disabled).toBe(false);
      expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
      expect(heading(container)).toBe('This entry changed');
      expect(localVersion(container)).toBe('4');
      expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
      expect(boundField(container).value).toBe('12');
      await act(async () => {
        control.releases[index]!(
          stage === 'draft' ? draftAnswer('9') : ruleAnswer(),
        );
      });
      await flush();
      expect(control.fetcher).toHaveBeenCalledTimes(index + 1);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(container.querySelector(SNAPSHOT_SELECTOR)).toBeNull();
      expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
      expect(localVersion(container)).toBe('4');
      expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
      expect(boundField(container).value).toBe('12');
      expect(reviewMessage(container)).toContain('could not be verified');
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['draft', true],
    ['rule', true],
    ['draft', false],
    ['rule', false],
  ] as const)(
    'uses declared-safe %s retry=%s with exact 250/750 ms request boundaries',
    async (stage, retryable) => {
      vi.useFakeTimers();
      const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
      const { container } = await conflicted(submit);
      const start = Date.now();
      const times: number[] = [];
      const failingPath = stage === 'draft' ? DRAFT_PATH : RULE_PATH;
      const answer = (): Response => {
        times.push(Date.now() - start);
        return times.length <= 2
          ? dependencyFailure(retryable)
          : stage === 'draft'
            ? draftAnswer('9')
            : ruleAnswer();
      };
      const fetcher = canonicalReads({
        [DRAFT_PATH]: stage === 'draft' ? answer : () => draftAnswer('9'),
        [RULE_PATH]: stage === 'rule' ? answer : () => ruleAnswer(),
      });
      vi.stubGlobal('fetch', fetcher);
      await click(buttonNamed(container, 'Review changes'));
      await flush();
      expect(times).toEqual([0]);
      if (!retryable) {
        await settle(1_000);
        expect(times).toEqual([0]);
        expect(
          reads(fetcher).filter((call) => call.path === failingPath),
        ).toHaveLength(1);
        expect(container.querySelector(SNAPSHOT_SELECTOR)).toBeNull();
        expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
        expect(submit).toHaveBeenCalledTimes(1);
        return;
      }
      await settle(249);
      expect(times).toEqual([0]);
      await settle(1);
      expect(times).toEqual([0, 250]);
      await settle(749);
      expect(times).toEqual([0, 250]);
      await settle(1);
      await flush();
      expect(times).toEqual([0, 250, 1_000]);
      expect(reads(fetcher).map((call) => call.path)).toEqual(
        stage === 'draft'
          ? [DRAFT_PATH, DRAFT_PATH, DRAFT_PATH, RULE_PATH]
          : [DRAFT_PATH, RULE_PATH, RULE_PATH, RULE_PATH],
      );
      expect(container.querySelector(SNAPSHOT_SELECTOR)).not.toBeNull();
      expect(submit).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['draft', 'rule'] as const)(
    'cancels the %s safe-read retry wait on unmount without later requests, POST or navigation',
    async (stage) => {
      vi.useFakeTimers();
      const submit = submitStub({ kind: 'conflict', currentVersion: '9' });
      const mounted = await conflicted(submit);
      const fetcher = canonicalReads({
        [DRAFT_PATH]: () =>
          stage === 'draft' ? dependencyFailure() : draftAnswer('9'),
        [RULE_PATH]: () => dependencyFailure(),
      });
      vi.stubGlobal('fetch', fetcher);
      const push = vi.spyOn(window.history, 'pushState');
      const replace = vi.spyOn(window.history, 'replaceState');
      const timersBeforeReview = vi.getTimerCount();
      await click(buttonNamed(mounted.container, 'Review changes'));
      await flush();
      const expected =
        stage === 'draft' ? [DRAFT_PATH] : [DRAFT_PATH, RULE_PATH];
      expect(reads(fetcher).map((call) => call.path)).toEqual(expected);
      expect(reviewMessage(mounted.container)).toContain(
        'Reading the current server state',
      );
      mounted.unmount();
      await flush();
      expect(vi.getTimerCount()).toBe(timersBeforeReview);
      await settle(1_000);
      await flush();
      expect(reads(fetcher).map((call) => call.path)).toEqual(expected);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );
});
