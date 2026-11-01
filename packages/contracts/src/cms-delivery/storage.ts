import { z } from 'zod';

import type { JsonValue } from '../api-error.ts';
import { parseInstant } from '../cms-editorial/time-authority/local-datetime.ts';
import {
  CmsHashSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';

/** BE04a sealed-artifact states, distinct from compiler attempt outcomes. */
export const RouteManifestVersionStorageStateSchema = z.enum([
  'ready',
  'active',
  'superseded',
]);

/** BE04c row lifecycle, distinct from the public convergence summary. */
export const PublicationProjectionStorageStateSchema = z.enum([
  'building',
  'ready',
  'blocked',
  'failed_retryable',
  'active',
  'superseded',
  'revoked',
]);

const StorageInstantSchema = z
  .string()
  .refine((value) => parseInstant(value) !== null, 'storage_instant_invalid');

// PostgreSQL varchar(n) counts characters, including astral characters once.
const storageVarchar = (maximum: number): z.ZodString =>
  z
    .string()
    .refine(
      (value) => Array.from(value).length <= maximum,
      'storage_varchar_too_long',
    );

// Storage JSON has no error-details depth, item, key or byte ceilings.
const isStorageJsonValue = (value: unknown): value is JsonValue => {
  const ancestors = new WeakSet<object>();
  const visit = (candidate: unknown): boolean => {
    if (candidate === null) return true;
    if (typeof candidate === 'string' || typeof candidate === 'boolean')
      return true;
    if (typeof candidate === 'number') return Number.isFinite(candidate);
    if (typeof candidate !== 'object' || ancestors.has(candidate)) return false;
    ancestors.add(candidate);
    const valid = Array.isArray(candidate)
      ? Array.from(candidate).every(visit)
      : (Object.getPrototypeOf(candidate) === Object.prototype ||
          Object.getPrototypeOf(candidate) === null) &&
        Reflect.ownKeys(candidate).every(
          (key) =>
            typeof key === 'string' &&
            visit((candidate as Record<string, unknown>)[key]),
        );
    ancestors.delete(candidate);
    return valid;
  };
  try {
    return visit(value);
  } catch {
    return false;
  }
};

// Validate without reparsing: valid own JSON keys and prototypes must survive.
const StorageJsonObjectSchema = z.custom<Readonly<Record<string, JsonValue>>>(
  (value) =>
    isStorageJsonValue(value) &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value),
);
const StorageJsonArraySchema = z.custom<readonly JsonValue[]>(
  (value) => isStorageJsonValue(value) && Array.isArray(value),
);

/**
 * JSON-safe mapped record for platform_private.route_manifest_version (BE04a).
 * Bigints are decimal strings; this is not a generated Supabase raw Row type.
 * Hash syntax alone does not establish the compiler's complete frozen set.
 */
export const RouteManifestVersionStorageSchema = z
  .strictObject({
    id: CmsUuidSchema,
    version_no: CmsVersionSchema,
    publication_set_hash: CmsHashSchema,
    state: RouteManifestVersionStorageStateSchema,
    generated_at: StorageInstantSchema,
    activated_at: StorageInstantSchema.nullable(),
  })
  .superRefine((record, context) => {
    if ((record.state === 'ready') !== (record.activated_at === null)) {
      context.addIssue({
        code: 'custom',
        path: ['activated_at'],
        message: 'manifest_activation_state_mismatch',
      });
    }
    if (record.activated_at === null) return;
    const generated = parseInstant(record.generated_at);
    const activated = parseInstant(record.activated_at);
    if (generated === null || activated === null) return;
    if (
      activated.seconds < generated.seconds ||
      (activated.seconds === generated.seconds &&
        activated.nanos < generated.nanos)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['activated_at'],
        message: 'manifest_activation_precedes_generation',
      });
    }
  });

/** BE04c exact private receiving record; publication_id is a VERSION-row ID. */
export const PublicationProjectionStorageSchema = z.strictObject({
  id: CmsUuidSchema,
  publication_id: CmsUuidSchema,
  route_manifest_id: CmsUuidSchema,
  locale: storageVarchar(16),
  audience: storageVarchar(48),
  render_payload: StorageJsonObjectSchema,
  render_hash: CmsHashSchema,
  discovery_hash: CmsHashSchema,
  required_refs: StorageJsonArraySchema,
  state: PublicationProjectionStorageStateSchema,
  version: CmsVersionSchema,
  created_at: StorageInstantSchema,
  updated_at: StorageInstantSchema,
});

export type RouteManifestVersionStorage = z.infer<
  typeof RouteManifestVersionStorageSchema
>;
export type PublicationProjectionStorage = z.infer<
  typeof PublicationProjectionStorageSchema
>;
export type RouteManifestVersionStorageState = z.infer<
  typeof RouteManifestVersionStorageStateSchema
>;
export type PublicationProjectionStorageState = z.infer<
  typeof PublicationProjectionStorageStateSchema
>;
