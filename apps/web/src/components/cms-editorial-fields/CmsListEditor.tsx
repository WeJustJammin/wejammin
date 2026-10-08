import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldFrame from './CmsFieldFrame';
import CmsScalarControl from './CmsScalarControl';
import type {
  CmsListDescriptor,
  CmsScalarConstraints,
  CmsScalarKind,
} from './cms-field-descriptor';
import { describeCmsConstraints } from './cms-field-descriptor';
import { cmsFieldIds } from './cms-field-ids';
import type { CmsFieldIssue } from './cms-field-issue';
import { useInputErrors } from './use-input-errors';

export interface CmsListEditorProps {
  readonly descriptor: CmsListDescriptor;
  readonly value: JsonValue | null;
  readonly issues: readonly CmsFieldIssue[];
  readonly disabled?: boolean | undefined;
  readonly onChange: (value: JsonValue | null) => void;
  readonly onInputError?: ((message: string | null) => void) | undefined;
  readonly onBlur?: (() => void) | undefined;
}

const LIST_ITEMS_MAX = 128;

const newItem = (kind: CmsScalarKind): JsonValue | null =>
  kind === 'boolean'
    ? false
    : kind === 'short_text' || kind === 'long_text' || kind === 'enum'
      ? ''
      : null;

const itemConstraints = (
  descriptor: CmsListDescriptor,
): CmsScalarConstraints =>
  descriptor.itemKind === 'short_text' ||
  descriptor.itemKind === 'long_text' ||
  descriptor.itemKind === 'enum'
    ? descriptor.constraints
    : {};

/**
 * A list field: one native control per item (typed by the declared itemKind)
 * with explicit add, remove and move buttons, never pointer-only reordering.
 */
export default function CmsListEditor({
  descriptor,
  value,
  issues,
  disabled,
  onChange,
  onInputError,
  onBlur,
}: CmsListEditorProps): React.ReactElement {
  const items: readonly (JsonValue | null)[] = Array.isArray(value)
    ? value
    : [];
  const errorFor = useInputErrors(onInputError);
  const ids = cmsFieldIds(descriptor.fieldId);
  const set = (next: readonly (JsonValue | null)[]): void =>
    onChange(next as JsonValue);
  const move = (from: number, to: number): void => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved ?? null);
    set(next);
  };
  return (
    <CmsFieldFrame
      field={descriptor}
      mode="legend"
      hint={[
        describeCmsConstraints(itemConstraints(descriptor), {
          required: false,
          includeRequired: false,
        }),
        `Up to ${LIST_ITEMS_MAX} items.`,
      ]
        .filter((part) => part !== '')
        .join(' ')}
      issues={issues.filter(
        (issue) => issue.index === undefined && issue.propertyKey === undefined,
      )}
    >
      {() => (
        <>
          <ol>
            {items.map((item, index) => {
              const name = `${descriptor.label} item ${index + 1}`;
              const own = issues.filter((issue) => issue.index === index);
              const errorId = `${ids.control}-item-${index}-errors`;
              return (
                <li key={index}>
                  <CmsScalarControl
                    id={`${ids.control}-item-${index}`}
                    label={name}
                    kind={descriptor.itemKind}
                    constraints={itemConstraints(descriptor)}
                    value={item}
                    required={false}
                    invalid={own.length > 0}
                    describedBy={own.length > 0 ? errorId : undefined}
                    disabled={disabled}
                    onBlur={onBlur}
                    onInputError={errorFor(String(index))}
                    onChange={(next) =>
                      set(
                        items.map((current, at) =>
                          at === index ? next : current,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Move ${name} up`}
                    disabled={disabled === true || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${name} down`}
                    disabled={disabled === true || index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    disabled={disabled}
                    onClick={() => set(items.filter((_, at) => at !== index))}
                  >
                    Remove
                  </button>
                  {own.length > 0 ? (
                    <ul id={errorId} className="cms-field-errors">
                      {own.map((issue, at) => (
                        <li key={`${issue.code}-${at}`}>{issue.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            aria-label={`Add ${descriptor.label} item`}
            disabled={disabled === true || items.length >= LIST_ITEMS_MAX}
            onClick={() => set([...items, newItem(descriptor.itemKind)])}
          >
            Add item
          </button>
        </>
      )}
    </CmsFieldFrame>
  );
}
