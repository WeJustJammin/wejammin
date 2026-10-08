import * as React from 'react';

import type { CmsFieldBase } from './cms-field-descriptor';
import { cmsFieldIds } from './cms-field-ids';
import type { CmsFieldIssue } from './cms-field-issue';

export type CmsFieldFrameMode = 'label' | 'checkbox' | 'legend' | 'embedded';

export interface CmsFieldFrameRender {
  readonly controlId: string;
  readonly labelId: string;
  readonly labelText: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
}

export interface CmsFieldFrameProps {
  readonly field: CmsFieldBase;
  readonly mode: CmsFieldFrameMode;
  /** Plain-language statement of the declared constraints; may be empty. */
  readonly hint: string;
  /** Issues about the field as a whole (not about one property or item). */
  readonly issues: readonly CmsFieldIssue[];
  readonly children: (render: CmsFieldFrameRender) => React.ReactNode;
}

/**
 * The persistent label, description and error surface around one control. The
 * label is always visible (never a placeholder), the help and constraint text
 * are linked as the control's description, and errors are linked too, so a
 * screen reader reads name, requirement, rules and problems in one pass.
 */
export default function CmsFieldFrame({
  field,
  mode,
  hint,
  issues,
  children,
}: CmsFieldFrameProps): React.ReactElement {
  const ids = cmsFieldIds(field.fieldId);
  const labelText = `${field.label}${field.required ? ' (required)' : ''}`;
  const hasHelp = field.helpText !== undefined && field.helpText !== '';
  const hasHint = hint !== '';
  const hasErrors = issues.length > 0;
  const describedBy =
    [
      hasHelp ? ids.help : null,
      hasHint ? ids.hint : null,
      hasErrors ? ids.errors : null,
    ]
      .filter((id): id is string => id !== null)
      .join(' ') || undefined;
  const body = children({
    controlId: ids.control,
    labelId: ids.label,
    labelText,
    describedBy,
    invalid: hasErrors,
  });
  const notes = (
    <>
      {hasHelp ? <p id={ids.help}>{field.helpText}</p> : null}
      {hasHint ? <p id={ids.hint}>{hint}</p> : null}
      {hasErrors ? (
        <ul id={ids.errors} className="cms-field-errors">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
  const common = {
    id: ids.group,
    'data-cms-editorial-field': field.fieldId,
    'data-cms-editorial-field-key': field.key,
  };
  if (mode === 'legend')
    return (
      <fieldset {...common} aria-describedby={describedBy}>
        <legend id={ids.label}>{labelText}</legend>
        {notes}
        {body}
      </fieldset>
    );
  if (mode === 'checkbox')
    return (
      <div {...common}>
        {body}
        <label id={ids.label} htmlFor={ids.control}>
          {labelText}
        </label>
        {notes}
      </div>
    );
  if (mode === 'embedded')
    return (
      <div {...common}>
        {body}
        {notes}
      </div>
    );
  return (
    <div {...common}>
      <label id={ids.label} htmlFor={ids.control}>
        {labelText}
      </label>
      {body}
      {notes}
    </div>
  );
}
