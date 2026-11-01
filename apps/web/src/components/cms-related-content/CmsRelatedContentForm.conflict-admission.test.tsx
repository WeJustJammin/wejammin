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
  it('[P2-S12-AC-271] test correction (DEC-242): blocks native form submits during both held reads the 409 started by itself and after verification until explicit Reapply', async () => {
    const submit = submitStub({ kind: 'conflict', currentVersion: '99' });
    const { fetcher, releases } = controllingFetch('abort-ignores');
    const { container } = await conflictedDraft(submit, fetcher);
    await flush();
    // No press: the 409 itself started the draft read.
    expect(reads(fetcher).map((call) => call.path)).toEqual([DRAFT_PATH]);
    expect(buttonNamed(container, 'Save related content').disabled).toBe(true);
    await nativeSubmit(container);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
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

  it('[P2-S12-AC-271] test correction (DEC-242): clears the snapshot and Reapply after another 409 and requires a fresh two-stage verified review, which that 409 starts by itself', async () => {
    const submit = submitStub((call) =>
      call < 2
        ? { kind: 'conflict', currentVersion: '99' }
        : { kind: 'saved', saved: savedOf({ version: '24' }) },
    );
    const firstRead = canonicalReads({
      [DRAFT_PATH]: () => draftAnswer('17'),
      [RULE_PATH]: () => ruleAnswer({ version: '19' }),
    });
    const { container } = await conflictedDraft(submit, firstRead);
    await flush();
    expect(container.querySelector(SNAPSHOT_SELECTOR)).not.toBeNull();
    const { fetcher, releases } = controllingFetch('abort-ignores');
    vi.stubGlobal('fetch', fetcher);
    await click(buttonNamed(container, /^Reapply/u));
    await flush();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(sent(submit, 1)[0].expectedVersion).toBe('19');
    expect(heading(container)).toBe('This entry changed');
    // The second 409 started its own review: the draft read is held, so there is no snapshot and no Reapply yet.
    expect(container.querySelector(SNAPSHOT_SELECTOR)).toBeNull();
    expect(() => buttonNamed(container, /^Reapply/u)).toThrow();
    await nativeSubmit(container);
    expect(submit).toHaveBeenCalledTimes(2);
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
    // Two reads of the review, then the success refetch (FE03 1047) has begun with the draft read, still held.
    expect(reads(fetcher).map((call) => call.path)).toEqual([
      DRAFT_PATH,
      RULE_PATH,
      DRAFT_PATH,
    ]);
    expect(heading(container)).toBe('Related content saved');
    expect(localVersion(container)).toBe('24');
  });
});
