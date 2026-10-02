import { z } from 'zod';

import {
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';

/** BE03b `EntryRevisionState`: the exact closed revision lifecycle. */
export const EntryRevisionStateSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'scheduled',
  'published',
]);

/**
 * BE03b `ResourceMeta` for 03b envelopes: id, version, and timestamps only.
 * It deliberately omits the 03a registry's `contentHash`, which 03b carries on
 * the revision resource itself where the spec places it.
 */
export const entryRevisionResourceMetaShape = {
  id: CmsUuidSchema,
  version: CmsVersionSchema,
  createdAt: CmsInstantSchema,
  updatedAt: CmsInstantSchema,
} as const;

export type EntryRevisionState = z.infer<typeof EntryRevisionStateSchema>;

/** BE03b `lifecycle`: the closed ContentEntry lifecycle vocabulary. */
export const EntryLifecycleSchema = z.enum([
  'active',
  'archived',
  'deletion_pending',
  'held',
]);

/** BE03b `validationState`: the closed revision validation vocabulary. */
export const EntryValidationStateSchema = z.enum([
  'valid',
  'invalid',
  'unknown',
]);

/** Strict 03b resource meta reused by the create and draft-detail envelopes. */
export const entryRevisionResourceMetaSchema = z.strictObject(
  entryRevisionResourceMetaShape,
);

export type EntryLifecycle = z.infer<typeof EntryLifecycleSchema>;
export type EntryValidationState = z.infer<typeof EntryValidationStateSchema>;

/**
 * BE03b ConflictYoursSource: the two shapes a durable conflict record stores
 * for the yours branch. A record is bound either to a stored revision or to
 * bounded proposed values plus their hash, never to both and never to neither.
 */
export const ConflictYoursSourceSchema = z.enum(['revision', 'proposed']);

/**
 * BE03b ConflictRecordState: the closed durable conflict lifecycle. A record is
 * open while the entry is divergent, resolved once a resolution revision lands,
 * and superseded when a later conflict replaces it.
 */
export const ConflictRecordStateSchema = z.enum([
  'open',
  'resolved',
  'superseded',
]);

export type ConflictYoursSource = z.infer<typeof ConflictYoursSourceSchema>;
export type ConflictRecordState = z.infer<typeof ConflictRecordStateSchema>;
