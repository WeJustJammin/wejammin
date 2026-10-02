import { describe, expect, it } from 'vitest';

import {
  CmsArtifactRefSchema,
  CmsBlockKeySchema,
  CmsCapabilityKeySchema,
  CmsFieldKeySchema,
  CmsHashSchema,
  CmsLocaleSchema,
  CmsProjectionKeySchema,
  CmsReleaseKeyIdSchema,
  CmsRendererRefSchema,
  CmsTargetTypeSchema,
  CmsTypeKeySchema,
  CmsUuidSchema,
  CmsValidatorKeySchema,
  CmsVersionSchema,
  CmsWorkflowKeySchema,
  isCanonicalPaddedBase64,
} from './primitives';

describe('content schema registry primitive boundaries', () => {
  it('covers every canonical Base64 padding shape', () => {
    expect(isCanonicalPaddedBase64('')).toBe(false);
    expect(isCanonicalPaddedBase64('A')).toBe(false);
    expect(isCanonicalPaddedBase64('QUJD')).toBe(true);
    expect(isCanonicalPaddedBase64('QUI=')).toBe(true);
    expect(isCanonicalPaddedBase64('QUJ=')).toBe(false);
    expect(isCanonicalPaddedBase64('QQ==')).toBe(true);
    expect(isCanonicalPaddedBase64('QS==')).toBe(false);
    expect(isCanonicalPaddedBase64('AA=A')).toBe(false);
    expect(isCanonicalPaddedBase64('====')).toBe(false);
  });

  it('accepts valid identifiers and rejects grammar violations', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    const hash = 'a'.repeat(64);
    expect(CmsUuidSchema.parse(uuid)).toBe(uuid);
    expect(CmsVersionSchema.parse('9223372036854775807')).toBe(
      '9223372036854775807',
    );
    expect(CmsHashSchema.parse(hash)).toBe(hash);
    expect(CmsTypeKeySchema.parse('release_notes')).toBe('release_notes');
    expect(CmsFieldKeySchema.parse('display_name')).toBe('display_name');
    expect(CmsBlockKeySchema.parse('cms.hero-v1')).toBe('cms.hero-v1');
    expect(CmsCapabilityKeySchema.parse('cms.schema.read')).toBe(
      'cms.schema.read',
    );
    expect(CmsProjectionKeySchema.parse('cms.article.card')).toBe(
      'cms.article.card',
    );
    expect(CmsValidatorKeySchema.parse('cms.slug')).toBe('cms.slug');
    expect(CmsWorkflowKeySchema.parse('cms.standard')).toBe('cms.standard');
    expect(CmsTargetTypeSchema.parse('content_type')).toBe('content_type');
    expect(CmsLocaleSchema.parse('en-US')).toBe('en-US');
    expect(CmsArtifactRefSchema.parse('schemas/content-v1.json')).toBe(
      'schemas/content-v1.json',
    );
    expect(CmsRendererRefSchema.parse('renderers/cms.hero.v1')).toBe(
      'renderers/cms.hero.v1',
    );
    expect(CmsReleaseKeyIdSchema.parse('release-key-v1')).toBe(
      'release-key-v1',
    );
  });

  it('rejects malformed values without coercion', () => {
    const invalidBySchema = [
      [CmsUuidSchema, 'not-a-uuid'],
      [CmsVersionSchema, '0'],
      [CmsVersionSchema, '1.5'],
      [CmsVersionSchema, 'abc'],
      [CmsVersionSchema, '9223372036854775808'],
      [CmsHashSchema, 'a'.repeat(63)],
      [CmsTypeKeySchema, 'ReleaseNotes'],
      [CmsFieldKeySchema, 'display-name'],
      [CmsBlockKeySchema, 'CMS.hero'],
      [CmsCapabilityKeySchema, 'cms schema read'],
      [CmsProjectionKeySchema, 'cms//article'],
      [CmsValidatorKeySchema, 'cms/slug'],
      [CmsWorkflowKeySchema, 'cms/workflow'],
      [CmsTargetTypeSchema, 'ContentType'],
      [CmsLocaleSchema, 'en_US'],
      [CmsArtifactRefSchema, 'schemas/../secret'],
      [CmsRendererRefSchema, 'renderers//hero'],
      [CmsReleaseKeyIdSchema, 'Release-key-v1'],
    ] as const;
    for (const [schema, value] of invalidBySchema)
      expect(schema.safeParse(value).success).toBe(false);
    expect(CmsVersionSchema.safeParse(1).success).toBe(false);
  });
});
