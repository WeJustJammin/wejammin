import * as React from 'react';

import CmsPatternSelector, { PATTERN_SELECT_ID } from './CmsPatternSelector';
import type {
  InsertField,
  InsertIssue,
  PlacementFields,
} from './composition-insert-fields';
import type { ReadState, SelectorPage } from './composition-types';

export const INSERT_HEADING_ID = 'cms-insert-heading';
const SLOT_ID = 'cms-insert-slot-path';
const OVERRIDES_ID = 'cms-insert-overrides';
const LINK_ID = 'cms-insert-link-mode';
const FIELD_IDS: Readonly<Record<InsertField, string>> = {
  pattern: PATTERN_SELECT_ID,
  linkMode: `${LINK_ID}-linked`,
  slotPath: SLOT_ID,
  overrides: OVERRIDES_ID,
};

export interface CmsPatternInsertFormProps {
  readonly page: SelectorPage;
  readonly selectorState: ReadState<unknown>;
  readonly fields: PlacementFields;
  readonly issues: readonly InsertIssue[];
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onChange: (patch: Partial<PlacementFields>) => void;
  readonly onSubmit: () => void;
  readonly onLoadMore: () => void;
}

/** FE03 1048: while the pattern read runs or after it failed, the last verified page is kept but submit stays off. */
const selectorUnverified = (state: ReadState<unknown>): boolean =>
  state.kind === 'loading' ||
  state.kind === 'failed' ||
  state.kind === 'stale' ||
  state.kind === 'rate_limited';

const messageOf = (
  issues: readonly InsertIssue[],
  field: InsertField,
): string | null =>
  issues.find((issue) => issue.field === field)?.message ?? null;

function FieldMessage({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | null;
}): React.ReactElement | null {
  return message === null ? null : (
    <p id={id} className="cms-composition-error">
      {message}
    </p>
  );
}

/**
 * The instance-insert form (FE03 1114; P2-S12-AC-045): a native form that places one pattern version on the entry's
 * current draft. Overrides are retained until a success. Validation names the field and nothing is sent while a
 * problem remains.
 */
export default function CmsPatternInsertForm(
  props: CmsPatternInsertFormProps,
): React.ReactElement {
  const { page, selectorState, fields, issues, pending, disabled } = props;
  const slotMessage = messageOf(issues, 'slotPath');
  const overridesMessage = messageOf(issues, 'overrides');
  const linkMessage = messageOf(issues, 'linkMode');
  const focusField = (field: InsertField) => (event: React.MouseEvent) => {
    const control = document.getElementById(FIELD_IDS[field]);
    if (control === null) return;
    event.preventDefault();
    control.focus();
  };
  return (
    <section aria-labelledby={INSERT_HEADING_ID} className="cms-insert">
      <h2 id={INSERT_HEADING_ID}>Insert a pattern</h2>
      {issues.length > 0 ? (
        <div role="alert" className="cms-composition-summary">
          <p>
            {issues.length} {issues.length === 1 ? 'problem' : 'problems'} to
            fix; nothing was sent.
          </p>
          <ul>
            {issues.map((issue) => (
              <li key={issue.field}>
                <a
                  href={`#${FIELD_IDS[issue.field]}`}
                  onClick={focusField(issue.field)}
                >
                  {issue.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <CmsPatternSelector
          page={page}
          state={selectorState}
          selectedId={fields.item?.patternVersionId ?? null}
          invalid={messageOf(issues, 'pattern')}
          disabled={disabled}
          onSelect={(item) => props.onChange({ item })}
          onLoadMore={props.onLoadMore}
        />
        <fieldset
          aria-describedby={
            linkMessage === null ? undefined : `${LINK_ID}-error`
          }
          disabled={disabled}
        >
          <legend>Link mode</legend>
          {(
            [
              ['linked', 'Linked: receives pattern updates'],
              [
                'detached',
                'Detached: a local copy that never receives updates',
              ],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="cms-diff-choice">
              <input
                type="radio"
                id={`${LINK_ID}-${value}`}
                name="linkMode"
                value={value}
                checked={fields.linkMode === value}
                aria-invalid={linkMessage === null ? undefined : true}
                onChange={() => props.onChange({ linkMode: value })}
              />
              {label}
            </label>
          ))}
          <FieldMessage id={`${LINK_ID}-error`} message={linkMessage} />
        </fieldset>
        <div className="cms-composition-field">
          <label htmlFor={SLOT_ID}>Slot path</label>
          <input
            id={SLOT_ID}
            type="text"
            value={fields.slotPath}
            disabled={disabled}
            aria-invalid={slotMessage === null ? undefined : true}
            aria-describedby={
              slotMessage === null ? undefined : `${SLOT_ID}-error`
            }
            onChange={(event) =>
              props.onChange({ slotPath: event.target.value })
            }
          />
          <FieldMessage id={`${SLOT_ID}-error`} message={slotMessage} />
        </div>
        <div className="cms-composition-field">
          <label htmlFor={OVERRIDES_ID}>Overrides (JSON, optional)</label>
          <textarea
            id={OVERRIDES_ID}
            rows={4}
            value={fields.overridesText}
            disabled={disabled}
            aria-invalid={overridesMessage === null ? undefined : true}
            aria-describedby={`${OVERRIDES_ID}-hint${overridesMessage === null ? '' : ` ${OVERRIDES_ID}-error`}`}
            onChange={(event) =>
              props.onChange({ overridesText: event.target.value })
            }
          />
          <p id={`${OVERRIDES_ID}-hint`}>
            An object keyed by node path, for example{' '}
            {'{"/hero": {"title": "…"}}'}. Your overrides are kept until the
            pattern is placed.
          </p>
          <FieldMessage
            id={`${OVERRIDES_ID}-error`}
            message={overridesMessage}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || pending || selectorUnverified(selectorState)}
        >
          Place pattern
        </button>
      </form>
    </section>
  );
}
