import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsFieldKeySchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsVersionSchema,
} from './primitives.ts';
import {
  CmsDefaultModeSchema,
  CmsFieldKindSchema,
  CmsFieldLifecycleSchema,
  CmsLocalizationModeSchema,
} from './models-enums.ts';

/**
 * BE03a CMS-03A-02: constraints are capped at 8 KiB. The key set is the closed
 * six-member list (so the 64-key and depth-4 caps hold by construction); only
 * the size of `enumValues` can grow, so the cap is measured on the compact
 * UTF-8 JSON of the whole object. The database applies the same cap to the
 * stored form (`cms_json_bounded(constraints, 8192, 4, 64, 256)`).
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
};

export const FieldDefinitionInputSchema = z
  .strictObject(fieldShape)
  .superRefine(refineField)
  .readonly();

export type FieldDefinitionInput = z.infer<typeof FieldDefinitionInputSchema>;
