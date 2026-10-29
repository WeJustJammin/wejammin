import type { JsonValue, TaxonomySelectorPage } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldFrame from './CmsFieldFrame';
import type { CmsTaxonomyDescriptor } from './cms-field-descriptor';
import { cmsFieldIds } from './cms-field-ids';
import type { CmsFieldIssue } from './cms-field-issue';
import { isJsonRecord } from './cms-field-basics';
import {
  cmsTaxonomyLevelReader,
  cmsTaxonomyTermLevelText,
} from './cms-taxonomy-field-level';

export interface CmsTaxonomyFieldEditorProps {
  readonly descriptor: CmsTaxonomyDescriptor;
  /** The CMS-03C-17 selector page: the terms the caller may choose from. */
  readonly page: TaxonomySelectorPage;
  readonly value: JsonValue | null;
  readonly onChange: (value: JsonValue | null) => void;
  /** The typed field-level refusal, announced assertively. */
  readonly error?: string | undefined;
  /** Issues about the field as a whole, linked by the frame. */
  readonly issues?: readonly CmsFieldIssue[] | undefined;
  readonly disabled?: boolean | undefined;
  readonly onBlur?: (() => void) | undefined;
}

/** The value bound of BE03b "Value encodings by field kind" for taxonomy. */
export const CMS_TAXONOMY_TERM_IDS_MAX = 128;

/**
 * What a stored value says, strictly: only a string `termIds` array is read, in
 * the order it carries, and nothing else of the value is interpreted. The array
 * is kept exactly as it stands: the BE03b shape permits a repeated id, so a
 * choice must never rewrite an entry it did not make. Terms the page does not
 * list stay in the value untouched, since the paged selector cannot vouch for
 * them and only the author may drop them.
 */
const termIdsOf = (value: JsonValue | null): readonly string[] => {
  if (!isJsonRecord(value)) return [];
  const ids: unknown = value.termIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string');
};

/**
 * The taxonomy field control: a group of native checkboxes over the active
 * terms of the entry type and field key, in the shape the database enforces
 * (`{ termIds: UUID[] <= 128 }`). It is presentational: the page arrives as a
 * prop, the value is the host's, and nothing here fetches, refetches or writes
 * on its own — a render never changes the value, an empty or refreshed page
 * never drops a selection, and only the author's own activation writes (a
 * checkbox, or the explicit `Clear selection` command, the one path that writes
 * an empty list).
 */
export default function CmsTaxonomyFieldEditor({
  descriptor,
  page,
  value,
  onChange,
  error,
  issues,
  disabled,
  onBlur,
}: CmsTaxonomyFieldEditorProps): React.ReactElement {
  const ids = cmsFieldIds(descriptor.fieldId);
  const selected = termIdsOf(value);
  const selectedIds = new Set(selected);
  const levelOf = cmsTaxonomyLevelReader(page);
  const atBound = selected.length >= CMS_TAXONOMY_TERM_IDS_MAX;
  const wholeFieldIssues = (issues ?? []).filter(
    (issue) => issue.index === undefined && issue.propertyKey === undefined,
  );
  const noun = selected.length === 1 ? 'term' : 'terms';
  const countText = `${selected.length} ${noun} selected.`;
  const setTerm = (termId: string, selectedNow: boolean): void => {
    const kept = selected.filter((id) => id !== termId);
    onChange({ termIds: selectedNow ? [...kept, termId] : kept });
  };
  return (
    <CmsFieldFrame
      field={descriptor}
      mode="legend"
      hint={`Select up to ${CMS_TAXONOMY_TERM_IDS_MAX} terms.`}
      issues={wholeFieldIssues}
    >
      {() => (
        <>
          <ol>
            {page.items.map((term, index) => {
              const controlId = `${ids.control}-term-${index}`;
              const levelText = cmsTaxonomyTermLevelText(levelOf(term));
              const levelId =
                levelText === undefined ? undefined : `${controlId}-level`;
              const checked = selectedIds.has(term.termId);
              const name = term.label ?? term.termKey;
              return (
                <li key={term.termId}>
                  <input
                    id={controlId}
                    type="checkbox"
                    value={term.termId}
                    checked={checked}
                    disabled={disabled === true || (atBound && !checked)}
                    aria-describedby={levelId}
                    onBlur={onBlur}
                    onChange={() => setTerm(term.termId, !checked)}
                  />
                  <label htmlFor={controlId}>{name}</label>
                  {levelText === undefined ? null : (
                    <span id={levelId}>{levelText}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {error === undefined ? null : <p role="alert">{error}</p>}
          <p role="status" aria-live="polite" aria-atomic="true">
            {countText}
          </p>
          {selected.length === 0 ? null : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ termIds: [] })}
            >
              Clear selection
            </button>
          )}
        </>
      )}
    </CmsFieldFrame>
  );
}
