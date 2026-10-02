import { z } from 'zod';

import { JSON_VALUE_MAX_BYTES, JsonValueSchema } from '../api-error.ts';
import {
  CmsLocaleSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';

/**
 * BE03b `Bcp47`.  The registry locks the identical grammar, so this is a
 * re-export instead of a second, drift-prone copy.
 */
export const Bcp47Schema = CmsLocaleSchema;

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

/** BE03b `ChangedPaths`: 1-128 unique JSON Pointers. */
export const ChangedPathsSchema = z
  .array(JsonPointerSchema)
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
