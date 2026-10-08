import {
  FieldConstraintsSchema,
  RelationBindingInputSchema,
  type AuthoringContextField,
  type ObjectStructure,
} from '@wejammin/contracts';

/**
 * The browser's typed description of one authoring field: everything an editor
 * needs to choose a native control, derived only from the server-projected
 * `AuthoringContextField` (BE03b CMS-03B-14). Nothing here is invented: labels
 * and help come from `editorConfig`, constraints from the closed 03a
 * vocabulary, the object structure from the DEC-133 `properties[]`, and the
 * relation bounds from the immutable relation definition.
 */

export type CmsScalarKind =
  | 'short_text'
  | 'long_text'
  | 'boolean'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'enum';

export interface CmsScalarConstraints {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly enumValues?: readonly string[];
}

export interface CmsFieldBase {
  /** The stable field id: the only request key (BE03b value encodings). */
  readonly fieldId: string;
  readonly key: string;
  readonly label: string;
  readonly helpText: string | undefined;
  readonly required: boolean;
  readonly order: number;
}

export interface CmsScalarDescriptor extends CmsFieldBase {
  readonly kind: CmsScalarKind;
  readonly constraints: CmsScalarConstraints;
}

export interface CmsRichTextDescriptor extends CmsFieldBase {
  readonly kind: 'rich_text';
  readonly constraints: CmsScalarConstraints;
}

export interface CmsListDescriptor extends CmsFieldBase {
  readonly kind: 'list';
  readonly itemKind: CmsScalarKind;
  readonly constraints: CmsScalarConstraints;
}

export type CmsObjectPropertyKind = 'scalar' | 'enum' | 'rich_text';

export interface CmsObjectPropertyDescriptor {
  readonly key: string;
  /** Derived from the stable property key: the structure declares no label. */
  readonly label: string;
  readonly kind: CmsObjectPropertyKind;
  readonly required: boolean;
  readonly constraints: CmsScalarConstraints;
}

export interface CmsObjectDescriptor extends CmsFieldBase {
  readonly kind: 'object';
  readonly properties: readonly CmsObjectPropertyDescriptor[];
  readonly structure: ObjectStructure;
}

export interface CmsRelationDescriptor extends CmsFieldBase {
  readonly kind: 'relation';
  readonly targetKind: 'content' | 'domain';
  readonly min: number;
  readonly max: number;
  readonly ordered: boolean;
}

/** taxonomy and media have no producer yet; unsupported means unreadable. */
export interface CmsUnavailableDescriptor extends CmsFieldBase {
  readonly kind: 'taxonomy' | 'media' | 'unsupported';
}

export type CmsFieldDescriptor =
  | CmsScalarDescriptor
  | CmsRichTextDescriptor
  | CmsListDescriptor
  | CmsObjectDescriptor
  | CmsRelationDescriptor
  | CmsUnavailableDescriptor;

/** True for a field with no producer (taxonomy, media) or no usable definition. */
export const isCmsUnavailableDescriptor = (
  descriptor: CmsFieldDescriptor,
): descriptor is CmsUnavailableDescriptor =>
  descriptor.kind === 'taxonomy' ||
  descriptor.kind === 'media' ||
  descriptor.kind === 'unsupported';

/** `release_notes` becomes `Release notes`: a label derived from a stable key. */
export const humanizeCmsKey = (key: string): string => {
  const words = key.replaceAll('_', ' ').trim();
  return words.length === 0
    ? key
    : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

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

const lengthHint = (c: CmsScalarConstraints, unit: string): string | null => {
  if (c.minLength !== undefined && c.maxLength !== undefined)
    return `Between ${c.minLength} and ${c.maxLength} ${unit}.`;
  if (c.minLength !== undefined) return `At least ${c.minLength} ${unit}.`;
  if (c.maxLength !== undefined) return `At most ${c.maxLength} ${unit}.`;
  return null;
};

const rangeHint = (c: CmsScalarConstraints): string | null => {
  if (c.minimum !== undefined && c.maximum !== undefined)
    return `Between ${c.minimum} and ${c.maximum}.`;
  if (c.minimum !== undefined) return `At least ${c.minimum}.`;
  if (c.maximum !== undefined) return `At most ${c.maximum}.`;
  return null;
};

/**
 * A plain-language statement of the declared constraints, used as the control
 * description: the structure carries no per-property help member, so the
 * description is what the constraints say, never invented prose.
 */
export const describeCmsConstraints = (
  constraints: CmsScalarConstraints,
  options: { readonly required: boolean; readonly includeRequired?: boolean },
): string => {
  const parts = [
    options.includeRequired === false || !options.required ? null : 'Required.',
    lengthHint(constraints, 'characters'),
    rangeHint(constraints),
  ].filter((part): part is string => part !== null);
  return parts.join(' ');
};
