// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SURVIVOR_ID } from '../../server/cms-taxonomy-platform.test-support';
import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermAction from './CmsTaxonomyTermAction';
import type { TermFormState } from './use-term-form';
import { organ, pageFacts, termFacts } from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const mergeForm = (survivorId: string): TermFormState => ({
  action: 'merge',
  target: termFacts(),
  termKey: '',
  parentId: '',
  survivorId,
  survivorLost: false,
  labels: [],
  aliases: [],
  step: 'confirm',
});

const mountAction = (form: TermFormState, onChange = vi.fn()) => {
  const { container } = mountElement(
    <CmsTaxonomyTermAction
      form={form}
      shape="hierarchical"
      taxonomyId="40000000-0000-4000-8000-000000000001"
      terms={pageFacts([termFacts(), organ]).items}
      pageComplete
      issues={[]}
      pending={false}
      disabled={false}
      onChange={onChange}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return { container, onChange };
};

describe('CmsTaxonomyTermAction: the merge review needs a survivor it can name (FE03 :887)', () => {
  it('reviews the merge of a survivor that is offered, naming it', () => {
    const { container, onChange } = mountAction(mergeForm(SURVIVOR_ID));
    expect(container.querySelector('.cms-term-confirm')?.textContent).toContain(
      'Merge guitar (Guitar) into organ (Organ).',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never renders the review for a survivor that is not offered, and clears it back to the edit step', () => {
    const { container, onChange } = mountAction(
      mergeForm('50000000-0000-4000-8000-0000000000ff'),
    );
    expect(container.querySelector('.cms-term-confirm')).toBeNull();
    expect(container.textContent).not.toContain('Deprecate');
    expect(onChange).toHaveBeenCalledWith({
      survivorId: '',
      survivorLost: true,
      step: 'edit',
    });
  });
});
