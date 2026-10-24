// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
  TYPE_B,
  createdResult,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/** A content type the read version names but the selector context no longer offers. */
const RETIRED_TYPE = '30000000-0000-4000-8000-0000000000ff';

const mount = (compatibleTypeIds: string[], submit = submitStub()) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={latestDetail({ compatibleTypeIds })}
      csrfToken={CSRF_TOKEN}
      submit={submit}
    />,
  );
const boxes = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'fieldset input[type="checkbox"]',
    ),
  );
const labelOf = (box: HTMLInputElement): string =>
  box.closest('label')?.textContent ?? '';
const staleBox = (container: HTMLElement): HTMLInputElement | undefined =>
  boxes(container).find((box) => labelOf(box).includes('no longer available'));
const save = async (container: HTMLElement): Promise<void> => {
  await click(buttonNamed(container, 'Save successor draft'));
  await flush();
};

describe('CmsPatternVersionDesigner: a content type that is no longer active', () => {
  const ACTIVE = designerContext.contentTypes[0]!.id;

  it('renders the stale type checked and labelled so it can be removed', () => {
    const { container } = mount([ACTIVE, RETIRED_TYPE]);
    const stale = staleBox(container);
    expect(stale).toBeDefined();
    expect(stale?.checked).toBe(true);
    expect(container.textContent).toContain('no longer active');
    expect(container.textContent).toContain('Clear it to save');
  });

  it('cannot be saved while the stale type is checked, and says how to fix it', async () => {
    const submit = submitStub();
    const { container } = mount([ACTIVE, RETIRED_TYPE], submit);
    await save(container);
    expect(submit).not.toHaveBeenCalled();
    const summary = container.querySelector('#cms-pattern-status');
    expect(summary?.textContent).toContain('no longer active');
    expect(summary?.textContent).toContain('Clear');
    expect(summary?.textContent).not.toContain('Reload');
  });

  it('saves a successor once the stale type is unchecked', async () => {
    const submit = submitStub(
      createdResult({ patternVersion: 3, version: '3' }),
    );
    const { container } = mount([ACTIVE, RETIRED_TYPE], submit);
    await click(staleBox(container) as HTMLInputElement);
    // The unchecked stale type stays listed, so the person can see what was removed.
    expect(staleBox(container)?.checked).toBe(false);
    await save(container);
    const [request] = submit.mock.calls[0] as unknown as [
      { compatibleTypeIds: string[]; expectedVersion: string },
    ];
    expect(request.compatibleTypeIds).toEqual([ACTIVE]);
    expect(request.expectedVersion).toBe('2');
    expect(
      container.querySelector('#cms-pattern-status')?.textContent,
    ).toContain('Pattern draft saved');
  });

  it('keeps the type unavailable with only the stale type left (a type must remain)', async () => {
    const submit = submitStub();
    const { container } = mount([RETIRED_TYPE], submit);
    await click(staleBox(container) as HTMLInputElement);
    await save(container);
    expect(submit).not.toHaveBeenCalled();
    expect(
      container.querySelector('#cms-pattern-status')?.textContent,
    ).toContain('Choose at least one content type');
  });

  it('lists no stale entry when every named type is active', () => {
    const { container } = mount([ACTIVE, TYPE_B]);
    expect(staleBox(container)).toBeUndefined();
    expect(boxes(container)).toHaveLength(2);
  });
});
