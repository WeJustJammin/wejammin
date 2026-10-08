import {
  RevisionRestoreAvailabilitySchema,
  RevisionRestoreRequestSchema,
} from '@wejammin/contracts';
import type {
  RevisionRestoreAvailability,
  RevisionRestoreRequest,
} from '@wejammin/contracts';
import { z } from 'zod';

/**
 * Browser-side projection of the locked BE03b CMS-03B-04 restore for the
 * CMS-05 workbench (03-cms-content-modeling.md CmsEditorialRestoreForm).
 *
 * The form is a confirmation, not an editor: migrationChainId is the
 * read-derived D6 compare.restore carrier value submitted unchanged, and the
 * server re-derives the chain and requires equality (409
 * migration_chain_mismatch). edgeCount and availability drive the confirmation
 * copy; commit is refused while the chain is unavailable so the source
 * revision and the current draft stay untouched.
 */
export const CMS_EDITORIAL_RESTORE_SOURCE = {
  request: 'packages/contracts/src/cms-editorial/revision-restore.ts',
  carrier: 'packages/contracts/src/cms-editorial/revision-history.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  route: 'POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
  successStatus: 201,
} as const;

/** BE03b RevisionRestoreRequest, reused verbatim: the restore command body. */
export const CmsEditorialRestoreRequestSchema = RevisionRestoreRequestSchema;

/** BE03b RevisionRestoreAvailability: the closed commit-verdict vocabulary. */
export const CmsEditorialRestoreAvailabilitySchema =
  RevisionRestoreAvailabilitySchema;

/**
 * FE03 CmsEditorialRestoreForm carrier, the D6 compare.restore preimage the
 * confirmation form consumes. It is a browser projection, not the raw BE03b
 * RevisionHistoryRestore: chainHash stays projection-only (it binds the verdict
 * to the resolved chain and never enters the request), so the browser carrier
 * exposes only the read-derived migrationChainId, the bounded edgeCount and the
 * closed availability verdict. Strict, so a carrier leaking a chain hash or an
 * authority id fails closed before the form renders.
 */
export const CmsEditorialRestoreCarrierSchema = z
  .strictObject({
    migrationChainId: z.string().min(1).max(512),
    edgeCount: z.number().int().min(0).max(64),
    availability: RevisionRestoreAvailabilitySchema,
  })
  .readonly();

export type CmsEditorialRestoreCarrier = z.infer<
  typeof CmsEditorialRestoreCarrierSchema
>;
export type CmsEditorialRestoreAvailability = RevisionRestoreAvailability;

/**
 * True only while the resolved chain can actually translate the source. A
 * chain_unavailable or transform_missing verdict refuses the commit with copy
 * instead of submitting a request the server must bounce.
 */
export const commitAllowedForAvailability = (
  availability: RevisionRestoreAvailability,
): boolean => availability === 'available';

/**
 * Safe confirmation copy. The edge count is shown as a plain count and the
 * refusal names only the closed verdict, never chain internals.
 */
export const cmsEditorialRestoreCommitCopy = (
  carrier: CmsEditorialRestoreCarrier,
): { readonly commitAllowed: boolean; readonly message: string } =>
  commitAllowedForAvailability(carrier.availability)
    ? {
        commitAllowed: true,
        message:
          'Restoring creates a new draft revision. The source revision stays unchanged.',
      }
    : {
        commitAllowed: false,
        message:
          'This revision cannot be restored right now. The source revision and the current draft are unchanged.',
      };

/**
 * Assembles the CMS-03B-04 body from the confirmation state. The chain id is
 * echoed read-derived; expectedVersion is the entry CAS the caller already
 * holds. Owner, capability and the translated values stay server-derived.
 */
export const buildCmsEditorialRestoreRequest = (input: {
  readonly entryId: RevisionRestoreRequest['entryId'];
  readonly revisionId: RevisionRestoreRequest['revisionId'];
  readonly migrationChainId: CmsEditorialRestoreCarrier['migrationChainId'];
  readonly expectedVersion: RevisionRestoreRequest['expectedVersion'];
}): RevisionRestoreRequest => ({
  entryId: input.entryId,
  revisionId: input.revisionId,
  migrationChainId: input.migrationChainId,
  expectedVersion: input.expectedVersion,
});
