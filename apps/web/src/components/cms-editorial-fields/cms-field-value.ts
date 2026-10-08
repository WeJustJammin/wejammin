import type { JsonValue } from '@wejammin/contracts';

import {
  isCmsUnavailableDescriptor,
  type CmsFieldDescriptor,
} from './cms-field-descriptor';
import { cmsIssue, type CmsFieldIssue } from './cms-field-issue';
import { validateCmsScalarValue } from './cms-field-value-scalar';
import {
  cmsRichTextIsEmpty,
  isJsonRecord,
  cmsTextIsEmpty,
  validateCmsList,
  validateCmsObject,
  validateCmsRelation,
  validateCmsRichText,
} from './cms-field-value-structured';

export type { CmsFieldIssue } from './cms-field-issue';
export { CMS_EMPTY_RICH_TEXT } from './cms-field-value-structured';
export {
  cmsDatetimeToLocalInput,
  cmsLocalInputToDatetime,
} from './cms-field-value-scalar';

/**
 * True when the value is the absence of a value: null, empty text, an empty
 * list, an object with no keys, a relation with no targets, or rich text with
 * no characters. A boolean or a number (zero included) is always a value.
 */
export const isCmsFieldValueEmpty = (
  descriptor: CmsFieldDescriptor,
  value: JsonValue | null,
): boolean => {
  if (value === null) return true;
  switch (descriptor.kind) {
    case 'rich_text':
      return cmsRichTextIsEmpty(value);
    case 'list':
      return Array.isArray(value) && value.length === 0;
    case 'object':
      return isJsonRecord(value) && Object.keys(value).length === 0;
    case 'relation':
      return (
        isJsonRecord(value) &&
        Array.isArray(value.targets) &&
        value.targets.length === 0
      );
    case 'taxonomy':
    case 'media':
    case 'unsupported':
      return true;
    default:
      return cmsTextIsEmpty(value);
  }
};

/**
 * Validates one field value with the semantics the database applies
 * (`cms_field_kind_value_shape`), so the browser refuses what the server would
 * refuse and the author sees why before a request is sent. An empty value is
 * only an issue when the field is required.
 */
export const validateCmsFieldValue = (
  descriptor: CmsFieldDescriptor,
  value: JsonValue | null,
): readonly CmsFieldIssue[] => {
  if (isCmsUnavailableDescriptor(descriptor)) return [];
  if (isCmsFieldValueEmpty(descriptor, value))
    return descriptor.required
      ? [cmsIssue('required', 'This field is required.')]
      : [];
  if (value === null) return [];
  switch (descriptor.kind) {
    case 'rich_text':
      return validateCmsRichText(descriptor, value);
    case 'list':
      return validateCmsList(descriptor, value);
    case 'object':
      return validateCmsObject(descriptor, value);
    case 'relation':
      return validateCmsRelation(descriptor, value);
    default:
      return validateCmsScalarValue(
        descriptor.kind,
        descriptor.constraints,
        value,
      );
  }
};

/** A stored value as the editor's starting point; absence stays absence. */
export const initialCmsFieldValue = (
  _descriptor: CmsFieldDescriptor,
  stored: JsonValue | null | undefined,
): JsonValue | null => stored ?? null;
