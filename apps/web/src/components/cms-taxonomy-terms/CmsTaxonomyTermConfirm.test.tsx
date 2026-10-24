// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsTaxonomyTermConfirm from './CmsTaxonomyTermConfirm';
import { organ, termFacts } from './term-form.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const common = {
  target: termFacts(),
  pending: false,
  disabled: false,
  onBack: vi.fn(),
} as const;

describe('CmsTaxonomyTermConfirm: a merge review always names its survivor (FE03 :887)', () => {
  it('words a merge with the survivor it redirects to', () => {
    const { container } = mountElement(
      <CmsTaxonomyTermConfirm {...common} action="merge" survivor={organ} />,
    );
    expect(container.textContent).toContain(
      'Merge guitar (Guitar) into organ (Organ).',
    );
    expect(container.textContent).not.toContain('Deprecate');
    expect(container.querySelector('h4')?.textContent).toBe(
      'Confirm the merge',
    );
  });

  it('words a deprecation without a survivor', () => {
    const { container } = mountElement(
      <CmsTaxonomyTermConfirm {...common} action="deprecate" />,
    );
    expect(container.textContent).toContain('Deprecate guitar (Guitar).');
    expect(container.querySelector('h4')?.textContent).toBe(
      'Confirm the deprecation',
    );
  });

  it('does not type-check a merge review whose survivor is null', () => {
    // The F4 defect was `merge` with `survivor={null}`, not merely omitting the prop: the pre-fix
    // props required `survivor: TermFacts | null`, so omission was already an error and a
    // directive on it guards nothing. The union now admits a merge only with a real survivor, so
    // passing null is the error this directive has to see (astro check enforces it). The directive
    // sits immediately above the invalid JSX line, the only line TypeScript applies it to.
    const element = (
      // @ts-expect-error a merge needs a survivor: there is no deprecate-sentence fallback
      <CmsTaxonomyTermConfirm {...common} action="merge" survivor={null} />
    );
    expect(element.props.action).toBe('merge');
  });
});
