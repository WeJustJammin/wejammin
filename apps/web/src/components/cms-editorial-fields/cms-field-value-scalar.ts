import {
  isWellFormedAuthoredString,
  type JsonValue,
} from '@wejammin/contracts';

import type {
  CmsScalarConstraints,
  CmsScalarKind,
} from './cms-field-descriptor';
import { cmsIssue, type CmsFieldIssue } from './cms-field-issue';

/** Unicode characters, as PostgreSQL `length()` counts them (BE03b DEC-144). */
export const cmsCharacterCount = (text: string): number =>
  Array.from(text).length;

/** The field's own message for text the database cannot store. */
export const CMS_INVALID_CHARACTERS_MESSAGE =
  'This text contains a character that cannot be saved. Remove it and try again.';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/u;

const isRealCalendarDate = (
  year: number,
  month: number,
  day: number,
): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const lengthIssues = (
  text: string,
  constraints: CmsScalarConstraints,
): CmsFieldIssue[] => {
  const length = cmsCharacterCount(text);
  const issues: CmsFieldIssue[] = [];
  if (constraints.minLength !== undefined && length < constraints.minLength)
    issues.push(
      cmsIssue(
        'too_short',
        `Enter at least ${constraints.minLength} characters.`,
      ),
    );
  if (constraints.maxLength !== undefined && length > constraints.maxLength)
    issues.push(
      cmsIssue(
        'too_long',
        `Enter at most ${constraints.maxLength} characters.`,
      ),
    );
  return issues;
};

const rangeIssues = (
  value: number,
  constraints: CmsScalarConstraints,
): CmsFieldIssue[] => {
  const issues: CmsFieldIssue[] = [];
  if (constraints.minimum !== undefined && value < constraints.minimum)
    issues.push(
      cmsIssue('below_minimum', `Enter ${constraints.minimum} or more.`),
    );
  if (constraints.maximum !== undefined && value > constraints.maximum)
    issues.push(
      cmsIssue('above_maximum', `Enter ${constraints.maximum} or less.`),
    );
  return issues;
};

/**
 * One non-empty scalar value against its kind and declared constraints, with
 * the semantics `cms_field_kind_value_shape` enforces (BE03b value encodings):
 * the kind fixes the JSON type; length binds text and enum strings; range binds
 * numbers; a date is a real calendar date and a datetime an RFC 3339 instant.
 */
export const validateCmsScalarValue = (
  kind: CmsScalarKind,
  constraints: CmsScalarConstraints,
  value: JsonValue,
): CmsFieldIssue[] => {
  if (kind === 'boolean')
    return typeof value === 'boolean'
      ? []
      : [cmsIssue('invalid_boolean', 'Choose yes or no.')];
  if (kind === 'integer' || kind === 'decimal') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return [cmsIssue('not_a_number', 'Enter a number.')];
    if (kind === 'integer' && !Number.isSafeInteger(value))
      return [cmsIssue('not_integer', 'Enter a whole number.')];
    return rangeIssues(value, constraints);
  }
  if (typeof value !== 'string')
    return [cmsIssue('invalid_text', 'Enter text.')];
  // PostgreSQL `jsonb` refuses a lone surrogate and a NUL; the shared contract
  // predicate is the one rule for every string a field editor submits (short
  // and long text, enum choices, date and datetime text, list items and object
  // property strings all arrive here), so it is checked before any other rule.
  if (!isWellFormedAuthoredString(value))
    return [cmsIssue('invalid_characters', CMS_INVALID_CHARACTERS_MESSAGE)];
  if (kind === 'date') {
    const match = DATE_PATTERN.exec(value);
    return match !== null &&
      isRealCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
      ? []
      : [cmsIssue('invalid_date', 'Enter a real date as YYYY-MM-DD.')];
  }
  if (kind === 'datetime') {
    const match = DATETIME_PATTERN.exec(value);
    return match !== null &&
      isRealCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
      ? []
      : [
          cmsIssue(
            'invalid_datetime',
            'Enter a real date and time with a UTC offset.',
          ),
        ];
  }
  if (kind === 'enum') {
    const choices = constraints.enumValues ?? [];
    return choices.includes(value)
      ? lengthIssues(value, constraints)
      : [cmsIssue('not_in_choices', 'Choose one of the listed values.')];
  }
  return lengthIssues(value, constraints);
};

const pad = (value: number, width = 2): string =>
  String(value).padStart(width, '0');

/**
 * The `datetime-local` control shows the instant in the author's local time.
 * An unparsable stored value renders as an empty control, never as a guess.
 */
export const cmsDatetimeToLocalInput = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * A control value is local wall-clock time; the stored value is the UTC
 * instant (`Z`), which satisfies the datetime encoding and never drifts.
 */
export const cmsLocalInputToDatetime = (local: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/u.test(local)) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace('.000Z', 'Z');
};
