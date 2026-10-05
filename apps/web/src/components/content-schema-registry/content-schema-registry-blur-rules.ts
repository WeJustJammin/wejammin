import {
  CMS_CAPABILITY_KEY_PATTERN,
  CMS_FIELD_KEY_PATTERN,
  CMS_HASH_PATTERN,
  CMS_LABEL_MAX_CHARACTERS,
  CMS_LABEL_MIN_CHARACTERS,
  CMS_PROJECTION_KEY_PATTERN,
  CMS_TARGET_TYPE_PATTERN,
  CMS_TYPE_KEY_PATTERN,
  CMS_UUID_PATTERN,
  CMS_VALIDATOR_KEY_PATTERN,
  CMS_WORKFLOW_KEY_PATTERN,
  isCmsLabel,
  isCmsVersion,
} from '@wejammin/contracts/client';

/**
 * FE03 form contract: "Syntax and safe local constraints on blur; cross-field
 * on review/submit; server remains authoritative." Each rule below is the
 * syntax rule of the generated request schema for that field (the pattern
 * constants are shared with the schemas, see contracts `field-rules.ts`), with
 * a message that states the rule so the correction is clear. Blur feedback
 * informs; it never blocks a submit, and the server's answer always wins.
 *
 * Fields that carry their own blur feedback elsewhere (the locale fields, the
 * template choice, the reviewer assignment and the capability grant console)
 * are not listed here.
 */

export interface BlurRule {
  /** An optional field may be left blank; a blank required field is invalid. */
  readonly optional: boolean;
  readonly valid: (value: string) => boolean;
  readonly message: string;
}

const UPPER_BOUND = 128;

const pattern = (
  expression: RegExp,
  message: string,
  optional = false,
): BlurRule => ({
  optional,
  valid: (value) => expression.test(value),
  message,
});

const TYPE_KEY_RULE =
  'Use 2 to 64 lowercase letters, numbers, or underscores, starting with a letter.';
const DOTTED_KEY_RULE =
  'Use up to 128 lowercase letters, numbers, dots, underscores, or hyphens, starting with a letter.';

const key = (expression: RegExp, optional = false): BlurRule =>
  pattern(expression, DOTTED_KEY_RULE, optional);
const uuid = (optional = false): BlurRule =>
  pattern(CMS_UUID_PATTERN, 'Enter a UUID.', optional);
const version = (optional = false): BlurRule => ({
  optional,
  valid: isCmsVersion,
  message: 'Enter a whole number from 1 to 9223372036854775807.',
});
const label: BlurRule = {
  optional: false,
  valid: isCmsLabel,
  message: `Enter ${CMS_LABEL_MIN_CHARACTERS} to ${CMS_LABEL_MAX_CHARACTERS} characters.`,
};

const json = (
  shape: 'array' | 'object' | 'any',
  optional = false,
): BlurRule => ({
  optional,
  valid: (value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      if (shape === 'any') return true;
      return shape === 'array'
        ? Array.isArray(parsed)
        : typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed);
    } catch {
      return false;
    }
  },
  message:
    shape === 'array'
      ? 'Enter a JSON array.'
      : shape === 'object'
        ? 'Enter a JSON object.'
        : 'Enter valid JSON.',
});

const integer = (minimum: number, maximum: number): BlurRule => ({
  optional: false,
  valid: (value) => {
    if (!/^-?\d+$/u.test(value)) return false;
    const parsed = Number(value);
    return parsed >= minimum && parsed <= maximum;
  },
  message: `Enter a whole number from ${minimum} to ${maximum}.`,
});

export const BLUR_RULES: Readonly<
  Record<string, Readonly<Record<string, BlurRule>>>
> = {
  'CMS-03A-01': {
    typeKey: pattern(CMS_TYPE_KEY_PATTERN, TYPE_KEY_RULE),
    label,
    ownerCapability: key(CMS_CAPABILITY_KEY_PATTERN),
    workflowKey: key(CMS_WORKFLOW_KEY_PATTERN),
    workflowVersion: version(),
    fields: json('array'),
    relations: json('array'),
    capabilityBindings: json('array'),
  },
  'CMS-03A-02': {
    stableFieldId: uuid(true),
    key: pattern(CMS_FIELD_KEY_PATTERN, TYPE_KEY_RULE),
    constraints: json('object'),
    validatorKey: key(CMS_VALIDATOR_KEY_PATTERN, true),
    validatorVersion: version(true),
    defaultValue: json('any', true),
    editorConfig: json('object'),
    migrationPlanId: uuid(true),
  },
  'CMS-03A-03': {
    fieldId: uuid(),
    targetType: pattern(
      CMS_TARGET_TYPE_PATTERN,
      'Use up to 96 lowercase letters, numbers, dots, underscores, or hyphens, starting with a letter.',
    ),
    projectionKey: key(CMS_PROJECTION_KEY_PATTERN),
    min: integer(0, UPPER_BOUND),
    max: integer(1, UPPER_BOUND),
  },
  'CMS-03A-04': {
    expectedActivationEvidenceHash: pattern(
      CMS_HASH_PATTERN,
      'Enter a 64-character lowercase hexadecimal hash.',
      true,
    ),
    migrationPlanId: uuid(true),
  },
  'CMS-03A-10': {
    transformKey: key(CMS_VALIDATOR_KEY_PATTERN, true),
    transformVersion: version(true),
  },
};

/**
 * The message for a value that breaks its field's syntax rule, or `null` when
 * the value is acceptable or the field has no blur rule.
 */
export const blurIssue = (
  operationId: string,
  fieldName: string,
  value: string,
): string | null => {
  const rule = BLUR_RULES[operationId]?.[fieldName];
  if (rule === undefined) return null;
  if (value.trim() === '') return rule.optional ? null : rule.message;
  return rule.valid(value) ? null : rule.message;
};
