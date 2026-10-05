import { z } from 'zod';

import {
  JSON_VALUE_MAX_BYTES,
  JSON_VALUE_MAX_DEPTH,
  JSON_VALUE_MAX_KEYS,
  JsonValueSchema,
  type JsonValue,
} from '../api-error.ts';
import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  ConflictRecordStateSchema,
  ConflictYoursSourceSchema,
  EntryRevisionStateSchema,
  entryRevisionResourceMetaShape,
} from './models.ts';
import {
  Bcp47Schema,
  JsonPointerSchema,
  cmsEditorialJsonDepth,
} from './primitives.ts';

/** BE03b `EntryRevisionResource`: strict meta plus the closed revision shape. */
export const EntryRevisionResourceSchema = z
  .strictObject({
    ...entryRevisionResourceMetaShape,
    state: EntryRevisionStateSchema,
    entryId: CmsUuidSchema,
    revisionNumber: CmsVersionSchema,
    schemaVersionId: CmsUuidSchema,
    templateVersionId: CmsUuidSchema.nullable(),
    taxonomyVersionIds: z.array(CmsUuidSchema).max(64).readonly(),
    locale: Bcp47Schema,
    contentHash: CmsHashSchema,
    parentRevisionIds: z.array(CmsUuidSchema).max(2).readonly(),
    validationState: z.enum(['valid', 'invalid', 'unknown']),
    conflictId: CmsUuidSchema.nullable(),
  })
  .readonly();

export type EntryRevisionResource = z.infer<typeof EntryRevisionResourceSchema>;

/**
 * The BE03b bound on persisted conflict proposed values: at most 128 top-level
 * keys, JSON nesting no deeper than 8 levels, and at most 256 KiB serialized.
 * These repeat the shared JSON envelope numbers deliberately, so the durable
 * record limit stays visible here and a later loosening of the shared helper
 * cannot widen it unnoticed.
 */
const conflictProposedValuesBytes = (value: JsonValue): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const ConflictRecordProposedValuesSchema = z
  .record(z.string(), JsonValueSchema)
  .superRefine((value, context) => {
    if (Object.keys(value).length > JSON_VALUE_MAX_KEYS)
      context.addIssue({
        code: 'custom',
        message: 'conflict_proposed_values_max_keys',
      });
    if (cmsEditorialJsonDepth(value) > JSON_VALUE_MAX_DEPTH)
      context.addIssue({
        code: 'custom',
        message: 'conflict_proposed_values_max_depth',
      });
    if (conflictProposedValuesBytes(value) > JSON_VALUE_MAX_BYTES)
      context.addIssue({
        code: 'custom',
        message: 'conflict_proposed_values_max_bytes',
      });
  });

export type ConflictRecordProposedValues = z.infer<
  typeof ConflictRecordProposedValuesSchema
>;

/**
 * BE03b ConflictRecordResource: the durable server-side conflict record. The
 * divergence hashes and recorded paths are safe, but proposedValues is the
 * unpublished draft content a rejected or late autosave carried. This is an
 * internal persisted/resource validation contract only: no row in
 * cmsEditorialRoutePolicies references it and no public request schema accepts
 * proposedValues. The two superRefines enforce the couplings BE03b states, so
 * yoursSource always binds exactly one branch and the resolved envelope is
 * all-or-nothing rather than half-populated.
 */
export const ConflictRecordResourceSchema = z
  .strictObject({
    ...entryRevisionResourceMetaShape,
    state: ConflictRecordStateSchema,
    entryId: CmsUuidSchema,
    baseRevisionId: CmsUuidSchema,
    theirsRevisionId: CmsUuidSchema,
    yoursRevisionId: CmsUuidSchema.nullable(),
    yoursSource: ConflictYoursSourceSchema,
    proposedValues: ConflictRecordProposedValuesSchema.nullable(),
    proposedValuesHash: CmsHashSchema.nullable(),
    changedPaths: z.array(JsonPointerSchema).min(1).max(128).readonly(),
    baseHash: CmsHashSchema,
    theirsHash: CmsHashSchema,
    yoursHash: CmsHashSchema,
    conflictHash: CmsHashSchema,
    resolvedRevisionId: CmsUuidSchema.nullable(),
    resolvedByPersonId: CmsUuidSchema.nullable(),
    resolvedAt: CmsInstantSchema.nullable(),
  })
  .superRefine((value, context) => {
    const revisionBound =
      value.yoursSource === 'revision' &&
      value.yoursRevisionId !== null &&
      value.proposedValues === null &&
      value.proposedValuesHash === null;
    const proposedBound =
      value.yoursSource === 'proposed' &&
      value.yoursRevisionId === null &&
      value.proposedValues !== null &&
      value.proposedValuesHash !== null;
    if (!revisionBound && !proposedBound)
      context.addIssue({
        code: 'custom',
        path: ['yoursSource'],
        message:
          'yoursSource must bind to exactly one of yoursRevisionId or bounded proposedValues/hash',
      });
    const resolvedNull =
      value.resolvedRevisionId === null &&
      value.resolvedByPersonId === null &&
      value.resolvedAt === null;
    const resolvedBound =
      value.resolvedRevisionId !== null &&
      value.resolvedByPersonId !== null &&
      value.resolvedAt !== null;
    if (value.state === 'resolved' ? !resolvedBound : !resolvedNull)
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message:
          'resolved requires resolvedRevisionId/resolvedByPersonId/resolvedAt; open/superseded require all null',
      });
  })
  .readonly();

export type ConflictRecordResource = z.infer<
  typeof ConflictRecordResourceSchema
>;
