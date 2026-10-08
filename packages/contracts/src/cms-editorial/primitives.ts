import { z } from 'zod';

import { JSON_VALUE_MAX_BYTES, JsonValueSchema } from '../api-error.ts';
import {
  CmsLocaleSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';

/**
 * BE03b `Bcp47`: the registry's locked grammar plus the 2-35 character length
 * bound the BE03b validation matrix states for every editorial locale (the
 * 03a locale configuration bounds a tag at 35 characters too), so a structurally
 * valid tag of 36 or more characters is refused at the proxy and the Worker.
 * The grammar itself stays the registry's, not a second drift-prone copy.
 */
export const CMS_LOCALE_MAX_CHARACTERS = 35;
export const Bcp47Schema = CmsLocaleSchema.max(CMS_LOCALE_MAX_CHARACTERS);

/**
 * BE03b `JsonPointer`: a leading slash plus 1-256 non-control characters.
 * The spec regex carries no `u` flag, so its 0-255 bound counts JS UTF-16
 * code units rather than code points -- an astral character (surrogate pair)
 * consumes two units. The control-character exclusion is an explicit UTF-16
 * scan instead of the spec's literal character-class regex because the
 * repository lint bans control-character regexes; the accepted grammar is
 * otherwise identical (C0 only; the spec does not exclude C1 or DEL).
 */
const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
};

export const JsonPointerSchema = z
  .string()
  .refine(
    (value) => value.startsWith('/') && !hasControlCharacter(value),
    'json_pointer_invalid',
  )
  .refine((value) => value.length <= 256, 'json_pointer_max');

/** BE03b `jsonDepth`: counts container nesting, never scalar leaves. */
export const cmsEditorialJsonDepth = (value: unknown): number => {
  if (Array.isArray(value))
    return 1 + Math.max(0, ...value.map(cmsEditorialJsonDepth));
  if (value !== null && typeof value === 'object')
    return (
      1 +
      Math.max(
        0,
        ...Object.values(value as Record<string, unknown>).map(
          cmsEditorialJsonDepth,
        ),
      )
    );
  return 0;
};

const FIELD_POINTER_PREFIX = '/fields/';

/**
 * BE03b "Pointers" (normative): a command addresses a field as
 * `/fields/{stableFieldId}` for every field kind (a relation is a field), where
 * the id is a lowercase UUID, so the pointer is at most 44 characters. A
 * `/blocks/...` or any other pointer is refused by CMS-03B-01 and CMS-03B-10
 * until a composition write path exists, exactly as the database refuses it
 * (`^/fields/<lowercase uuid>$`), so the proxy and Worker never accept a shape
 * SQL will reject.
 */
export const FieldPointerSchema = z.string().refine((value) => {
  if (!value.startsWith(FIELD_POINTER_PREFIX)) return false;
  const id = value.slice(FIELD_POINTER_PREFIX.length);
  return id === id.toLowerCase() && CmsUuidSchema.safeParse(id).success;
}, 'field_pointer_invalid');

/** The stable field id a validated field pointer names. */
export const fieldIdOfPointer = (pointer: string): string =>
  pointer.slice(FIELD_POINTER_PREFIX.length);

/** BE03b `ChangedPaths`: 1-128 unique `/fields/{stableFieldId}` pointers. */
export const ChangedPathsSchema = z
  .array(FieldPointerSchema)
  .min(1, 'changed_paths_min')
  .max(128, 'changed_paths_max')
  .superRefine((paths, context) => {
    if (new Set(paths).size !== paths.length)
      context.addIssue({
        code: 'custom',
        message: 'changed_paths_must_be_unique',
      });
  })
  .readonly();

/** BE03b `BoundedEntryValues`: UUID-keyed JSON within 128 keys/8 levels/256 KiB. */
export const BoundedEntryValuesSchema = z
  .record(CmsUuidSchema, JsonValueSchema)
  .superRefine((values, context) => {
    if (Object.keys(values).length > 128)
      context.addIssue({ code: 'custom', message: 'entry_values_max_keys' });
    if (cmsEditorialJsonDepth(values) > 8)
      context.addIssue({ code: 'custom', message: 'entry_values_json_depth' });
    if (
      new TextEncoder().encode(JSON.stringify(values)).byteLength >
      JSON_VALUE_MAX_BYTES
    )
      context.addIssue({ code: 'custom', message: 'entry_values_max_bytes' });
  })
  .readonly();

export type Bcp47 = z.infer<typeof Bcp47Schema>;
export type JsonPointer = z.infer<typeof JsonPointerSchema>;
