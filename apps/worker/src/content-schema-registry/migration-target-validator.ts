/**
 * Target-schema validation for migration transforms.
 *
 * Canonical admission semantics live in the database function
 * `platform_private.cms_draft_field_value_valid`; this module mirrors them in
 * the Worker so a dry-run can never seal a row the candidate schema would
 * refuse. It also validates the compiled constraint object itself, and it is
 * fail-closed: a field kind, validator reference or constraint payload this
 * module cannot prove is refused with a typed row error rather than passed.
 *
 * `targetField.constraints` is the compiled constraint object for the field
 * (migration worker <-> DB protocol): the shared `FieldConstraintsSchema` keys
 * (`minLength`, `maxLength`, `minimum`, `maximum`, `enumValues`, `itemKind`)
 * plus `validatorKey`/`validatorVersion` (the field's validator reference)
 * and `relation` (the shared `RelationBindingInputSchema` binding for
 * relation fields).
 */
import {
  CmsFieldKindSchema,
  CmsValidatorKeySchema,
  CmsVersionSchema,
  FieldConstraintsSchema,
  RelationBindingInputSchema,
  type FieldDefinitionInput,
} from '@wejammin/contracts';

import type { TargetFieldSpec } from './migration-transform-types';

export const TARGET_ROW_ERROR = {
  violation: 'TRANSFORM_TARGET_VIOLATION',
  constraintsMissing: 'TRANSFORM_TARGET_CONSTRAINTS_MISSING',
  constraintsInvalid: 'TRANSFORM_TARGET_CONSTRAINTS_INVALID',
  kindUnsupported: 'TRANSFORM_TARGET_KIND_UNSUPPORTED',
  validatorUnsupported: 'TRANSFORM_TARGET_VALIDATOR_UNSUPPORTED',
} as const;

type BaseConstraints = FieldDefinitionInput['constraints'];
type RelationBinding = ReturnType<typeof RelationBindingInputSchema.parse>;

type CompiledConstraints = Readonly<{
  base: BaseConstraints;
  relation: RelationBinding | null;
  hasValidatorRef: boolean;
}>;

const rowError = (code: string): Error =>
  Object.assign(new Error(code), { code });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAbsent = (value: unknown): boolean =>
  value === undefined || value === null;

const EXTRA_KEYS = ['validatorKey', 'validatorVersion', 'relation'] as const;

const compile = (raw: unknown): CompiledConstraints => {
  if (raw === null || raw === undefined)
    throw rowError(TARGET_ROW_ERROR.constraintsMissing);
  if (!isPlainObject(raw)) throw rowError(TARGET_ROW_ERROR.constraintsInvalid);
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw))
    if (!(EXTRA_KEYS as readonly string[]).includes(key)) rest[key] = value;
  const base = FieldConstraintsSchema.safeParse(rest);
  if (!base.success) throw rowError(TARGET_ROW_ERROR.constraintsInvalid);
  const key = raw.validatorKey ?? null;
  const version = raw.validatorVersion ?? null;
  const keyOk = key === null || CmsValidatorKeySchema.safeParse(key).success;
  const versionOk =
    version === null || CmsVersionSchema.safeParse(version).success;
  if (!keyOk || !versionOk || (key === null) !== (version === null))
    throw rowError(TARGET_ROW_ERROR.constraintsInvalid);
  let relation: RelationBinding | null = null;
  if (raw.relation !== undefined && raw.relation !== null) {
    const parsed = RelationBindingInputSchema.safeParse(raw.relation);
    if (!parsed.success) throw rowError(TARGET_ROW_ERROR.constraintsInvalid);
    relation = parsed.data;
  }
  return { base: base.data, relation, hasValidatorRef: key !== null };
};

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const DATETIME =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$/u;

const isCalendarDate = (text: string): boolean => {
  const [year = 0, month = 0, day = 0] = text
    .slice(0, 10)
    .split('-')
    .map(Number);
  const probe = new Date(Date.UTC(2000, month - 1, day));
  probe.setUTCFullYear(year);
  return (
    month >= 1 &&
    month <= 12 &&
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
};

const characterLength = (text: string): number => [...text].length;

/** Type check of one value for `kind`, mirroring the canonical admission gate. */
export const kindAccepts = (kind: string, value: unknown): boolean => {
  switch (kind) {
    case 'short_text':
    case 'long_text':
    case 'enum':
    case 'taxonomy':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'decimal':
      return typeof value === 'number' && Number.isFinite(value);
    case 'date':
      return (
        typeof value === 'string' && DATE.test(value) && isCalendarDate(value)
      );
    case 'datetime':
      return (
        typeof value === 'string' &&
        DATETIME.test(value) &&
        isCalendarDate(value)
      );
    case 'object':
      return isPlainObject(value);
    case 'list':
      return Array.isArray(value);
    case 'media':
    case 'relation':
      return (
        typeof value === 'string' ||
        Array.isArray(value) ||
        isPlainObject(value)
      );
    default:
      return false;
  }
};

const withinStringBounds = (
  text: string,
  constraints: BaseConstraints,
): boolean => {
  const length = characterLength(text);
  if (constraints.minLength !== undefined && length < constraints.minLength)
    return false;
  if (constraints.maxLength !== undefined && length > constraints.maxLength)
    return false;
  return (
    constraints.enumValues === undefined ||
    constraints.enumValues.includes(text)
  );
};

const withinNumberBounds = (
  value: number,
  constraints: BaseConstraints,
): boolean =>
  (constraints.minimum === undefined || value >= constraints.minimum) &&
  (constraints.maximum === undefined || value <= constraints.maximum);

const relationCountOk = (value: unknown, binding: RelationBinding): boolean => {
  const count = Array.isArray(value) ? value.length : 1;
  if (binding.cardinality === 'one' && Array.isArray(value) && count !== 1)
    return false;
  return count >= binding.min && count <= binding.max;
};

const itemsOk = (items: readonly unknown[], itemKind: string): boolean =>
  items.every(
    (item) => itemKind !== 'rich_text' && kindAccepts(itemKind, item),
  );

const valueConforms = (
  field: TargetFieldSpec,
  compiled: CompiledConstraints,
  value: unknown,
): boolean => {
  if (!kindAccepts(field.kind, value)) return false;
  const { base } = compiled;
  if (typeof value === 'string' && !withinStringBounds(value, base))
    return false;
  if (typeof value === 'number' && !withinNumberBounds(value, base))
    return false;
  if (Array.isArray(value)) {
    if (base.maxLength !== undefined && value.length > base.maxLength)
      return false;
    if (field.kind === 'list' && base.itemKind !== undefined)
      if (!itemsOk(value, base.itemKind)) return false;
  }
  if (field.kind === 'relation' && compiled.relation !== null)
    return relationCountOk(value, compiled.relation);
  return true;
};

const refuseUnprovable = (
  field: TargetFieldSpec,
  compiled: CompiledConstraints,
): void => {
  const known = CmsFieldKindSchema.safeParse(field.kind);
  if (!known.success || field.kind === 'rich_text')
    throw rowError(TARGET_ROW_ERROR.kindUnsupported);
  if (compiled.hasValidatorRef)
    throw rowError(TARGET_ROW_ERROR.validatorUnsupported);
  const { enumValues, itemKind } = compiled.base;
  if (
    field.kind === 'enum' &&
    (enumValues === undefined || enumValues.length === 0)
  )
    throw rowError(TARGET_ROW_ERROR.constraintsMissing);
  if (field.kind === 'relation' && compiled.relation === null)
    throw rowError(TARGET_ROW_ERROR.constraintsMissing);
  if (field.kind === 'list' && itemKind === 'rich_text')
    throw rowError(TARGET_ROW_ERROR.kindUnsupported);
};

/**
 * Validates `value` (the source row's value for the target field, or
 * `undefined` when absent) against the compiled target constraints. Throws a
 * typed row error; returns normally only when the value is provably valid.
 */
export const validateTargetValue = (
  field: TargetFieldSpec,
  value: unknown,
): void => {
  const compiled = compile(field.constraints);
  refuseUnprovable(field, compiled);
  if (isAbsent(value)) {
    if (field.required) throw rowError(TARGET_ROW_ERROR.violation);
    return;
  }
  if (!valueConforms(field, compiled, value))
    throw rowError(TARGET_ROW_ERROR.violation);
};
