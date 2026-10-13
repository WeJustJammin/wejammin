import { z } from 'zod';

import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { refineIfMatchEqualsExpectedVersion } from './if-match.ts';
import {
  Bcp47Schema,
  BoundedEntryValuesSchema,
  ChangedPathsSchema,
} from './primitives.ts';

/** BE03b `EntryRevisionRequest`: body-only revision payload, unknown keys reject. */
export const EntryRevisionRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    baseRevision: CmsVersionSchema,
    changedPaths: ChangedPathsSchema,
    values: BoundedEntryValuesSchema,
    locale: Bcp47Schema,
    expectedVersion: CmsVersionSchema,
  })
  .readonly();

export const EntryRevisionPathParamsSchema = z
  .strictObject({ entryId: CmsUuidSchema })
  .readonly();

export const EntryRevisionHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/**
 * OpenAPI transport view for CMS-03B-01: the bound UUID path, the command
 * headers, and the revision body.  It exists because the generated document
 * needs one schema that names every parameter location; the body stays the
 * runtime EntryRevisionRequestSchema rather than a restated copy.
 */
export const EntryRevisionApiRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    headers: EntryRevisionHeadersSchema,
    body: EntryRevisionRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

export type EntryRevisionRequest = z.infer<typeof EntryRevisionRequestSchema>;
export type EntryRevisionPathParams = z.infer<
  typeof EntryRevisionPathParamsSchema
>;
export type EntryRevisionHeaders = z.infer<typeof EntryRevisionHeadersSchema>;
