import { z } from 'zod';

import {
  CmsHashSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { ConfigurationKeySchema } from '../platform-configuration/primitives.ts';

/*
 * BE03b "Settings snapshot authority (E7)": `DependencyManifest.settings` and
 * `VersionSet.settingsVersion` come from one code-owned, versioned registry of
 * the Slice 07 setting definition keys whose effective value alters what a
 * publication contains. The Postgres mirror is
 * `platform_private.cms_publication_settings_keys()`. Adding a key is code plus a
 * forward migration and a registry version bump.
 */

/** Registry version 1 has no members: no Phase 2 setting alters publication content. */
export const CMS_PUBLICATION_SETTINGS_REGISTRY_VERSION = 1 as const;

export const CMS_PUBLICATION_SETTINGS_KEYS: readonly string[] = [];

/** The Slice 07 resolver consumer key (`cfg_resolve_effective_value`). */
export const CMS_SETTINGS_CONSUMER_KEY = 'cms.publication' as const;

/**
 * The lowercase SHA-256 of the JCS form of the empty snapshot `[]`, so the first
 * evaluation records ordinal 1 for the empty snapshot.
 */
export const CMS_EMPTY_SETTINGS_SNAPSHOT_HASH =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' as const;

/**
 * One registered key's resolved value: `{ key, definitionVersionId,
 * sourceValueVersionId, valueHash }`, where the last two are null together for a
 * contract default.
 */
export const SettingsSnapshotEntrySchema = z
  .strictObject({
    key: ConfigurationKeySchema,
    definitionVersionId: CmsUuidSchema,
    sourceValueVersionId: CmsUuidSchema.nullable(),
    valueHash: CmsHashSchema.nullable(),
  })
  .superRefine((value, context) => {
    if ((value.sourceValueVersionId === null) !== (value.valueHash === null))
      context.addIssue({
        code: 'custom',
        path: ['valueHash'],
        message:
          'a contract default has neither a source value version nor a value hash',
      });
  })
  .readonly();

/** The issue message of a snapshot whose keys differ from the registered keys. */
export const SETTINGS_SNAPSHOT_KEYS_MESSAGE =
  'a snapshot has exactly one entry per registered key, in registry order';

/**
 * The snapshot for one registry: one entry per registered key, in the
 * registry's ascending key order, and no other entry. `registeredKeys` is a
 * parameter so a future registry version is testable without mutating the
 * code-owned constant.
 */
export const createSettingsSnapshotSchema = (
  registeredKeys: readonly string[],
) =>
  z
    .array(SettingsSnapshotEntrySchema)
    .refine(
      (entries) =>
        entries.length === registeredKeys.length &&
        entries.every((entry, index) => entry.key === registeredKeys[index]),
      SETTINGS_SNAPSHOT_KEYS_MESSAGE,
    )
    .readonly();

/**
 * BE03b E7 snapshot: registry version 1 has no members, so the only valid
 * snapshot is the empty array whose hash is `CMS_EMPTY_SETTINGS_SNAPSHOT_HASH`.
 */
export const SettingsSnapshotSchema = createSettingsSnapshotSchema(
  CMS_PUBLICATION_SETTINGS_KEYS,
);

export type SettingsSnapshotEntry = z.infer<typeof SettingsSnapshotEntrySchema>;
export type SettingsSnapshot = z.infer<typeof SettingsSnapshotSchema>;
