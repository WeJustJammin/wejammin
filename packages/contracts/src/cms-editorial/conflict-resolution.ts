import { z } from 'zod';

import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { ConflictChoiceSchema } from './conflict-choice.ts';
import { refineIfMatchEqualsExpectedVersion } from './if-match.ts';

/**
 * BE03b ConflictResolutionRequest: the CMS-03B-02 body.  entryId and conflictId
 * repeat the path parameters so the body is self-describing, and expectedVersion
 * carries the entry version the caller read.  Ownership, the resolving party, its
 * capability, and the yours-side source are absent: the server derives each one.
 * Resolution is never inferred, so a list that decides the same path twice is
 * rejected instead of resolved by a silent winner.
 */
export const ConflictResolutionRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    conflictId: CmsUuidSchema,
    baseRevision: CmsVersionSchema,
    choices: z.array(ConflictChoiceSchema).min(1).max(128).readonly(),
    expectedVersion: CmsVersionSchema,
  })
  .superRefine(({ choices }, context) => {
    const paths = choices.map(({ path }) => path);
    if (new Set(paths).size !== paths.length)
      context.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'conflict_choice_paths_must_be_unique',
      });
  })
  .readonly();

/** BE03b CMS-03B-02 addressing: exactly the entry and the open conflict. */
export const ConflictResolutionPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema, conflictId: CmsUuidSchema })
  .readonly();

/**
 * CMS-03B-02 headers.  BE03b binds the route to key + If-Match and requires it
 * to CAS both the conflict base and the entry version, so the command takes an
 * Idempotency-Key and an exact strong If-Match version.
 */
export const ConflictResolutionHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/**
 * The authority names CMS-03B-02 must never accept from a caller: the resolving
 * party, its capability, and the winning side are all server-derived.
 */
export const ConflictResolutionForbiddenAuthoritySchema = z
  .strictObject({})
  .readonly();

/**
 * OpenAPI transport view for CMS-03B-02: both resolved UUIDs, the command
 * headers, and the explicit-choice body, so the generated document can bind
 * every parameter location to the runtime schemas it already validates.
 */
export const ConflictResolutionApiRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    conflictId: CmsUuidSchema,
    headers: ConflictResolutionHeadersSchema,
    body: ConflictResolutionRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/**
 * Implementation checklist only.  These are the checks CMS-03B-02 must perform
 * at runtime; the names are NOT attestation labels and this array is NOT proof
 * that any check ran.  Nothing here binds a caller-supplied list to a conflict
 * record read, so the runtime is the sole authority.
 */
export const CONFLICT_RESOLUTION_SEAMS = [
  'conflict_open_state_comparison',
  'conflict_base_revision_match',
  'conflict_version_cas',
  'entry_version_cas',
  'choice_path_within_recorded_changed_paths',
  'named_choice_source_revision_resolution',
  'explicit_choice_active_schema_typing',
  'two_parent_revision_and_atomic_conflict_close',
] as const;

export type ConflictResolutionSeam = (typeof CONFLICT_RESOLUTION_SEAMS)[number];
export type ConflictResolutionRequest = z.infer<
  typeof ConflictResolutionRequestSchema
>;
export type ConflictResolutionPathParams = z.infer<
  typeof ConflictResolutionPathParamsSchema
>;
export type ConflictResolutionHeaders = z.infer<
  typeof ConflictResolutionHeadersSchema
>;
