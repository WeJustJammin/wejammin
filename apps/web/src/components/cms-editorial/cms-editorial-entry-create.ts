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

import type { CmsEditorialAsyncState } from './cms-editorial-types';

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
 * honest transport boundary and the fail-closed page resolver.
 */

export const CMS_EDITORIAL_ENTRY_CREATE_SOURCE = {
  source: 'packages/contracts/src/cms-editorial/entry-create.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  browserLocal:
    'CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY and resolveCmsEditorialEntryCreatePageState',
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
 * Honest boundary for the browser. FE03 authorises CMS-03B-10, the shared
 * contract is implemented and registered, and the first-party proxy now exists
 * at apps/web/src/server/cms-editorial-platform-mutation.ts. The protected
 * Worker route is served, but the locked request requires a `workflowPolicy`
 * evidence object that no served response schema exposes: the 03a detail carries
 * `schemaArtifact` and `activationEvidence`, but never `workflowPolicy`.
 * Substituting one for the other, or synthesising a policy hash, would be
 * fabrication. The create surface therefore stays fail-closed until a
 * protected source for that exact evidence is defined.
 */
export const CMS_EDITORIAL_ENTRY_CREATE_BOUNDARY = {
  status: 'route-served-policy-evidence-unavailable',
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
  blocker:
    'The CMS-03B-10 proxy and protected Worker route are served, but the locked request requires a workflowPolicy evidence object that no protected served response exposes. The private editorial-policy source is also unconfigured; the browser cannot obtain or invent that evidence, so creation remains unavailable.',
  owner: '03b-editorial-workflow-publication.md',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
} as const;

/**
 * Safe copy for the disabled create surface. Fixed and non-disclosing: it must
 * not hint whether any entry already exists.
 */
export const CMS_EDITORIAL_ENTRY_CREATE_DISABLED_REASON =
  'Entry creation is unavailable, and no entry was created.';

export const resolveCmsEditorialEntryCreatePageState =
  (): CmsEditorialAsyncState<never> => ({
    status: 'disabled',
    reason: CMS_EDITORIAL_ENTRY_CREATE_DISABLED_REASON,
  });

export type CmsEditorialSchemaArtifactEvidence = SchemaArtifactEvidence;
export type CmsEditorialValidatorEvidence = ValidatorEvidence;
export type CmsEditorialEntryCreateRequest = EntryCreateRequest;
export type CmsEditorialEntryCreateHeaders = EntryCreateHeaders;
export type CmsEditorialEntryCreateResource = EntryCreateResource;
export type CmsEditorialEntryCreateVerification = EntryCreateVerification;
