// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
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

/** Another author's version 5: a different block under a new key, and the other content type. */
const newer = latestDetail({
  version: '5',
  patternVersion: 5,
  nodeCount: 2,
  compatibleTypeIds: [designerContext.contentTypes[1]!.id],
  blockTree: [
    {
      kind: 'block',
      key: 'hero',
      blockKey: 'profile.text',
      blockVersion: 3,
      props: {},
      children: [],
    },
    {
      kind: 'block',
      key: 'their-footer',
      blockKey: 'profile.text',
      blockVersion: 3,
      props: {},
      children: [],
    },
  ],
});
const mountConflicted = async (result: PatternLatestResult) => {
  const mounted = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submitStub({ kind: 'conflict', currentVersion: '5' })}
      readLatest={vi.fn(async () => result)}
    />,
  );
  await click(buttonNamed(mounted.container, 'Save successor draft'));
  await flush();
  await click(buttonNamed(mounted.container, 'Check latest version'));
  await flush();
  return mounted;
};
const section = (container: HTMLElement, name: RegExp): HTMLElement => {
  const heading = Array.from(container.querySelectorAll('h4')).find((entry) =>
    name.test(entry.textContent ?? ''),
  );
  const found = heading?.closest('section');
  if (!found) throw new Error(`No review section named ${String(name)}`);
  return found;
};

describe('CmsPatternVersionDesigner: Review changes after a conflict', () => {
  it('shows the newer version beside the unsent draft before any choice', async () => {
    const { container } = await mountConflicted({
      kind: 'loaded',
      detail: newer,
    });
    expect(container.textContent).toContain('Review changes');
    const theirs = section(container, /Version 5/u);
    const mine = section(container, /Your unsent draft/u);
    expect(theirs.textContent).toContain('their-footer');
    expect(theirs.textContent).toContain('profile.text@3');
    expect(theirs.textContent).toContain('Content types: release');
    expect(theirs.textContent).not.toContain('profile.header@1');
    expect(mine.textContent).toContain('profile.header@1');
    expect(mine.textContent).toContain('title');
    expect(mine.textContent).toContain('Content types: profile');
    expect(mine.textContent).not.toContain('release');
    expect(mine.textContent).not.toContain('their-footer');
  });

  it('marks each difference in words, not only by position', async () => {
    const { container } = await mountConflicted({
      kind: 'loaded',
      detail: newer,
    });
    const theirs = section(container, /Version 5/u);
    const mine = section(container, /Your unsent draft/u);
    const items = (root: HTMLElement): string[] =>
      Array.from(root.querySelectorAll('li'), (item) =>
        (item.firstElementChild?.textContent ?? '')
          .replace(/\s+/gu, ' ')
          .trim(),
      );
    expect(items(theirs)).toEqual([
      expect.stringContaining('hero'),
      expect.stringContaining('their-footer'),
    ]);
    expect(theirs.textContent).toContain('changed');
    expect(theirs.textContent).toContain('only in version 5');
    expect(mine.textContent).toContain('changed');
    expect(mine.textContent).toContain('only in your draft');
  });

  it('offers the review before the choices and keeps both choices', async () => {
    const { container } = await mountConflicted({
      kind: 'loaded',
      detail: newer,
    });
    const review = section(container, /Version 5/u);
    const keep = buttonNamed(container, /Keep my edits/u);
    const discard = buttonNamed(container, /Discard my edits/u);
    for (const button of [keep, discard])
      expect(
        review.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
  });

  it('shows no comparison when the version you started from is still the latest', async () => {
    const { container } = await mountConflicted({
      kind: 'loaded',
      detail: latestDetail(),
    });
    expect(container.textContent).not.toContain('Review changes');
  });
});
