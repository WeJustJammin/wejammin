// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermChoice from './CmsTaxonomyTermChoice';
import { organ } from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const choice = (loader: {
  more: boolean;
  retry: boolean;
  status: 'ready' | 'loading' | 'failed' | 'restarted';
}) => (
  <CmsTaxonomyTermChoice
    id="cms-term-parent"
    label="Parent term"
    value=""
    empty="No parent (top level)"
    help="help"
    issues={[]}
    choices={[organ]}
    loader={{ ...loader, load: vi.fn() }}
    onChange={vi.fn()}
  />
);

describe('CmsTaxonomyTermChoice: focus moves only when a paging button leaves (FE03 :898, WCAG 2.4.3)', () => {
  it('does not take focus when no paging button was ever shown', () => {
    mountElement(choice({ more: false, retry: false, status: 'ready' }));
    expect(document.activeElement).toBe(document.body);
  });

  it('takes focus for the select when the button leaves and focus fell to the page', () => {
    const { container, rerender } = mountElement(
      choice({ more: true, retry: false, status: 'ready' }),
    );
    expect(container.querySelector('button')).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
    rerender(choice({ more: false, retry: false, status: 'ready' }));
    expect(document.activeElement).toBe(container.querySelector('select'));
  });

  it('leaves focus on another field the person moved to', () => {
    const { container, rerender } = mountElement(
      <>
        <input id="elsewhere" />
        {choice({ more: true, retry: false, status: 'ready' })}
      </>,
    );
    const elsewhere = container.querySelector('input');
    elsewhere?.focus();
    rerender(
      <>
        <input id="elsewhere" />
        {choice({ more: false, retry: false, status: 'ready' })}
      </>,
    );
    expect(document.activeElement).toBe(elsewhere);
  });
});
