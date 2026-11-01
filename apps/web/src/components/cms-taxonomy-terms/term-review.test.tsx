// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { TermFacts } from './taxonomy-terms-read';
import { organ, termFacts } from './term-form.test-support';
import { termReview } from './term-review';
import type { TermFormState } from './use-term-form';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const form = (patch: Partial<TermFormState>): TermFormState => ({
  action: 'deprecate',
  target: termFacts(),
  termKey: '',
  parentId: '',
  survivorId: '',
  survivorLost: false,
  labels: [],
  aliases: [],
  step: 'confirm',
  ...patch,
});

const review = (
  patch: Partial<TermFormState>,
  survivor: TermFacts | null = organ,
) =>
  termReview({
    form: form(patch),
    survivor,
    pending: false,
    disabled: false,
    onBack: vi.fn(),
  });

const text = (element: ReturnType<typeof review>): string | undefined => {
  if (element === null) return undefined;
  return mountElement(element).container.textContent ?? undefined;
};

describe('termReview: only an irreversible action on its confirm step has a review (FE03 :887)', () => {
  it('words a deprecation', () => {
    expect(text(review({ action: 'deprecate' }))).toContain(
      'Deprecate guitar (Guitar).',
    );
  });

  it('words a merge with the survivor it is sent with', () => {
    expect(text(review({ action: 'merge' }))).toContain(
      'Merge guitar (Guitar) into organ (Organ).',
    );
  });

  it('shows no review for a merge without an offered survivor', () => {
    expect(review({ action: 'merge' }, null)).toBeNull();
  });

  it('shows no review on the edit step', () => {
    expect(review({ action: 'deprecate', step: 'edit' })).toBeNull();
  });

  it('shows no review without a target', () => {
    expect(review({ action: 'deprecate', target: null })).toBeNull();
  });

  it.each(['create', 'rename', 'alias'] as const)(
    'never words %s as a deprecation',
    (action) => {
      expect(review({ action })).toBeNull();
    },
  );
});
