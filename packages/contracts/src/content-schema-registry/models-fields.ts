import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsFieldKeySchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsVersionSchema,
} from './primitives.ts';
import {
  CMS_LIST_ITEM_KINDS,
  CmsDefaultModeSchema,
  CmsFieldKindSchema,
  CmsFieldLifecycleSchema,
  CmsLocalizationModeSchema,
} from './models-enums.ts';
import { isProtectedValidatorPairing } from './protected-validators.ts';
import {
  type ObjectStructure,
  ObjectStructureSchema,
  isObjectValueForStructure,
  isRichTextV1,
  richTextTotalCharacters,
} from './structured-values.ts';

/**
 * BE03a CMS-03A-02: constraints are capped at 8 KiB. The key set is the closed
 * seven-member list (so the 64-key cap holds by construction); the DEC-133
 * `objectStructure` is the only member that nests, so the cap is measured on
 * the compact UTF-8 JSON of the whole object. The database applies the same
 * cap to the stored form (`cms_json_bounded(constraints, 8192, 8, 64, 256)`).
 */
export const FIELD_CONSTRAINTS_MAX_BYTES = 8192;
const utf8Length = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const FieldConstraintsSchema = z
  .strictObject({
    minLength: z.number().int().min(0).max(100_000).optional(),
    maxLength: z.number().int().min(0).max(100_000).optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    enumValues: z.array(z.string().max(160)).max(256).optional(),
    itemKind: CmsFieldKindSchema.optional(),
    objectStructure: ObjectStructureSchema.optional(),
  })
  .superRefine((value, context) => {
    if (utf8Length(value) > FIELD_CONSTRAINTS_MAX_BYTES)
      context.addIssue({
        code: 'custom',
        path: [],
        message: 'constraints_exceed_8_kib',
      });
    if (
      value.minLength !== undefined &&
      value.maxLength !== undefined &&
      value.minLength > value.maxLength
    )
      context.addIssue({
        code: 'custom',
        path: ['minLength'],
        message: 'min_length_exceeds_max_length',
      });
    if (
      value.minimum !== undefined &&
      value.maximum !== undefined &&
      value.minimum > value.maximum
    )
      context.addIssue({
        code: 'custom',
        path: ['minimum'],
        message: 'minimum_exceeds_maximum',
      });
  })
  .readonly();

export const FieldEditorConfigSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(120),
    helpText: z.string().trim().max(500).optional(),
    order: z.number().int().min(0).max(10_000),
  })
  .readonly();

const fieldShape = {
  stableFieldId: CmsUuidSchema,
  key: CmsFieldKeySchema,
  kind: CmsFieldKindSchema,
  constraints: FieldConstraintsSchema,
  required: z.boolean(),
  validatorKey: CmsValidatorKeySchema.nullable(),
  validatorVersion: CmsVersionSchema.nullable(),
  defaultMode: CmsDefaultModeSchema,
  defaultValue: JsonValueSchema.nullable().optional(),
  localizationMode: CmsLocalizationModeSchema,
  editorConfig: FieldEditorConfigSchema,
  lifecycle: CmsFieldLifecycleSchema,
} as const;

const refineField = (
  value: {
    kind: string;
    constraints: {
      objectStructure?: ObjectStructure | undefined;
      itemKind?: string | undefined;
      minLength?: number | undefined;
      maxLength?: number | undefined;
    };
    validatorKey: string | null;
    validatorVersion: string | null;
    defaultMode: 'none' | 'literal' | 'inherited';
    defaultValue?: unknown;
  },
  context: z.RefinementCtx,
) => {
  if ((value.validatorKey === null) !== (value.validatorVersion === null))
    context.addIssue({
      code: 'custom',
      path: ['validatorKey'],
      message: 'validator_key_version_pair_required',
    });
  // DEC-112 / DEC-146 (AC-085): a present pair must name the registered
  // protected member, and `rich_text.v1` pairs with a rich_text field only,
  // exactly as `cms_valid_field_input` enforces it.
  else if (
    !isProtectedValidatorPairing(
      value.kind,
      value.validatorKey,
      value.validatorVersion,
    )
  )
    context.addIssue({
      code: 'custom',
      path: ['validatorKey'],
      message: 'validator_must_be_registered_protected_member_for_kind',
    });
  // DEC-133 kind/structure agreement for the object field kind.
  if (
    value.kind === 'object' &&
    value.constraints.objectStructure === undefined
  )
    context.addIssue({
      code: 'custom',
      path: ['constraints', 'objectStructure'],
      message: 'object_field_requires_object_structure',
    });
  if (
    value.kind !== 'object' &&
    value.constraints.objectStructure !== undefined
  )
    context.addIssue({
      code: 'custom',
      path: ['constraints', 'objectStructure'],
      message: 'object_structure_only_for_object_field',
    });
  // DEC-133 / BE03a "Field kind structure": a list field requires an itemKind
  // that is a scalar kind or enum (a nested item kind is refused at definition
  // time), and itemKind is only valid for a list field.
  if (
    value.kind === 'list' &&
    (value.constraints.itemKind === undefined ||
      !CMS_LIST_ITEM_KINDS.has(value.constraints.itemKind))
  )
    context.addIssue({
      code: 'custom',
      path: ['constraints', 'itemKind'],
      message: 'list_item_kind_must_be_scalar_or_enum',
    });
  if (value.kind !== 'list' && value.constraints.itemKind !== undefined)
    context.addIssue({
      code: 'custom',
      path: ['constraints', 'itemKind'],
      message: 'item_kind_only_for_list_field',
    });
  const hasDefault = Object.hasOwn(value, 'defaultValue');
  if (
    value.defaultMode === 'literal' &&
    (!hasDefault || value.defaultValue === undefined)
  )
    context.addIssue({
      code: 'custom',
      path: ['defaultValue'],
      message: 'literal_default_required',
    });
  if (value.defaultMode !== 'literal' && hasDefault)
    context.addIssue({
      code: 'custom',
      path: ['defaultValue'],
      message: 'default_value_must_be_omitted',
    });
  // DEC-112 / DEC-133: a literal default must satisfy the value grammar of its
  // structured kind: rich_text holds a rich_text.v1 document; object holds a
  // depth-1 value matching its declared structure.
  if (value.defaultMode === 'literal' && hasDefault) {
    if (value.kind === 'rich_text' && !isRichTextV1(value.defaultValue))
      context.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'rich_text_default_must_be_rich_text_v1',
      });
    // BE03b: the 03a minLength/maxLength bind the total NFC text of a rich_text
    // value, so a default must honour them exactly as the database does
    // (`cms_rich_text_length_in_bounds`).
    else if (value.kind === 'rich_text') {
      const total = richTextTotalCharacters(value.defaultValue);
      if (
        (value.constraints.minLength !== undefined &&
          total < value.constraints.minLength) ||
        (value.constraints.maxLength !== undefined &&
          total > value.constraints.maxLength)
      )
        context.addIssue({
          code: 'custom',
          path: ['defaultValue'],
          message: 'rich_text_default_length_out_of_bounds',
        });
    }
    const structure = value.constraints.objectStructure;
    if (
      value.kind === 'object' &&
      structure !== undefined &&
      !isObjectValueForStructure(structure, value.defaultValue)
    )
      context.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'object_default_must_match_object_structure',
      });
  }
};

export const FieldDefinitionInputSchema = z
  .strictObject(fieldShape)
  .superRefine(refineField)
  .readonly();

export type FieldDefinitionInput = z.infer<typeof FieldDefinitionInputSchema>;
