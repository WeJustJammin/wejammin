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
  typeInto,
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

const newer = latestDetail({ version: '5', patternVersion: 5 });
const mount = (read: PatternLatestResult) => {
  const submit = submitStub({ kind: 'conflict', currentVersion: '5' });
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
const nodeKey = (container: HTMLElement): HTMLInputElement =>
  container.querySelector<HTMLInputElement>(
    'input[id^="cms-pattern-node-"][id$="-key"]',
  )!;
const text = (element: Element): string => element.textContent ?? '';

describe('CmsPatternVersionDesigner commandState error (CMS-03C-12), FE03 1048 and 1266', () => {
  it('[P2-S12-AC-271] commandState error: a 409 refetches the latest version by itself and shows it beside the unsent tree, which is kept', async () => {
    const { container, submit, readLatest } = mount({
      kind: 'loaded',
      detail: newer,
    });
    await typeInto(nodeKey(container), 'kept-edit');
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    // No press: the read ran on its own, once.
    expect(readLatest).toHaveBeenCalledTimes(1);
    expect(readLatest).toHaveBeenCalledWith('profile-hero');
    expect(text(container)).toContain('Latest saved version: 5');
    expect(text(container)).toContain('is still in the form');
    expect(
      buttonNamed(container, 'Keep my edits and base them on version 5'),
    ).toBeDefined();
    expect(nodeKey(container).value).toBe('kept-edit');
  });

  it('[P2-S12-AC-271] commandState error: the save is held off while the automatic read runs and when it failed, and the read can be repeated', async () => {
    let release: (value: PatternLatestResult) => void = () => undefined;
    const submit = submitStub({ kind: 'conflict', currentVersion: '5' });
    const readLatest = vi.fn(
      () =>
        new Promise<PatternLatestResult>((resolve) => {
          release = resolve;
        }),
    );
    const { container } = mountElement(
      <CmsPatternVersionDesigner
        context={designerContext}
        latest={latestDetail()}
        csrfToken={CSRF_TOKEN}
        submit={submit}
        readLatest={readLatest}
      />,
    );
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(buttonNamed(container, 'Checking latest version…').disabled).toBe(
      true,
    );
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    release({ kind: 'unavailable' });
    await flush();
    expect(text(container)).toContain('The latest version is unavailable.');
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    expect(buttonNamed(container, 'Check latest version').disabled).toBe(false);
  });
});
