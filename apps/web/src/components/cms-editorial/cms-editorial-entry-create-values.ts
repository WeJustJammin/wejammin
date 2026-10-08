import type { AuthoringContextField, JsonValue } from '@wejammin/contracts';

import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import {
  isCmsFieldValueEmpty,
  validateCmsFieldValue,
  type CmsFieldIssue,
} from '../cms-editorial-fields/cms-field-value';

/**
 * A field can be authored through CMS-03B-10 only when it has a producer:
 * taxonomy and media have none yet, an unreadable definition is unsupported,
 * and a relation is written by the revision route after the entry exists
 * (BE03b: the create request carries no relations).
 */
export const isCmsCreateAuthorable = (
  descriptor: CmsFieldDescriptor,
): boolean =>
  descriptor.kind !== 'taxonomy' &&
  descriptor.kind !== 'media' &&
  descriptor.kind !== 'unsupported' &&
  descriptor.kind !== 'relation';

/** Literal defaults are prefilled; everything else starts as no value. */
export const initialCmsCreateValues = (
  fields: readonly AuthoringContextField[],
): Record<string, JsonValue | null> =>
  Object.fromEntries(
    fields.map((field) => [
      field.stableFieldId,
      field.defaultMode === 'literal' ? (field.defaultValue ?? null) : null,
    ]),
  );

export interface CmsCreateCollection {
  /** The values to send: only fields that hold a value (or were set), never empty. */
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly issues: ReadonlyMap<string, readonly CmsFieldIssue[]>;
}

/**
 * Collects what the create form sends and what blocks it. A field is sent when
 * it holds a non-empty value, or when the author set it deliberately (a boolean
 * left unchecked is a value only once touched). A required field with no value
 * is an issue; a present value is validated with the database's own semantics.
 */
export const collectCmsCreateValues = (
  descriptors: readonly CmsFieldDescriptor[],
  values: Readonly<Record<string, JsonValue | null>>,
  touched: ReadonlySet<string>,
): CmsCreateCollection => {
  const included: Record<string, JsonValue> = {};
  const issues = new Map<string, readonly CmsFieldIssue[]>();
  for (const descriptor of descriptors) {
    if (!isCmsCreateAuthorable(descriptor)) continue;
    const value = values[descriptor.fieldId] ?? null;
    const found = validateCmsFieldValue(descriptor, value);
    if (found.length > 0) issues.set(descriptor.fieldId, found);
    const holdsValue =
      value !== null &&
      (!isCmsFieldValueEmpty(descriptor, value) ||
        (touched.has(descriptor.fieldId) && typeof value === 'boolean'));
    if (holdsValue && value !== null) included[descriptor.fieldId] = value;
  }
  return { values: included, issues };
};
