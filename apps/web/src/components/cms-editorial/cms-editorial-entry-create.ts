import {
  ENTRY_CREATE_VERIFICATION_SEAMS,
  EntryCreateForbiddenAuthoritySchema,
  EntryCreateHeadersSchema,
  EntryCreateRequestSchema,
  EntryCreateResourceSchema,
  EntryCreateVerificationSchema,
  SchemaArtifactEvidenceSchema,
  ValidatorEvidenceSchema,
} from '@wejammin/contracts';
import type {
  EntryCreateHeaders,
  EntryCreateRequest,
  EntryCreateResource,
  EntryCreateVerification,
  SchemaArtifactEvidence,
  ValidatorEvidence,
} from '@wejammin/contracts';

/**
 * Browser-facing projection of the locked BE03b CMS-03B-10 entry-create
 * contract for the CMS-05 entry workbench.
 *
 * Source of truth: .memory/wiki/specs/be/03b-editorial-workflow-publication.md
 * (Request/Response Contracts 210-232 and 640-656; route rows 822 and 902).
 * FE03 (.memory/wiki/specs/fe/03-cms-content-modeling.md:369-391 and :749)
 * assigns this operation to `cms-editorial-entry-create` as a human form.
 *
 * `packages/contracts/src/cms-editorial/` has landed and registers CMS-03B-10,
 * so every schema below is the shared contract re-exported instead of a
 * second, drift-prone copy. Only what the browser itself owns stays local: the
 * description of the route it calls.
 */

export const CMS_EDITORIAL_ENTRY_CREATE_SOURCE = {
  source: 'packages/contracts/src/cms-editorial/entry-create.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  browserLocal: 'CMS_EDITORIAL_ENTRY_CREATE_ROUTE',
} as const;

/** BE03b `SchemaArtifactEvidence`: exact compiled-artifact identity. */
export const CmsEditorialSchemaArtifactEvidenceSchema =
  SchemaArtifactEvidenceSchema;

/** BE03b `ValidatorEvidence`: named validator key plus its exact version. */
export const CmsEditorialValidatorEvidenceSchema = ValidatorEvidenceSchema;

/** BE03b `EntryCreateRequest`: body-only payload; unknown keys reject. */
export const CmsEditorialEntryCreateRequestSchema = EntryCreateRequestSchema;

/**
 * The server derives owner, assignee, author, acting party, capability, and
 * authority from the authenticated principal, so a body asserting any of them
 * is rejected outright rather than silently ignored.
 */
export const CmsEditorialEntryCreateForbiddenAuthoritySchema =
  EntryCreateForbiddenAuthoritySchema;

/**
 * CMS-03B-10 is the single documented exception to the mutation precondition:
 * it requires `Idempotency-Key` and no `If-Match`, because no prior version
 * exists (03b:165, routes.ts:105-112). `ifMatch` is absent from the shape.
 */
export const CmsEditorialEntryCreateHeadersSchema = EntryCreateHeadersSchema;

/** BE03b `EntryCreateResource`: created entry plus its first revision. */
export const CmsEditorialEntryCreateResourceSchema = EntryCreateResourceSchema;

/**
 * The runtime checks static Zod cannot prove. Shared with the contract: this
 * array is an implementation checklist, not attestation, so the runtime stays
 * the sole authority on schema pairing, artifact identity, and validator refs.
 */
export const CMS_EDITORIAL_ENTRY_CREATE_VERIFICATION_SEAMS =
  ENTRY_CREATE_VERIFICATION_SEAMS;

/**
 * Fail-closed attestation: a create is only trusted once the resolved registry
 * evidence matches the request's schema artifact and every checklist name was
 * considered exactly once.
 */
export const CmsEditorialEntryCreateVerificationSchema =
  EntryCreateVerificationSchema;

/**
 * CMS-03B-10 as the browser uses it: a human form that POSTs the create under
 * an `Idempotency-Key` with no `If-Match`, answered 201 with a strong ETag and
 * a `Location`, never cached. The `workflowPolicy`, `schemaArtifact`,
 * `validatorRefs` and `activationEvidence` members are prefilled from the
 * CMS-03B-14 authoring-context projection and echoed back unmodified, so the
 * create is fully served; `cms-editorial-route-constants.test.ts` pins every
 * member to the registered route policy.
 */
export const CMS_EDITORIAL_ENTRY_CREATE_ROUTE = {
  operationId: 'CMS-03B-10',
  method: 'POST',
  path: '/api/v1/cms/entries',
  successStatus: 201,
  browserPolicy: 'human-form',
  idempotencyRequired: true,
  ifMatchRequired: false,
  locationRequired: true,
  etag: 'strong',
  cacheControl: 'no-store',
  owner: '03b-editorial-workflow-publication.md',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
} as const;

export type CmsEditorialSchemaArtifactEvidence = SchemaArtifactEvidence;
export type CmsEditorialValidatorEvidence = ValidatorEvidence;
export type CmsEditorialEntryCreateRequest = EntryCreateRequest;
export type CmsEditorialEntryCreateHeaders = EntryCreateHeaders;
export type CmsEditorialEntryCreateResource = EntryCreateResource;
export type CmsEditorialEntryCreateVerification = EntryCreateVerification;
