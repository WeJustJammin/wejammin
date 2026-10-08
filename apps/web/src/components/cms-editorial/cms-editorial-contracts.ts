import {
  ApiErrorSchema,
  Bcp47Schema,
  BoundedEntryValuesSchema,
  ChangedPathsSchema,
  CmsHashSchema,
  CmsUuidSchema,
  EntryRevisionRequestSchema,
  EntryRevisionResourceSchema,
  EntryRevisionStateSchema,
  JsonPointerSchema,
  entryRevisionResourceMetaShape,
  RevisionHistoryPageSchema,
  RevisionHistoryQuerySchema,
  RevisionSummarySchema,
} from '@wejammin/contracts';
import { z } from 'zod';

/**
 * Browser-local projection of the locked BE03b revision contracts for the
 * CMS-05 create/edit entry workbench.
 *
 * Source of truth: .memory/wiki/specs/be/03b-editorial-workflow-publication.md
 * (Request/Response Contracts, lines 196-635).
 *
 * packages/contracts/src/cms-editorial/ has landed for CMS-03B-01, so this
 * module reuses the shared primitives (CmsUuidSchema, CmsHashSchema,
 * CmsInstantSchema, Bcp47Schema, JsonPointerSchema, ChangedPathsSchema,
 * BoundedEntryValuesSchema, EntryRevisionStateSchema) rather than redeclaring
 * them. It keeps a browser-local guard only where reuse would regress failure
 * safety:
 *
 * - Every CAS version field, as defence in depth rather than a workaround.
 *   The shared CmsVersionSchema is currently safe: it guards its own range
 *   refinement so '1.5', 'abc', '0', and '' all return a normal
 *   `{ success: false }` instead of throwing out of `safeParse`. That was not
 *   always true, and this browser boundary handles client-supplied drafts and
 *   malformed server bodies, so CmsEditorialVersionSchema keeps gating its own
 *   BigInt conversion. Both layers now fail closed on exactly the same inputs;
 *   the local guard exists so a future change to the shared primitive cannot
 *   turn a validation failure into an uncaught error on the client.
 */

export const CMS_EDITORIAL_CONTRACTS_SOURCE = {
  source: 'packages/contracts/src/cms-editorial',
  interim: 'apps/web/src/components/cms-editorial/cms-editorial-contracts.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  reusedShared: [
    'CmsUuidSchema',
    'CmsHashSchema',
    'CmsInstantSchema',
    'Bcp47Schema',
    'JsonPointerSchema',
    'ChangedPathsSchema',
    'BoundedEntryValuesSchema',
    'EntryRevisionStateSchema',
  ],
  browserLocalGuards: ['CmsEditorialVersionSchema'],
} as const;

export const CmsEditorialUuidSchema = CmsUuidSchema;
export const CmsEditorialHashSchema = CmsHashSchema;
export const CmsEditorialBcp47Schema = Bcp47Schema;
export const CmsEditorialJsonPointerSchema = JsonPointerSchema;
export const CmsEditorialChangedPathsSchema = ChangedPathsSchema;
export const CmsEditorialBoundedEntryValuesSchema = BoundedEntryValuesSchema;
export const CmsEditorialEntryRevisionStateSchema = EntryRevisionStateSchema;

const CMS_EDITORIAL_VERSION_MAX = 9_223_372_036_854_775_807n;

/**
 * The base shape check rejects non-canonical text, but Zod runs this
 * refinement even when that check already failed, so the range guard must not
 * hand a non-numeric string to `BigInt` (which throws on '1.5' or 'abc' and
 * would escape as an uncaught error instead of a validation failure).
 */
const isCmsEditorialVersionWithinRange = (value: string): boolean =>
  /^[0-9]+$/u.test(value) ? BigInt(value) <= CMS_EDITORIAL_VERSION_MAX : true;

export const CmsEditorialVersionSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/u)
  .refine(isCmsEditorialVersionWithinRange, 'version_out_of_range');

/**
 * The CMS-03B-01 request and the revision resource are the shared contracts.
 * They were once mirrored here, and the mirror went stale the moment the
 * resource gained `entryVersion` (a strict local copy would have refused every
 * real 201). `entryVersion` is the committed entry aggregate version and the
 * only valid next `If-Match`; `version` is the immutable snapshot's own
 * version (always 1).
 */
export const CmsEditorialEntryRevisionRequestSchema =
  EntryRevisionRequestSchema;
export const CmsEditorialResourceMetaSchema = z.strictObject(
  entryRevisionResourceMetaShape,
);
export const CmsEditorialEntryRevisionResourceSchema =
  EntryRevisionResourceSchema;

/**
 * The CMS-03B-03 history shapes are the shared contracts, re-exported under the
 * browser names. They were once mirrored here, which drifted (no comparison
 * `domain`, no `restore` carrier); a copy is exactly what the shared module
 * exists to prevent.
 */
export const CmsEditorialRevisionSummarySchema = RevisionSummarySchema;
export const CmsEditorialRevisionHistoryQuerySchema =
  RevisionHistoryQuerySchema;
export const CmsEditorialRevisionHistoryPageSchema = RevisionHistoryPageSchema;

export const CmsEditorialApiErrorSchema = ApiErrorSchema;

export type CmsEditorialEntryRevisionRequest = z.infer<
  typeof CmsEditorialEntryRevisionRequestSchema
>;
export type CmsEditorialEntryRevisionResource = z.infer<
  typeof CmsEditorialEntryRevisionResourceSchema
>;
export type CmsEditorialEntryRevisionState = z.infer<
  typeof CmsEditorialEntryRevisionStateSchema
>;
export type CmsEditorialRevisionSummary = z.infer<
  typeof CmsEditorialRevisionSummarySchema
>;
export type CmsEditorialRevisionHistoryQuery = z.infer<
  typeof CmsEditorialRevisionHistoryQuerySchema
>;
export type CmsEditorialRevisionHistoryPage = z.infer<
  typeof CmsEditorialRevisionHistoryPageSchema
>;
