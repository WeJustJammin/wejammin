import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsRichTextEditor from '../cms-rich-text/CmsRichTextEditor';
import CmsFieldFrame from './CmsFieldFrame';
import CmsScalarControl from './CmsScalarControl';
import {
  describeCmsConstraints,
  type CmsObjectDescriptor,
  type CmsObjectPropertyDescriptor,
  type CmsScalarKind,
} from './cms-field-descriptor';
import { cmsFieldIds } from './cms-field-ids';
import type { CmsFieldIssue } from './cms-field-issue';
import { CMS_EMPTY_RICH_TEXT } from './cms-field-value';
import { isJsonRecord } from './cms-field-value-structured';
import { useInputErrors } from './use-input-errors';

export interface CmsObjectEditorProps {
  readonly descriptor: CmsObjectDescriptor;
  readonly value: JsonValue | null;
  readonly issues: readonly CmsFieldIssue[];
  readonly disabled?: boolean | undefined;
  readonly onChange: (value: JsonValue | null) => void;
  readonly onInputError?: ((message: string | null) => void) | undefined;
  readonly onBlur?: (() => void) | undefined;
}

type ObjectValue = { readonly [key: string]: JsonValue };

const asObject = (value: JsonValue | null): ObjectValue =>
  isJsonRecord(value) ? value : {};

/**
 * The BE03b `scalar` property kind declares no JSON type, so the control is
 * chosen from what the structure does declare (numeric bounds mean a number) and
 * from the stored value (a stored boolean stays a checkbox); everything else is
 * text. The property is never a free JSON editor.
 */
const scalarControlKind = (
  property: CmsObjectPropertyDescriptor,
  value: JsonValue | null,
): CmsScalarKind => {
  if (property.kind === 'enum') return 'enum';
  if (typeof value === 'boolean') return 'boolean';
  if (
    typeof value === 'number' ||
    property.constraints.minimum !== undefined ||
    property.constraints.maximum !== undefined
  )
    return 'decimal';
  return 'short_text';
};

/**
 * The DEC-133 object editor: exactly the declared depth-1 `properties[]`, each
 * its own labelled group with a native control for its kind (a text or number
 * control for a scalar, a select over the declared choices for an enum, the
 * constrained rich text editor for rich text), required marks and a description
 * derived from the declared constraints. The value is the strict
 * property-keyed object; a cleared optional property is removed, never null.
 */
export default function CmsObjectEditor({
  descriptor,
  value,
  issues,
  disabled,
  onChange,
  onInputError,
  onBlur,
}: CmsObjectEditorProps): React.ReactElement {
  const current = asObject(value);
  const errorFor = useInputErrors(onInputError);
  const ids = cmsFieldIds(descriptor.fieldId);
  const setProperty = (key: string, next: JsonValue | null): void => {
    const rest = Object.fromEntries(
      Object.entries(current).filter(([name]) => name !== key),
    );
    onChange(next === null ? rest : { ...rest, [key]: next });
  };
  return (
    <CmsFieldFrame
      field={descriptor}
      mode="legend"
      hint=""
      issues={issues.filter((issue) => issue.propertyKey === undefined)}
    >
      {() =>
        descriptor.properties.map((property) => {
          const base = `${ids.control}-prop-${property.key}`;
          const own = issues.filter(
            (issue) => issue.propertyKey === property.key,
          );
          const description = describeCmsConstraints(property.constraints, {
            required: property.required,
          });
          const stored = Object.hasOwn(current, property.key)
            ? (current[property.key] ?? null)
            : null;
          const labelText = `${property.label}${property.required ? ' (required)' : ''}`;
          const describedBy =
            [
              description === '' ? null : `${base}-description`,
              own.length > 0 ? `${base}-errors` : null,
            ]
              .filter((id): id is string => id !== null)
              .join(' ') || undefined;
          return (
            <fieldset key={property.key} id={`${base}-group`}>
              <legend id={`${base}-label`}>{labelText}</legend>
              {description === '' ? null : (
                <p id={`${base}-description`}>{description}</p>
              )}
              {property.kind === 'rich_text' ? (
                <CmsRichTextEditor
                  value={stored ?? CMS_EMPTY_RICH_TEXT}
                  label={property.label}
                  onChange={(next) =>
                    setProperty(property.key, next as JsonValue)
                  }
                />
              ) : (
                <CmsScalarControl
                  id={base}
                  labelledBy={`${base}-label`}
                  kind={scalarControlKind(property, stored)}
                  constraints={property.constraints}
                  value={stored}
                  required={property.required}
                  invalid={own.length > 0}
                  describedBy={describedBy}
                  disabled={disabled}
                  onBlur={onBlur}
                  onInputError={errorFor(property.key)}
                  onChange={(next) => setProperty(property.key, next)}
                />
              )}
              {own.length > 0 ? (
                <ul id={`${base}-errors`} className="cms-field-errors">
                  {own.map((issue, at) => (
                    <li key={`${issue.code}-${at}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
            </fieldset>
          );
        })
      }
    </CmsFieldFrame>
  );
}
