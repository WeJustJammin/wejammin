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

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternConflictPanel from '../cms-pattern-designer/CmsPatternConflictPanel';
import { designerContext } from '../cms-pattern-designer/pattern-designer.test-support';
import CmsTemplateLatestCheck from './CmsTemplateLatestCheck';

/*
 * FE03 1042 and 1048 (Slice 12 `latestReadState`, loading: "Skeleton after 250 ms; the submit controls stay disabled";
 * P2-S12-AC-271): the template and pattern latest checks show a skeleton in a polite
 * region only after 250 ms; the check control stays off while the read runs.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const noop = () => undefined;
const skeleton = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('.cms-loading-region');

const surfaces: ReadonlyArray<
  readonly [string, (loading: boolean) => React.ReactElement]
> = [
  [
    'template latest check',
    (loading) => (
      <CmsTemplateLatestCheck
        offered
        checking={loading}
        waiting={false}
        error=""
        rateLimited={false}
        onCheck={noop}
      />
    ),
  ],
  [
    'pattern latest check',
    (loading) => (
      <CmsPatternConflictPanel
        state={loading ? { kind: 'checking' } : { kind: 'none' }}
        verified={null}
        baseVersion="1"
        newer={false}
        waiting={false}
        draftTree={[]}
        draftTypeIds={[]}
        context={designerContext}
        onCheck={noop}
        onRebase={noop}
        onDiscard={noop}
      />
    ),
  ],
];

describe.each(surfaces)('%s over 250 ms', (_name, render) => {
  it('shows nothing at 249 ms and a polite skeleton at 250 ms', async () => {
    const { container } = mountElement(render(true));
    await advance(249);
    expect(skeleton(container)).toBeNull();
    await advance(1);
    const shown = skeleton(container) as HTMLElement;
    expect(shown.getAttribute('role')).toBe('status');
  });

  it('shows no skeleton for a read that finishes inside 250 ms', async () => {
    const view = mountElement(render(true));
    await advance(100);
    view.rerender(render(false));
    await advance(1_000);
    expect(skeleton(view.container)).toBeNull();
  });
});
