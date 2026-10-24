// @vitest-environment jsdom
import * as React from 'react';
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
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import {
  CSRF_TOKEN,
  createdResult,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';
import type { PatternLatestResult } from './pattern-latest-read';
import type { PatternSubmitResult } from './pattern-designer-submit';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const status = (container: HTMLElement): string =>
  container.querySelector('#cms-pattern-status')?.textContent ?? '';
const keyOf = (submit: ReturnType<typeof submitStub>, call: number): string =>
  (submit.mock.calls[call] as unknown as [unknown, string, string])[2];

/** Edit mode: the unchanged tree of `latestDetail()` is the attempt on top of version 2. */
const mountEdit = (
  results: PatternSubmitResult[],
  read: PatternLatestResult,
) => {
  const submit = submitStub(...results);
  const readLatest = vi.fn(async () => read);
  const mounted = mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail()}
      csrfToken={CSRF_TOKEN}
      submit={submit}
      readLatest={readLatest}
    />,
  );
  return { ...mounted, submit, readLatest };
};
const saveEdit = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Save successor draft'));
  await flush();
};

describe('CmsPatternVersionDesigner: an unknown outcome is reconciled before any retry', () => {
  it('reads the latest version by itself and shows a committed write as saved, never as newer', async () => {
    const { container, submit, readLatest } = mountEdit(
      [{ kind: 'uncertain' }],
      {
        kind: 'loaded',
        detail: latestDetail({ version: '3', patternVersion: 3 }),
      },
    );
    await saveEdit(container);
    expect(readLatest).toHaveBeenCalledWith('profile-hero');
    expect(status(container)).toContain('Pattern draft saved');
    expect(status(container)).toContain('Version3');
    expect(container.textContent).not.toContain('Keep my edits');
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('says nothing was saved when the latest is still the starting version, and retries with the same key', async () => {
    const { container, submit } = mountEdit(
      [
        { kind: 'uncertain' },
        createdResult({ patternVersion: 3, version: '3' }),
      ],
      { kind: 'loaded', detail: latestDetail() },
    );
    await saveEdit(container);
    expect(status(container)).toContain('Nothing was saved');
    expect(status(container)).toContain('save again');
    expect(container.textContent).not.toContain('Keep my edits');
    await saveEdit(container);
    expect(keyOf(submit, 1)).toBe(keyOf(submit, 0));
    expect(status(container)).toContain('Pattern draft saved');
  });

  it('offers the comparison when someone else saved different content', async () => {
    const { container } = mountEdit([{ kind: 'uncertain' }], {
      kind: 'loaded',
      detail: latestDetail({
        version: '3',
        patternVersion: 3,
        nodeCount: 1,
        blockTree: [
          {
            kind: 'block',
            key: 'other',
            blockKey: 'profile.text',
            blockVersion: 3,
            props: {},
            children: [],
          },
        ],
      }),
    });
    await saveEdit(container);
    expect(status(container)).toContain('The result is unknown');
    expect(container.textContent).toContain('Review changes');
    buttonNamed(container, /Keep my edits and base them on version 3/u);
  });

  it('keeps the unknown outcome and offers a manual check when the read fails', async () => {
    const { container } = mountEdit([{ kind: 'uncertain' }], {
      kind: 'unavailable',
    });
    await saveEdit(container);
    expect(status(container)).toContain('The result is unknown');
    expect(container.textContent).toContain(
      'The latest version is unavailable',
    );
    expect(buttonNamed(container, 'Check latest version').disabled).toBe(false);
  });

  it('does not read by itself after a plain conflict', async () => {
    const { container, readLatest } = mountEdit(
      [{ kind: 'conflict', currentVersion: '5' }],
      { kind: 'unavailable' },
    );
    await saveEdit(container);
    expect(readLatest).not.toHaveBeenCalled();
  });
});

describe('CmsPatternVersionDesigner: reconciling a first version', () => {
  const buildFirstVersion = async (container: HTMLElement): Promise<void> => {
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Pattern key'),
      'profile-hero',
    );
    await click(
      container.querySelector('fieldset input[type="checkbox"]') as HTMLElement,
    );
    await click(buttonNamed(container, 'Add a top-level block'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Node 1 key'), 'hero');
    await choose(
      byLabel(container, 'Node 1 block') as unknown as HTMLSelectElement,
      'profile.header@1',
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Node 1 props (JSON object)'),
      '{"title":"Hello"}',
    );
  };
  const mountNew = (
    results: PatternSubmitResult[],
    read: PatternLatestResult,
  ) => {
    const submit = submitStub(...results);
    const readLatest = vi.fn(async () => read);
    const mounted = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={null}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readLatest={readLatest}
      />,
    );
    return { ...mounted, submit, readLatest };
  };
  const firstVersionDetail = latestDetail({
    version: '1',
    patternVersion: 1,
    nodeCount: 1,
    blockTree: [
      {
        kind: 'block',
        key: 'hero',
        blockKey: 'profile.header',
        blockVersion: 1,
        props: { title: 'Hello' },
        children: [],
      },
    ],
  });

  it('a 404 after an unknown first version means it was not saved, not that access is missing', async () => {
    const { container, submit } = mountNew(
      [{ kind: 'uncertain' }, createdResult()],
      { kind: 'rejected', status: 404 },
    );
    await buildFirstVersion(container);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(status(container)).toContain('Nothing was saved');
    expect(container.textContent).not.toContain(
      'unavailable to the current acting context',
    );
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(keyOf(submit, 1)).toBe(keyOf(submit, 0));
    expect(status(container)).toContain('Pattern draft saved');
  });

  it('a committed first version is shown as saved, so a retry cannot create a duplicate', async () => {
    const { container, submit } = mountNew([{ kind: 'uncertain' }], {
      kind: 'loaded',
      detail: firstVersionDetail,
    });
    await buildFirstVersion(container);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(status(container)).toContain('Pattern draft saved');
    expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('CmsPatternVersionDesigner: only a comparable latest version is compared', () => {
  const conflicted = async (read: PatternLatestResult) => {
    const mounted = mountEdit(
      [{ kind: 'conflict', currentVersion: '5' }],
      read,
    );
    await saveEdit(mounted.container);
    await click(buttonNamed(mounted.container, 'Check latest version'));
    await flush();
    return mounted;
  };

  it.each([
    ['an older version', latestDetail({ version: '1', patternVersion: 1 })],
    [
      'the same number from another row',
      latestDetail({ id: '20000000-0000-4000-8000-000000000009' }),
    ],
    [
      'the same number with other content',
      latestDetail({ contentHash: 'f'.repeat(64) }),
    ],
  ])('refuses %s', async (_name, detail) => {
    const { container } = await conflicted({ kind: 'loaded', detail });
    expect(container.textContent).toContain(
      'The latest version could not be verified. Reload.',
    );
    expect(container.textContent).not.toContain('still the latest');
    expect(container.textContent).not.toContain('Keep my edits');
  });

  it('still accepts the very same row as still the latest', async () => {
    const { container } = await conflicted({
      kind: 'loaded',
      detail: latestDetail(),
    });
    expect(container.textContent).toContain('still the latest');
  });
});
