import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import {
  CmsDefaultModeSchema,
  CmsFieldKindSchema,
  CmsLocalizationModeSchema,
} from '../content-schema-registry/models-enums.ts';
import { WorkflowPolicyEvidenceSchema } from '../content-schema-registry/models-workflow.ts';
import {
  CmsFieldKeySchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { Bcp47Schema } from './primitives.ts';
import {
  SchemaArtifactEvidenceSchema,
  ValidatorEvidenceSchema,
} from './schema-evidence.ts';

/**
 * BE03b CMS-03B-14 AuthoringContextQuery: a single optional active compiled
 * version the caller may author. Ownership, acting party, capability, and
 * every registry-private selector are deliberately absent so the server
 * derives them from the authenticated principal; when the version id is
 * omitted the caller receives only their creatable active types.
 */
export const AuthoringContextQuerySchema = z
  .strictObject({
    contentTypeVersionId: CmsUuidSchema.optional(),
  })
  .readonly();

/**
 * OpenAPI transport view for CMS-03B-14: the single optional active compiled
 * version selector and no path parameters.  A safe read accepts no body,
 * Idempotency-Key, or If-Match, so this schema declares neither headers nor
 * body.
 */
export const AuthoringContextApiRequestSchema = z.strictObject({
  query: z.strictObject({
    contentTypeVersionId: CmsUuidSchema.optional(),
  }),
});

/**
 * BE03b AuthoringContextType: the author-safe create type projection.  It
 * carries the exact schema artifact, validator refs, editorial workflow
 * policy, and activation evidence the author is allowed to see -- and never a
 * registry-wide read, ownership identifier, or private schema authority.
 */
export const AuthoringContextTypeSchema = z
  .strictObject({
    contentTypeId: CmsUuidSchema,
    contentTypeVersionId: CmsUuidSchema,
    label: z.string().trim().min(1).max(120),
    sourceLocale: Bcp47Schema,
    defaultLocale: Bcp47Schema,
    supportedLocales: z.array(Bcp47Schema).min(1).max(32).readonly(),
    schemaArtifact: SchemaArtifactEvidenceSchema,
    validatorRefs: z.array(ValidatorEvidenceSchema).max(128).readonly(),
    workflowPolicy: WorkflowPolicyEvidenceSchema,
    activationEvidence: WorkflowPolicyEvidenceSchema,
  })
  .readonly();

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

/**
 * BE03b AuthoringContextResource: the author-safe preparation envelope.  It
 * never grants a registry-wide read: at most 32 creatable active types plus,
 * when a version is selected, the nullable selection and its at most 128
 * projected fields.
 */
export const AuthoringContextResourceSchema = z
  .strictObject({
    creatableTypes: z.array(AuthoringContextTypeSchema).max(32).readonly(),
    selectedType: AuthoringContextTypeSchema.nullable(),
    fields: z.array(AuthoringContextFieldSchema).max(128).readonly(),
  })
  .readonly();

/**
 * BE03b AuthoringContextRead: the query/resource pair with literal
 * precedence.  When the query carries no contentTypeVersionId there is no
 * selection, so selectedType must be null and no fields may be returned.
 * When it is present a non-null selection is mandatory, the selected type's
 * version must equal the requested one, and only then may fields be returned.
 */
export const AuthoringContextReadSchema = z
  .strictObject({
    query: AuthoringContextQuerySchema,
    resource: AuthoringContextResourceSchema,
  })
  .superRefine((value, context) => {
    const requestedVersionId = value.query.contentTypeVersionId;
    if (requestedVersionId === undefined) {
      if (value.resource.selectedType !== null)
        context.addIssue({
          code: 'custom',
          path: ['resource', 'selectedType'],
          message: 'authoring_context_selection_requires_query_version',
        });
      if (value.resource.fields.length !== 0)
        context.addIssue({
          code: 'custom',
          path: ['resource', 'fields'],
          message: 'authoring_context_fields_require_query_version',
        });
      return;
    }
    if (value.resource.selectedType === null) {
      context.addIssue({
        code: 'custom',
        path: ['resource', 'selectedType'],
        message: 'authoring_context_query_version_requires_selection',
      });
      return;
    }
    if (value.resource.selectedType.contentTypeVersionId !== requestedVersionId)
      context.addIssue({
        code: 'custom',
        path: ['resource', 'selectedType', 'contentTypeVersionId'],
        message: 'authoring_context_selected_version_must_match_query',
      });
  })
  .readonly();

export type AuthoringContextQuery = z.infer<typeof AuthoringContextQuerySchema>;
export type AuthoringContextType = z.infer<typeof AuthoringContextTypeSchema>;
export type AuthoringContextField = z.infer<typeof AuthoringContextFieldSchema>;
export type AuthoringContextResource = z.infer<
  typeof AuthoringContextResourceSchema
>;
export type AuthoringContextRead = z.infer<typeof AuthoringContextReadSchema>;
