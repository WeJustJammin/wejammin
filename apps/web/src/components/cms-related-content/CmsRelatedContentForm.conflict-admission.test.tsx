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
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  id,
  listItems,
  savedOf,
  submitStub,
} from './related-content.test-support';
import {
  DRAFT_PATH,
  RULE_PATH,
  SNAPSHOT_SELECTOR,
  boundField,
  canonicalReads,
  conflictedDraft,
  controllingFetch,
  draftAnswer,
  heading,
  localVersion,
  nativeSubmit,
  reads,
  ruleAnswer,
  sent,
} from './related-conflict.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CmsRelatedContentForm: conflict admission', () => {
  it('blocks native form submits before review, during both held reads and after verification until explicit Reapply', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '99' });
    const { container } = await conflictedDraft(submit);
    const { fetcher, releases } = controllingFetch('abort-ignores');
    vi.stubGlobal('fetch', fetcher);
    await nativeSubmit(container);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    await click(buttonNamed(container, 'Review changes'));
    await flush();
    expect(reads(fetcher).map((call) => call.path)).toEqual([DRAFT_PATH]);
    await nativeSubmit(container);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      releases[0]!(draftAnswer('17'));
    });
    await flush();
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    await nativeSubmit(container);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      releases[1]!(ruleAnswer({ version: '19' }));
    });
    await flush();
    expect(container.querySelector(SNAPSHOT_SELECTOR)).not.toBeNull();
    expect(buttonNamed(container, /^Reapply/u).disabled).toBe(false);
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    await nativeSubmit(container);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    expect(reads(fetcher).map((call) => call.method)).toEqual(['GET', 'GET']);
    expect(localVersion(container)).toBe('4');
    expect(boundField(container).value).toBe('12');
  });

  it('clears the snapshot and Reapply after another 409 and requires a fresh two-stage verified review', async () => {
    const submit = submitStub((call) =>
      call < 2
        ? { kind: 'conflict', currentVersion: '99' }
        : { kind: 'saved', saved: savedOf({ version: '24' }) },
    );
    const { container } = await conflictedDraft(submit);
    const firstRead = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('17'),
      [RULE_PATH]: () => ruleAnswer({ version: '19' }),
    });
    vi.stubGlobal('fetch', firstRead);
    await click(buttonNamed(container, 'Review changes'));
    await flush();
    expect(container.querySelector(SNAPSHOT_SELECTOR)).not.toBeNull();
    await click(buttonNamed(container, /^Reapply/u));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(sent(submit, 1)[0].expectedVersion).toBe('19');
    expect(heading(container)).toBe('This entry changed');
    expect(container.querySelector(SNAPSHOT_SELECTOR)).toBeNull();
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
    await nativeSubmit(container);
    expect(submit).toHaveBeenCalledTimes(2);
    const { fetcher, releases } = controllingFetch('abort-ignores');
    vi.stubGlobal('fetch', fetcher);
    await click(buttonNamed(container, 'Review changes'));
    await flush();
    expect(reads(fetcher).map((call) => call.path)).toEqual([DRAFT_PATH]);
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
    await act(async () => {
      releases[0]!(draftAnswer('22'));
    });
    await flush();
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    await act(async () => {
      releases[1]!(ruleAnswer({ version: '23' }));
    });
    await flush();
    expect(localVersion(container)).toBe('4');
    expect(listItems(container, 'ol.cms-related-rows')).toEqual([id(1)]);
    expect(boundField(container).value).toBe('12');
    await click(buttonNamed(container, /^Reapply/u));
    await flush();
    expect(submit).toHaveBeenCalledTimes(3);
    expect(sent(submit, 2)[0].expectedVersion).toBe('23');
    expect(sent(submit, 2)[2]).not.toBe(sent(submit, 1)[2]);
    expect(reads(firstRead).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
    ]);
    expect(heading(container)).toBe('Related content saved');
    expect(localVersion(container)).toBe('24');
  });
});
