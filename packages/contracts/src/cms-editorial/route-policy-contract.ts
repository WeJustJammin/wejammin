import { z } from 'zod';

import {
  CMS_EDITORIAL_OPERATION_IDS,
  type CmsEditorialCapability,
  type CmsEditorialCapabilityMode,
  type CmsEditorialOperationId,
  type CmsEditorialPath,
  type CmsEditorialPathParamsSchemaName,
  type CmsEditorialRequestSchemaName,
  type CmsEditorialSuccessSchemaName,
} from './route-policy-base.ts';
import type {
  EditorialConflictResolutionErrors,
  EditorialDraftDetailErrors,
  EditorialEntryCreateErrors,
  EditorialRestoreErrors,
  EditorialRevisionErrors,
  EditorialRevisionHistoryErrors,
} from './route-policy-errors.ts';

export type CmsEditorialRouteContract = {
  method: 'POST' | 'GET';
  path: CmsEditorialPath;
  requestSchema: CmsEditorialRequestSchemaName;
  /** Present only when the route actually binds path parameters. */
  pathParamsSchema?: CmsEditorialPathParamsSchemaName;
  /** Present only for JSON-body commands; safe reads declare querySchema. */
  headersSchema?:
    | 'EntryRevisionHeadersSchema'
    | 'ConflictResolutionHeadersSchema'
    | 'RevisionRestoreHeadersSchema'
    | 'EntryCreateHeadersSchema';
  /** Present only for safe reads whose input is a query string. */
  querySchema?: 'EntryDraftDetailQuerySchema' | 'RevisionHistoryQuerySchema';
  successSchema: CmsEditorialSuccessSchemaName;
  successStatus: 200 | 201;
  outcome: 'created' | 'read';
  etag: 'strong' | 'none';
  location: 'required' | 'none';
  auth: 'editorial_author' | 'editorial_reader';
  capabilities: readonly CmsEditorialCapability[];
  capabilityMode: CmsEditorialCapabilityMode;
  audience: 'browser';
  cors: 'cms-console';
  csrf: 'required' | 'forbidden' | 'none';
  rawBodySignature: 'required' | 'none';
  idempotency: 'required' | 'none';
  ifMatch: 'required' | 'none';
  maxBodyBytes: 262_144;
  rateClass: 'cms-entry-write' | 'cms-entry-conflict' | 'cms-entry-read';
  rateLimit: number;
  partyRateLimit?: number;
  rateWindowSeconds: 60;
  rateScope: 'user' | 'party';
  timeoutMs: 15_000 | 8_000;
  responseTargetMs: number;
  cacheControl: 'no-store';
  slo: CmsEditorialSlo;
  /** The explicit none value is the no-event declaration for safe reads. */
  eventType: 'cms.entry.revision-created.v1' | 'none';
  errors:
    | EditorialRevisionErrors
    | EditorialConflictResolutionErrors
    | EditorialRevisionHistoryErrors
    | EditorialRestoreErrors
    | EditorialEntryCreateErrors
    | EditorialDraftDetailErrors;
};

/**
 * Tier 1 is the read budget (p95 under 750ms) and Tier 2 the command budget
 * (p95 under 1,200ms); both share the protected-RPC and acceptance budgets.
 */
export type CmsEditorialSlo =
  | Readonly<{
      tier: 1;
      commandP95Ms: 750;
      protectedRpcP95Ms: 300;
      acceptanceP99Ms: 1_000;
    }>
  | Readonly<{
      tier: 2;
      commandP95Ms: 1_200;
      protectedRpcP95Ms: 300;
      acceptanceP99Ms: 1_000;
    }>;

export type CmsEditorialRoutePolicy = Readonly<{
  operationId: CmsEditorialOperationId;
}> &
  CmsEditorialRouteContract;

/**
 * The command outcome set: every POST row must carry a write-or-conflict rate
 * class, the 201 status, the command event type, and the 15s budget.
 */
const commandShapeSchema = z.object({
  operationId: z.enum(CMS_EDITORIAL_OPERATION_IDS),
  method: z.literal('POST'),
  path: z.literal([
    '/api/v1/cms/entries/{entryId}/revisions',
    '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
    '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
    '/api/v1/cms/entries',
  ]),
  requestSchema: z.literal([
    'EntryRevisionRequestSchema',
    'ConflictResolutionRequestSchema',
    'RevisionRestoreRequestSchema',
    'EntryCreateRequestSchema',
  ]),
  successSchema: z.literal([
    'EntryRevisionResourceSchema',
    'EntryCreateResourceSchema',
  ]),
  successStatus: z.literal(201),
  outcome: z.literal('created'),
  rateClass: z.literal(['cms-entry-write', 'cms-entry-conflict']),
  timeoutMs: z.literal(15_000),
  eventType: z.literal('cms.entry.revision-created.v1'),
});

/** The read outcome set: both GET rows and their read-only discriminants. */
const readShapeSchema = z.object({
  operationId: z.enum(CMS_EDITORIAL_OPERATION_IDS),
  method: z.literal('GET'),
  path: z.literal([
    '/api/v1/cms/entries/{entryId}',
    '/api/v1/cms/entries/{entryId}/revisions',
  ]),
  requestSchema: z.literal([
    'EntryDraftDetailQuerySchema',
    'RevisionHistoryQuerySchema',
  ]),
  successSchema: z.literal([
    'EntryDraftDetailResourceSchema',
    'RevisionHistoryPageSchema',
  ]),
  successStatus: z.literal(200),
  outcome: z.literal('read'),
  rateClass: z.literal('cms-entry-read'),
  timeoutMs: z.literal(8_000),
  eventType: z.literal('none'),
});

/**
 * Runtime guard over the six-operation discriminants.  Each union member keeps
 * its own exact literal set, so a row that reuses the other outcome's value (a
 * read carrying the write rate class, a command on a read path, or an omitted
 * eventType) fails here as well as in the registry.  The object is not strict on
 * purpose: it proves every listed discriminant and tolerates the remaining row
 * policy fields instead of duplicating the whole contract.
 *
 * - requestSchema is required on every row because each route binds a request
 *   contract there, even the reads that also carry a pathParamsSchema.
 * - eventType keeps the explicit none member instead of allowing an absent key,
 *   so a safe read cannot silently inherit the command event type.
 */
export const policyShapeSchema = z.discriminatedUnion('outcome', [
  commandShapeSchema,
  readShapeSchema,
]);
