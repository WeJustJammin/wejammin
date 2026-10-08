import {
  AuthoringContextFieldSchema,
  ChangedPathsSchema,
  JsonValueSchema,
} from '@wejammin/contracts';
import {
  SchemaArtifactEvidenceSchema,
  ValidatorEvidenceSchema,
} from '@wejammin/contracts';
import { WorkflowPolicyEvidenceSchema } from '@wejammin/contracts';
import type { AuthoringContextField } from '@wejammin/contracts';
import { z } from 'zod';

import { CMS_EDITORIAL_ENTRY_CREATE_ROUTE } from './cms-editorial-entry-create';

/**
 * Browser-side projection of the CMS-03B-10 create form for the CMS-05 entry
 * workbench (03-cms-content-modeling.md CmsEditorialAuthoringContext /
 * CmsEditorialEntryCreateForm).
 *
 * The form owns no authority: contentTypeId, contentTypeVersionId, locale,
 * schemaArtifact, validatorRefs, workflowPolicy and activationEvidence are
 * prefilled from the CMS-03B-14 authoring-context projection and echoed back
 * unmodified into EntryCreateRequest. The user types no JSON, schema, policy
 * or evidence (DEC-108 G8); changedPaths and values are browser-local field
 * state validated against the same shared schemas the server parses. Owner,
 * assignee, acting party, capability and authority are deliberately absent
 * because the server derives them.
 */
export const CMS_EDITORIAL_ENTRY_CREATE_FORM_SOURCE = {
  request: 'packages/contracts/src/cms-editorial/entry-create.ts',
  preparation: 'packages/contracts/src/cms-editorial/authoring-context.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  route: CMS_EDITORIAL_ENTRY_CREATE_ROUTE,
  browserLocal: 'changedPaths and values stay validated browser field state',
} as const;

/**
 * The create form's own browser projection of the BE03b EntryCreateRequest.
 * It is deliberately not the raw server contract: the prefill members arrive
 * as whatever the CMS-03B-14 authoring-context projection exposes (opaque
 * identifiers and evidence hashes the browser only echoes back), and the
 * editable members are browser-local field state. Strict, so a drifted or
 * forged member fails closed before anything is submitted; the server
 * re-parses the exact EntryCreateRequest and re-derives every authority.
 */
const cmsEditorialEntryCreateFormBaseShape = {
  contentTypeId: z.string().min(1).max(128),
  contentTypeVersionId: z.string().min(1).max(128),
  locale: z.string().min(1).max(64),
  changedPaths: ChangedPathsSchema,
  values: z.record(z.string().max(128), JsonValueSchema),
  schemaArtifact: SchemaArtifactEvidenceSchema,
  validatorRefs: z.array(ValidatorEvidenceSchema).max(128).readonly(),
  workflowPolicy: WorkflowPolicyEvidenceSchema,
  activationEvidence: WorkflowPolicyEvidenceSchema,
} as const;

/** The create form's request: immutable evidence plus browser-local field state. */
export const CmsEditorialEntryCreateFormRequestSchema = z
  .strictObject(cmsEditorialEntryCreateFormBaseShape)
  .readonly();

/** Shared field-definition projection the create form renders controls from. */
export const CmsEditorialAuthoringContextFieldSchema =
  AuthoringContextFieldSchema;

/**
 * The exact prefill the authoring-context projection feeds the form. Only a
 * validated projection may seed the request, so a drifted preparation read
 * can never reach CMS-03B-10 as forged evidence.
 */
export const CmsEditorialCreateFormPrefillSchema = z
  .strictObject({
    contentTypeId: cmsEditorialEntryCreateFormBaseShape.contentTypeId,
    contentTypeVersionId:
      cmsEditorialEntryCreateFormBaseShape.contentTypeVersionId,
    locale: cmsEditorialEntryCreateFormBaseShape.locale,
    schemaArtifact: cmsEditorialEntryCreateFormBaseShape.schemaArtifact,
    validatorRefs: cmsEditorialEntryCreateFormBaseShape.validatorRefs,
    workflowPolicy: cmsEditorialEntryCreateFormBaseShape.workflowPolicy,
    activationEvidence: cmsEditorialEntryCreateFormBaseShape.activationEvidence,
  })
  .readonly();

/**
 * Projects a validated authoring-context field onto the form's editable
 * member names. Values and changed paths stay browser-local state, never
 * prefilled evidence.
 */
export const projectCmsEditorialCreateFormField = (
  field: AuthoringContextField,
): {
  readonly fieldId: string;
  readonly key: string;
  readonly kind: AuthoringContextField['kind'];
  readonly required: boolean;
  readonly label: string;
  readonly helpText?: string;
} => ({
  fieldId: field.stableFieldId,
  key: field.key,
  kind: field.kind,
  required: field.required,
  label: field.editorConfig.label,
  ...(field.editorConfig.helpText === undefined
    ? {}
    : { helpText: field.editorConfig.helpText }),
});

/**
 * Assembles the CMS-03B-10 body from the prefilled evidence plus typed local
 * field state. The assembly is pure: the transport owns idempotency and the
 * server re-derives every authority member.
 */
export const buildCmsEditorialEntryCreateFormRequest = (input: {
  readonly prefill: Omit<
    CmsEditorialEntryCreateFormRequest,
    'values' | 'changedPaths'
  >;
  readonly values: CmsEditorialEntryCreateFormRequest['values'];
  readonly changedPaths: CmsEditorialEntryCreateFormRequest['changedPaths'];
}): CmsEditorialEntryCreateFormRequest => ({
  contentTypeId: input.prefill.contentTypeId,
  contentTypeVersionId: input.prefill.contentTypeVersionId,
  locale: input.prefill.locale,
  changedPaths: input.changedPaths,
  values: input.values,
  schemaArtifact: input.prefill.schemaArtifact,
  validatorRefs: input.prefill.validatorRefs,
  workflowPolicy: input.prefill.workflowPolicy,
  activationEvidence: input.prefill.activationEvidence,
});

export type CmsEditorialEntryCreateFormRequest = z.infer<
  typeof CmsEditorialEntryCreateFormRequestSchema
>;
export type CmsEditorialCreateFormPrefill = z.infer<
  typeof CmsEditorialCreateFormPrefillSchema
>;
