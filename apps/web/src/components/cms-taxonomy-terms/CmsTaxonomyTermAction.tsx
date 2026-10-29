import * as React from 'react';

import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import CmsTaxonomyAliasList from './CmsTaxonomyAliasList';
import CmsTaxonomyLabelRows from './CmsTaxonomyLabelRows';
import CmsTaxonomyTermChoice from './CmsTaxonomyTermChoice';
import { TermKeyField } from './CmsTaxonomyTermFields';
import type { TermFacts, readTaxonomyTerms } from './taxonomy-terms-read';
import type { TermIssue } from './term-action-request';
import { ACTION_CONSEQUENCE, ACTION_LABEL } from './term-copy';
import { termReview } from './term-review';
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

const SUBMIT_LABEL = {
  create: 'Create term',
  rename: 'Rename term',
  alias: 'Add the alias',
  deprecate: 'Review the deprecation',
  merge: 'Review the merge',
} as const;

const PARENT_HELP = {
  rename:
    'Leave the current parent to keep the term where it is. Choosing none moves it to the top level.',
  create: 'Lists the active and deprecated terms of this vocabulary.',
} as const;

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
  // Distinct held options, in order: the form's own parent, then the stored current parent to undo to.
  const held = [heldParent, undoParent].filter(
    (choice): choice is NonNullable<typeof choice> => choice !== null,
  );
  const title =
    target === null
      ? ACTION_LABEL.create
      : `${ACTION_LABEL[action]}: ${target.termKey}`;
  const onBack = () => onChange({ step: 'edit' });
  const review = termReview({ form, survivor, pending, disabled, onBack });
  const confirming = review !== null;
  const heading = React.useRef<HTMLHeadingElement>(null);
  // This form loads on demand: the hook's focus effect ran before the chunk arrived and found no heading, so the form
  // takes focus itself when it mounts (and again when its confirmation step appears, with the hook's effect).
  const takeFocus = React.useRef(shouldTakeFocus);
  // A form that arrives while the person is elsewhere does not take their place; it says that it is there instead.
  const [arrivedElsewhere, setArrivedElsewhere] = React.useState(false);
  React.useEffect(() => {
    // On mount only: the arrival of the chunk, not a later render.
    if (takeFocus.current === undefined || takeFocus.current())
      heading.current?.focus();
    else setArrivedElsewhere(true);
  }, []);
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
                  held={held}
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
              <button type="submit" disabled={pending || disabled}>
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
