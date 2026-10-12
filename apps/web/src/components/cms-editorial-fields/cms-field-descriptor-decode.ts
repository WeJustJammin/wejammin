import {
  FieldConstraintsSchema,
  RelationBindingInputSchema,
  type AuthoringContextField,
} from '@wejammin/contracts';

import {
  humanizeCmsKey,
  type CmsFieldBase,
  type CmsFieldDescriptor,
  type CmsScalarConstraints,
  type CmsScalarKind,
  type CmsUnavailableDescriptor,
} from './cms-field-descriptor';

/**
 * The decode of the server-projected `AuthoringContextField` list into the
 * browser's typed descriptors. It validates each field's constraints and
 * relation definition with the contract schemas, so it runs where zod is
 * available: the page loaders (server) decode once and hand the islands the
 * result in their `init`, because the editor islands ship no zod (FE03
 * "Performance budgets and loading strategy", AC-106). A field whose constraints
 * do not decode becomes an `unsupported` descriptor, never a guess.
 */

const SCALAR_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
]);

const isScalarKind = (kind: string): kind is CmsScalarKind =>
  SCALAR_KINDS.has(kind);

const scalarConstraints = (
  source: Readonly<Record<string, unknown>>,
): CmsScalarConstraints => ({
  ...(typeof source.minLength === 'number'
    ? { minLength: source.minLength }
    : {}),
  ...(typeof source.maxLength === 'number'
    ? { maxLength: source.maxLength }
    : {}),
  ...(typeof source.minimum === 'number' ? { minimum: source.minimum } : {}),
  ...(typeof source.maximum === 'number' ? { maximum: source.maximum } : {}),
  ...(Array.isArray(source.enumValues)
    ? {
        enumValues: source.enumValues.filter(
          (entry): entry is string => typeof entry === 'string',
        ),
      }
    : {}),
});

const describeOne = (field: AuthoringContextField): CmsFieldDescriptor => {
  const base: CmsFieldBase = {
    fieldId: field.stableFieldId,
    key: field.key,
    label: field.editorConfig.label,
    helpText: field.editorConfig.helpText,
    required: field.required,
    order: field.editorConfig.order,
  };
  const unsupported: CmsUnavailableDescriptor = {
    ...base,
    kind: 'unsupported',
  };
  const constraints = FieldConstraintsSchema.safeParse(field.constraints);
  if (!constraints.success) return unsupported;
  const parsed = constraints.data;
  const kind: string = field.kind;
  if (kind === 'taxonomy' || kind === 'media') return { ...base, kind };
  if (kind === 'rich_text')
    return { ...base, kind, constraints: scalarConstraints(parsed) };
  if (kind === 'object') {
    if (parsed.objectStructure === undefined) return unsupported;
    return {
      ...base,
      kind,
      structure: parsed.objectStructure,
      properties: parsed.objectStructure.properties.map((property) => ({
        key: property.key,
        label: humanizeCmsKey(property.key),
        kind: property.kind,
        required: property.required,
        constraints: scalarConstraints(property.constraints),
      })),
    };
  }
  if (kind === 'list') {
    const itemKind = parsed.itemKind;
    if (itemKind === undefined || !isScalarKind(itemKind)) return unsupported;
    return {
      ...base,
      kind,
      itemKind,
      constraints: scalarConstraints(parsed),
    };
  }
  if (kind === 'relation') {
    const relation = RelationBindingInputSchema.safeParse(
      field.relationDefinition,
    );
    if (!relation.success) return unsupported;
    return {
      ...base,
      kind,
      targetKind: relation.data.targetKind,
      min: relation.data.min,
      max: relation.data.max,
      ordered: relation.data.ordered,
    };
  }
  if (isScalarKind(kind))
    return { ...base, kind, constraints: scalarConstraints(parsed) };
  return unsupported;
};

/**
 * Describes every projected field in authoring order (editorConfig.order, then
 * the stable key), so the form renders the same sequence on every surface.
 */
export const describeCmsAuthoringFields = (
  fields: readonly AuthoringContextField[],
): readonly CmsFieldDescriptor[] =>
  fields
    .map(describeOne)
    .sort((left, right) =>
      left.order !== right.order
        ? left.order - right.order
        : left.key < right.key
          ? -1
          : left.key > right.key
            ? 1
            : 0,
    );
