import * as React from 'react';

import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import CmsTaxonomyAliasList from './CmsTaxonomyAliasList';
import CmsTaxonomyLabelRows from './CmsTaxonomyLabelRows';
import CmsTaxonomyTermChoice from './CmsTaxonomyTermChoice';
import { TermKeyField } from './CmsTaxonomyTermFields';
import type { TermFacts, readTaxonomyTerms } from './taxonomy-terms-read';
import type { TermIssue } from './term-action-request';
import {
  ACTION_CONSEQUENCE,
  ACTION_LABEL,
  PARENT_HELP,
  SUBMIT_LABEL,
} from './term-copy';
import { termReview } from './term-review';
import { useTermActionFocus } from './use-term-action-focus';
import { useTermActionChoices } from './use-term-action-choices';
import { TERM_FORM_HEADING_ID, type TermFormState } from './use-term-form';

interface Props {
  readonly form: TermFormState;
  readonly shape: TaxonomyShape;
  readonly taxonomyId: string;
  /** The terms of the loaded page: where the parent and survivor choices start. */
  readonly terms: readonly TermFacts[];
  /** True when that page is the whole vocabulary, so no further read is needed. */
  readonly pageComplete: boolean;
  readonly readTerms?: typeof readTaxonomyTerms | undefined;
  readonly issues: readonly TermIssue[];
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<TermFormState>) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  /** Asked when the form mounts: is focus still where the opening press left it? Default: yes. */
  readonly shouldTakeFocus?: (() => boolean) | undefined;
}

const issuesFor = (issues: readonly TermIssue[], field: TermIssue['field']) =>
  issues.filter((entry) => entry.field === field);

/** The inline form of one term action (FE03 :887): fields by action, then a review step when irreversible. */
export default function CmsTaxonomyTermAction({
  form,
  shape,
  taxonomyId,
  terms,
  pageComplete,
  readTerms,
  issues,
  pending,
  disabled,
  onChange,
  onSubmit,
  onCancel,
  shouldTakeFocus,
}: Props): React.ReactElement {
  const { action, target } = form;
  const { hasParent, loader, choices, survivor, heldParent, undoParent } =
    useTermActionChoices({
      form,
      shape,
      taxonomyId,
      terms,
      pageComplete,
      readTerms,
      onChange,
    });
  // Distinct held parent options, in order: the form's own parent, then the stored current parent to undo to.
  const heldOptions = [heldParent, undoParent].filter(
    (choice): choice is NonNullable<typeof choice> => choice !== null,
  );
  const title =
    target === null
      ? ACTION_LABEL.create
      : `${ACTION_LABEL[action]}: ${target.termKey}`;
  const onBack = () => onChange({ step: 'edit' });
  // FE03 1048: the commit control is also off while a picker page is still loading.
  const commitOff = disabled || loader.status === 'loading';
  const review = termReview({
    form,
    survivor,
    pending,
    disabled: commitOff,
    onBack,
  });
  const confirming = review !== null;
  const { heading, arrivedElsewhere } = useTermActionFocus(shouldTakeFocus);
  return (
    <section className="cms-term-action" aria-labelledby={TERM_FORM_HEADING_ID}>
      <h3 id={TERM_FORM_HEADING_ID} tabIndex={-1} ref={heading}>
        {confirming ? `Review: ${title}` : title}
      </h3>
      {arrivedElsewhere ? <p role="status">The term form is ready.</p> : null}
      <p>{ACTION_CONSEQUENCE[action]}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && confirming) {
            event.stopPropagation();
            onBack();
          }
        }}
      >
        <fieldset>
          <legend>{title}</legend>
          {review ?? (
            <>
              {action === 'create' ? (
                <TermKeyField
                  value={form.termKey}
                  issues={issuesFor(issues, 'termKey')}
                  onChange={(termKey) => onChange({ termKey })}
                />
              ) : (
                <p>
                  Term: <strong>{target?.termKey}</strong>
                </p>
              )}
              {action === 'create' || action === 'rename' ? (
                <CmsTaxonomyLabelRows
                  rows={form.labels}
                  onChange={(labels) => onChange({ labels })}
                  issues={issues}
                />
              ) : null}
              {action === 'create' || action === 'alias' ? (
                <CmsTaxonomyAliasList
                  aliases={form.aliases}
                  onChange={(aliases) => onChange({ aliases })}
                  issues={issues}
                  help={
                    action === 'create'
                      ? 'Optional. Other names authors may search by.'
                      : 'Type an alias and press Enter. Existing aliases stay.'
                  }
                />
              ) : null}
              {hasParent && (action === 'create' || action === 'rename') ? (
                <CmsTaxonomyTermChoice
                  id="cms-term-parent"
                  label="Parent term"
                  value={form.parentId}
                  empty="No parent (top level)"
                  choices={choices}
                  held={heldOptions}
                  loader={loader}
                  issues={issuesFor(issues, 'parentId')}
                  onChange={(parentId) => onChange({ parentId })}
                  help={PARENT_HELP[action]}
                />
              ) : null}
              {action === 'merge' ? (
                <CmsTaxonomyTermChoice
                  id="cms-term-survivor"
                  label="Merge into"
                  value={form.survivorId}
                  empty="Choose a term"
                  choices={choices}
                  loader={loader}
                  issues={issuesFor(issues, 'survivorId')}
                  onChange={(survivorId) =>
                    onChange({ survivorId, survivorLost: false })
                  }
                  help="The term that stays. Lists the active and deprecated terms of this vocabulary."
                />
              ) : null}
              {action === 'merge' &&
              form.survivorId === '' &&
              form.survivorLost ? (
                <p role="status">
                  The term you chose to merge into is no longer available.
                  Choose a term again.
                </p>
              ) : null}
              {issuesFor(issues, 'form').map((entry) => (
                <p key={entry.code} className="cms-field-errors">
                  {entry.message}
                </p>
              ))}
              <button type="submit" disabled={pending || commitOff}>
                {pending ? 'Saving…' : SUBMIT_LABEL[action]}
              </button>
              <button type="button" disabled={pending} onClick={onCancel}>
                Cancel
              </button>
            </>
          )}
        </fieldset>
      </form>
    </section>
  );
}
