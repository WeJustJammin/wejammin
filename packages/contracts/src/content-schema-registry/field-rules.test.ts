import { describe, expect, it } from 'vitest';

import {
  CMS_CAPABILITY_KEY_PATTERN,
  CMS_FIELD_KEY_PATTERN,
  CMS_HASH_PATTERN,
  CMS_PROJECTION_KEY_PATTERN,
  CMS_TARGET_TYPE_PATTERN,
  CMS_TYPE_KEY_PATTERN,
  CMS_UUID_PATTERN,
  CMS_VALIDATOR_KEY_PATTERN,
  CMS_WORKFLOW_KEY_PATTERN,
  CMS_LABEL_MAX_CHARACTERS,
  CmsCapabilityKeySchema,
  CmsFieldKeySchema,
  CmsHashSchema,
  CmsLabelSchema,
  CmsProjectionKeySchema,
  CmsTargetTypeSchema,
  CmsTypeKeySchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsVersionSchema,
  CmsWorkflowKeySchema,
  cmsLabelCharacters,
  isCmsLabel,
  isCmsVersion,
} from './primitives.ts';

/**
 * The zod-free syntax rules the browser forms use for blur feedback must give
 * the same verdict as the generated request schemas for every value.
 */

const KEYS = [
  'a',
  'ab',
  'release_note',
  'Release_Note',
  'release-note',
  'release.note',
  '1release',
  '_release',
  'a'.repeat(64),
  'a'.repeat(65),
  'a'.repeat(96),
  'a'.repeat(97),
  'a'.repeat(128),
  'a'.repeat(129),
  'cms.schema_designer',
  'cms.schema-designer',
  'with space',
  '',
  'é',
];

const UUIDS = [
  '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
  '018F0C45-73FE-7DC2-9C09-68F7ECF132DA',
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '018f0c45-73fe-0dc2-9c09-68f7ecf132da',
  '018f0c45-73fe-7dc2-7c09-68f7ecf132da',
  '018f0c45-73fe-7dc2-9c09-68f7ecf132d',
  'not-a-uuid',
  '',
];

const VERSIONS = [
  '1',
  '0',
  '01',
  '9223372036854775807',
  '9223372036854775808',
  '99999999999999999999',
  '-1',
  '1.5',
  ' 1',
  '',
];

const LABELS = [
  'ab',
  'a',
  '',
  ' ab ',
  ' a ',
  'a'.repeat(CMS_LABEL_MAX_CHARACTERS),
  'a'.repeat(CMS_LABEL_MAX_CHARACTERS + 1),
  'é'.repeat(CMS_LABEL_MAX_CHARACTERS),
  'é'.repeat(CMS_LABEL_MAX_CHARACTERS),
  'é'.repeat(CMS_LABEL_MAX_CHARACTERS + 1),
  '😀😀',
  '😀',
  'a'.repeat(CMS_LABEL_MAX_CHARACTERS * 8 + 1),
];

const verdict =
  (schema: { safeParse: (v: unknown) => { success: boolean } }) =>
  (value: string): boolean =>
    schema.safeParse(value).success;

describe('[P2-S09-AC-248] registry field syntax rules agree with the generated request schemas', () => {
  it.each([
    ['type key', CMS_TYPE_KEY_PATTERN, CmsTypeKeySchema],
    ['field key', CMS_FIELD_KEY_PATTERN, CmsFieldKeySchema],
    ['capability key', CMS_CAPABILITY_KEY_PATTERN, CmsCapabilityKeySchema],
    ['projection key', CMS_PROJECTION_KEY_PATTERN, CmsProjectionKeySchema],
    ['validator key', CMS_VALIDATOR_KEY_PATTERN, CmsValidatorKeySchema],
    ['workflow key', CMS_WORKFLOW_KEY_PATTERN, CmsWorkflowKeySchema],
    ['target type', CMS_TARGET_TYPE_PATTERN, CmsTargetTypeSchema],
  ] as const)('[P2-S09-AC-248] %s', (_name, pattern, schema) => {
    for (const value of KEYS)
      expect(pattern.test(value), JSON.stringify(value)).toBe(
        verdict(schema)(value),
      );
  });

  it('[P2-S09-AC-248] uuid', () => {
    for (const value of UUIDS)
      expect(CMS_UUID_PATTERN.test(value), value).toBe(
        verdict(CmsUuidSchema)(value),
      );
  });

  it('[P2-S09-AC-248] hash', () => {
    for (const value of [
      'a'.repeat(64),
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      '',
    ])
      expect(CMS_HASH_PATTERN.test(value)).toBe(verdict(CmsHashSchema)(value));
  });

  it('[P2-S09-AC-248] version, including the signed 64-bit bound', () => {
    for (const value of VERSIONS)
      expect(isCmsVersion(value), value).toBe(verdict(CmsVersionSchema)(value));
    expect(isCmsVersion('9223372036854775807')).toBe(true);
    expect(isCmsVersion('9223372036854775808')).toBe(false);
  });

  it('[P2-S09-AC-248] label length after NFC and trim', () => {
    for (const value of LABELS)
      expect(isCmsLabel(value), JSON.stringify(value.slice(0, 12))).toBe(
        verdict(CmsLabelSchema)(value),
      );
    expect(cmsLabelCharacters(' é ')).toBe(1);
  });
});
