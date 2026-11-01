import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsDefaultModeSchema,
  CmsFieldKindSchema,
  CmsLocalizationModeSchema,
} from '../content-schema-registry/models-enums.ts';
import {
  CmsFieldKeySchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';

/**
 * BE03b AuthoringContextFieldEditorConfig: the safe editor affordances.
 * Label and help text are trimmed, the order is a bounded non-negative
 * integer, and any unknown key is refused.
 */
const authoringContextFieldEditorConfigSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(120),
    helpText: z.string().trim().max(500).optional(),
    order: z.number().int().min(0).max(10_000),
  })
  .readonly();

/**
 * BE03b AuthoringContextField: the author-safe field-definition projection.
 * Constraints and the relation definition are bounded JSON, defaultValue is
 * nullable JSON that may be omitted, and the closed kind/default/localization
 * vocabularies are reused from the registry so the projection cannot drift.
 */
export const AuthoringContextFieldSchema = z
  .strictObject({
    stableFieldId: CmsUuidSchema,
    key: CmsFieldKeySchema,
    kind: CmsFieldKindSchema,
    constraints: z.record(z.string(), JsonValueSchema),
    required: z.boolean(),
    defaultMode: CmsDefaultModeSchema,
    defaultValue: JsonValueSchema.nullable().optional(),
    localizationMode: CmsLocalizationModeSchema,
    editorConfig: authoringContextFieldEditorConfigSchema,
    relationDefinition: JsonValueSchema.nullable(),
  })
  .readonly();
