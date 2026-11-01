// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternNestedPicker from './CmsPatternNestedPicker';
import type { NestablePage, NestableReadResult } from './pattern-nestable-read';
import { NESTABLE_PAGE_LIMIT } from './pattern-nestable-read';
import type { ReadNestable } from './use-nestable-patterns';
import { TYPE_ID } from '../../server/cms-pattern-platform.test-support';
import { TYPE_B } from './pattern-designer.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * The nested-pattern picker (DEC-196, FE03 `CmsPatternVersionDesigner` row, P2-S12-AC-105): the active owner-scope pattern
 * versions that list EVERY content type of the pattern being designed, as a native select, never preselected, loaded
 * from `cmsPatternNestableRead` with loading, empty, failed and retry states. Selection is an input to the tree, never authority.
 */
const item = (index: number) => ({
  patternId: `20000000-0000-4000-8000-${String(100 + index).padStart(12, '0')}`,
  patternVersionId: `20000000-0000-4000-8000-${String(200 + index).padStart(12, '0')}`,
  patternKey: `pattern-${String(index).padStart(3, '0')}`,
  patternVersion: 2,
  nodeCount: 3,
  blockRegistryDigest: 'a'.repeat(64),
});
const page = (
  count: number,
  nextCursor: string | null = null,
): NestablePage => ({
  items: Array.from({ length: count }, (_unused, index) => item(index + 1)),
  nextCursor,
  pageVersion: '1790000000000000',
});
const ok = (value: NestablePage): NestableReadResult => ({
  kind: 'page',
  page: value,
});
const reader = (...results: NestableReadResult[]) => {
  const queue = [...results];
  return vi.fn<ReadNestable>(
    async () => queue.shift() ?? ({ kind: 'unavailable' } as const),
  );
};

const mount = (
  props: Partial<React.ComponentProps<typeof CmsPatternNestedPicker>> = {},
) => {
  const onAdd = vi.fn();
  const mounted = mountElement(
    <CmsPatternNestedPicker
      typeIds={[TYPE_ID]}
      canAdd
      onAdd={onAdd}
      read={reader(ok(page(2)))}
      {...props}
    />,
  );
  return { ...mounted, onAdd };
};
const select = (container: HTMLElement): HTMLSelectElement =>
  byLabel(container, 'Add a nested pattern') as unknown as HTMLSelectElement;
const optionTexts = (container: HTMLElement): string[] =>
  Array.from(select(container).options).map(
    (option) => option.textContent ?? '',
  );
const text = (container: HTMLElement): string => container.textContent ?? '';

describe('CmsPatternNestedPicker: before and while loading', () => {
  it('is disabled and names the missing prerequisite while the pattern lists no content type, and reads nothing', async () => {
    const read = reader();
    const { container } = mount({ typeIds: [], read });
    await flush();
    expect(select(container).disabled).toBe(true);
    expect(buttonNamed(container, 'Add nested pattern').disabled).toBe(true);
    const reason = container.querySelector('#cms-pattern-nested-reason');
    expect(reason?.textContent).toContain(
      'Choose at least one compatible content type',
    );
    expect(select(container).getAttribute('aria-describedby')).toContain(
      'cms-pattern-nested-reason',
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('reads the first page of the pattern types and lists each pattern version, never preselected', async () => {
    const read = reader(ok(page(2)));
    const { container } = mount({ typeIds: [TYPE_ID, TYPE_B], read });
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[0]).toEqual([TYPE_ID, TYPE_B]);
    expect(read.mock.calls[0]?.[1]).toBeNull();
    expect(select(container).disabled).toBe(false);
    expect(select(container).value).toBe('');
    expect(optionTexts(container)).toEqual([
      'Choose a pattern',
      'pattern-001 version 2 (3 nodes)',
      'pattern-002 version 2 (3 nodes)',
    ]);
    expect(
      container.querySelector('#cms-pattern-nested-count')?.textContent,
    ).toBe('2 nestable patterns');
    expect(buttonNamed(container, 'Add nested pattern').disabled).toBe(true);
  });

  it('shows the loading state only after 250 ms and keeps the control disabled meanwhile', async () => {
    vi.useFakeTimers();
    let release: (value: NestableReadResult) => void = () => undefined;
    const read = vi.fn<ReadNestable>(
      () =>
        new Promise<NestableReadResult>((resolve) => {
          release = resolve;
        }),
    );
    const { container } = mount({ read });
    expect(select(container).disabled).toBe(true);
    expect(text(container)).not.toContain('Loading nestable patterns');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(text(container)).toContain('Loading nestable patterns');
    await act(async () => {
      release(ok(page(1)));
      await vi.advanceTimersByTimeAsync(10);
    });
    vi.useRealTimers();
    expect(text(container)).not.toContain('Loading nestable patterns');
    expect(select(container).disabled).toBe(false);
  });
});

describe('CmsPatternNestedPicker: choosing', () => {
  it('adds the chosen version through onAdd and resets the choice', async () => {
    const { container, onAdd } = mount({ read: reader(ok(page(2))) });
    await flush();
    const added = buttonNamed(container, 'Add nested pattern');
    await choose(select(container), item(2).patternVersionId);
    expect(added.disabled).toBe(false);
    await click(added);
    expect(onAdd).toHaveBeenCalledWith({
      patternId: item(2).patternId,
      patternKey: 'pattern-002',
      patternVersion: 2,
    });
    expect(select(container).value).toBe('');
    expect(added.disabled).toBe(true);
  });

  it('cannot add when the tree is full, and says why', async () => {
    const { container, onAdd } = mount({
      canAdd: false,
      read: reader(ok(page(1))),
    });
    await flush();
    await choose(select(container), item(1).patternVersionId);
    expect(buttonNamed(container, 'Add nested pattern').disabled).toBe(true);
    expect(text(container)).toContain('no room for another top-level node');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('says so, and offers nothing to add, when no active pattern lists every type', async () => {
    const { container } = mount({ read: reader(ok(page(0))) });
    await flush();
    expect(text(container)).toContain(
      'No active pattern lists every content type of this pattern.',
    );
    expect(select(container).disabled).toBe(true);
    expect(
      container.querySelector('#cms-pattern-nested-count')?.textContent,
    ).toBe('0 nestable patterns');
  });
});

describe('CmsPatternNestedPicker: failure and retry', () => {
  it('names an unavailable list, keeps the control disabled and retries on request', async () => {
    const read = reader({ kind: 'unavailable' }, ok(page(1)));
    const { container } = mount({ read });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be loaded',
    );
    expect(select(container).disabled).toBe(true);
    await click(buttonNamed(container, 'Retry loading nestable patterns'));
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(optionTexts(container)).toHaveLength(2);
  });

  it.each([
    [{ kind: 'rejected', status: 401 }, 'Sign in again'],
    [{ kind: 'rejected', status: 403 }, 'pattern designer capability'],
    [{ kind: 'rejected', status: 404 }, 'is not available to you'],
    [{ kind: 'rejected', status: 422 }, 'could not be requested'],
    [{ kind: 'rejected', status: 400 }, 'could not be requested'],
    [
      { kind: 'rejected', status: 429, retryAfterSeconds: 12 },
      'Try again in 12 seconds',
    ],
    [{ kind: 'rejected', status: 429 }, 'Wait a moment'],
  ] as const)('explains the refusal %j', async (result, phrase) => {
    const { container } = mount({ read: reader(result) });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      phrase,
    );
    expect(select(container).disabled).toBe(true);
  });
});

describe('CmsPatternNestedPicker: more pages and changed types', () => {
  it('loads the next page with the cursor and appends it', async () => {
    const first = page(NESTABLE_PAGE_LIMIT, 'next.sig');
    const second: NestablePage = {
      ...page(0),
      items: [item(100)],
      nextCursor: null,
    };
    const read = reader(ok(first), ok(second));
    const { container } = mount({ read });
    await flush();
    await click(buttonNamed(container, 'Load more patterns'));
    await flush();
    expect(read.mock.calls[1]?.[1]).toBe('next.sig');
    expect(optionTexts(container)).toHaveLength(NESTABLE_PAGE_LIMIT + 2);
    expect(optionTexts(container).at(-1)).toBe(
      'pattern-100 version 2 (3 nodes)',
    );
    expect(container.textContent).not.toContain('Load more patterns');
  });

  it('restarts from the first page, and says so, when the cursor no longer opens', async () => {
    const read = reader(
      ok(page(NESTABLE_PAGE_LIMIT, 'stale.sig')),
      { kind: 'rejected', status: 400 },
      ok(page(1)),
    );
    const { container } = mount({ read });
    await flush();
    await click(buttonNamed(container, 'Load more patterns'));
    await flush();
    expect(read.mock.calls[2]?.[1]).toBeNull();
    expect(text(container)).toContain('changed while you were loading it');
    expect(optionTexts(container)).toHaveLength(2);
  });

  it('re-reads from the first page when the content types change, clears the choice and ignores a stale answer', async () => {
    let releaseFirst: (value: NestableReadResult) => void = () => undefined;
    const read = vi
      .fn<ReadNestable>()
      .mockImplementationOnce(
        () =>
          new Promise<NestableReadResult>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(ok(page(1)));
    const onAdd = vi.fn();
    const mounted = mount({ read, onAdd });
    mounted.rerender(
      <CmsPatternNestedPicker
        typeIds={[TYPE_ID, TYPE_B]}
        canAdd
        onAdd={onAdd}
        read={read}
      />,
    );
    await flush();
    releaseFirst(ok(page(5)));
    await flush();
    expect(read.mock.calls.map((call) => call[0])).toEqual([
      [TYPE_ID],
      [TYPE_ID, TYPE_B],
    ]);
    expect(optionTexts(mounted.container)).toEqual([
      'Choose a pattern',
      'pattern-001 version 2 (3 nodes)',
    ]);
    expect(
      (read.mock.calls[0]?.[2] as { signal: AbortSignal }).signal.aborted,
    ).toBe(true);
  });
});
