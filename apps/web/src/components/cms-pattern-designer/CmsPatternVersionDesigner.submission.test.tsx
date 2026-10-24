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
  createdResult,
  designerContext,
  latestDetail,
} from './pattern-designer.test-support';
import type { PatternSubmitResult } from './pattern-designer-submit';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * FE03 "Form contract" (:1223) submission clause with the stable pending label (:1043, :898,
 * :974, :1257; DESIGN.md Buttons): only the commit control is disabled while a save is in flight,
 * it shows `Saving…` at the width the idle label had, exposes the pending text and ignores a
 * duplicate activation. Validation timing and completion are in the form-contract file.
 */
type Props = React.ComponentProps<typeof CmsPatternVersionDesigner>;
const mount = (props: Partial<Props> = {}) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={null}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );

describe('submission: only the commit action is disabled while pending', () => {
  const pendingEdit = async () => {
    let release: (value: PatternSubmitResult) => void = () => undefined;
    const submit = vi.fn(
      () => new Promise<PatternSubmitResult>((resolve) => (release = resolve)),
    );
    const view = mount({ latest: latestDetail(), submit });
    const before = buttonNamed(view.container, 'Save successor draft');
    await click(before);
    return {
      ...view,
      submit,
      before,
      release: (r: PatternSubmitResult) => release(r),
    };
  };

  const controls = (container: HTMLElement): HTMLInputElement[] =>
    Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'form input, form textarea, form select, form button',
      ),
    );

  it('keeps every field and tree control as usable as it was before the send', async () => {
    let release: (value: PatternSubmitResult) => void = () => undefined;
    const submit = vi.fn(
      () => new Promise<PatternSubmitResult>((resolve) => (release = resolve)),
    );
    const { container } = mount({ latest: latestDetail(), submit });
    const before = controls(container).map((control) => control.disabled);
    await click(buttonNamed(container, 'Save successor draft'));
    const after = controls(container);
    const changed = after.filter(
      (control, index) => control.disabled !== before[index],
    );
    expect(changed.map((control) => control.textContent)).toEqual(['Saving…']);
    expect(container.querySelectorAll('fieldset:disabled')).toHaveLength(0);
    release({ kind: 'rejected', status: 422 });
    await flush();
  });

  it('shows the stable pending label on the same disabled control, marks it busy and exposes the pending text', async () => {
    const { container, before } = await pendingEdit();
    const button = buttonNamed(container, 'Saving…');
    expect(button).toBe(before);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toBe('Saving…');
    const status = container.querySelector('#cms-pattern-status');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toContain('Saving the pattern draft…');
  });

  it('sets no minimum width when the idle width could not be measured', async () => {
    // jsdom has no layout: offsetWidth is 0, so there is nothing to keep.
    const { container, release } = await pendingEdit();
    expect(buttonNamed(container, 'Saving…').style.minInlineSize).toBe('');
    release({ kind: 'rejected', status: 422 });
    await flush();
  });

  it('keeps the width the label had before the send while the shorter pending label shows', async () => {
    const widthOf = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.tagName === 'BUTTON' ? 168 : 0;
      },
    });
    try {
      const { container, release } = await pendingEdit();
      const pending = buttonNamed(container, 'Saving…');
      expect(pending.style.minInlineSize).toBe('168px');
      release({ kind: 'rejected', status: 422 });
      await flush();
      const settled = buttonNamed(container, 'Save successor draft');
      expect(settled.style.minInlineSize).toBe('');
    } finally {
      if (widthOf === undefined)
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
      else Object.defineProperty(HTMLElement.prototype, 'offsetWidth', widthOf);
    }
  });

  it('returns the label once the answer arrived and is not busy', async () => {
    const { container, release } = await pendingEdit();
    release({ kind: 'rejected', status: 422 });
    await flush();
    const button = buttonNamed(container, 'Save successor draft');
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (candidate) => candidate.textContent === 'Saving…',
      ),
    ).toBe(false);
  });

  it('keeps the committed form closed after the draft was saved', async () => {
    const { container, release } = await pendingEdit();
    release(createdResult({ patternVersion: 3, version: '3' }));
    await flush();
    expect(buttonNamed(container, 'Save successor draft').disabled).toBe(true);
    expect(
      container.querySelector<HTMLFieldSetElement>('form > fieldset')?.disabled,
    ).toBe(true);
  });
});
