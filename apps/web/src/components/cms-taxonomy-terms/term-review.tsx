import type * as React from 'react';

import CmsTaxonomyTermConfirm from './CmsTaxonomyTermConfirm';
import type { TermFacts } from './taxonomy-terms-read';
import type { TermFormState } from './use-term-form';

interface ReviewOptions {
  readonly form: TermFormState;
  /** The chosen merge survivor, or null when none is chosen or it is not offered. */
  readonly survivor: TermFacts | null;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onBack: () => void;
}

/**
 * The review step of an irreversible action, or null when there is none to show: not on the
 * confirm step, or a merge whose survivor is not offered (the sentence must name the term that
 * is sent, FE03 :887).
 */
export const termReview = ({
  form,
  survivor,
  pending,
  disabled,
  onBack,
}: ReviewOptions): React.ReactElement | null => {
  const { action, target } = form;
  if (form.step !== 'confirm' || target === null) return null;
  if (action === 'deprecate')
    return (
      <CmsTaxonomyTermConfirm
        action="deprecate"
        target={target}
        pending={pending}
        disabled={disabled}
        onBack={onBack}
      />
    );
  if (action === 'merge' && survivor !== null)
    return (
      <CmsTaxonomyTermConfirm
        action="merge"
        target={target}
        survivor={survivor}
        pending={pending}
        disabled={disabled}
        onBack={onBack}
      />
    );
  return null;
};
