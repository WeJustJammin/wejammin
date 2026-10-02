import { describe, expect, it } from 'vitest';

import {
  TemplateCompatibilityFailureCodeSchema,
  TemplateCompatibilityFailureSchema,
  TemplateCompatibilityProjectionSchema,
  TemplateCompatibilityRequestSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const request = {
  templateVersionId: uuid,
  contentTypeId: uuid2,
  contentTypeVersionId: uuid3,
} as const;
const projection = {
  templateVersionId: uuid,
  templateKey: 'profile.header',
  templateVersionNo: '2',
  state: 'active',
  compatible: true,
  withdrawn: false,
  templateDigest: 'a'.repeat(64),
  contentTypeId: uuid2,
  contentTypeVersionId: uuid3,
} as const;

describe('named template compatibility resolver contract (DEC-108)', () => {
  it('accepts the exact candidate version reference with an optional version assertion', () => {
    expect(TemplateCompatibilityRequestSchema.parse(request)).toEqual(request);
    expect(
      TemplateCompatibilityRequestSchema.parse({
        ...request,
        expectedTemplateVersionNo: '2',
      }).expectedTemplateVersionNo,
    ).toBe('2');
  });

  it('never resolves a current version implicitly or accepts extra authority', () => {
    for (const missing of [
      'templateVersionId',
      'contentTypeId',
      'contentTypeVersionId',
    ] as const) {
      const rest: Record<string, string> = { ...request };
      delete rest[missing];
      expect(TemplateCompatibilityRequestSchema.safeParse(rest).success).toBe(
        false,
      );
    }
    expect(
      TemplateCompatibilityRequestSchema.safeParse({
        ...request,
        ownerId: uuid,
      }).success,
    ).toBe(false);
    expect(
      TemplateCompatibilityRequestSchema.safeParse({
        ...request,
        expectedTemplateVersionNo: '0',
      }).success,
    ).toBe(false);
  });

  it('returns only the safe projection with the literal compatible invariant', () => {
    expect(TemplateCompatibilityProjectionSchema.parse(projection)).toEqual(
      projection,
    );
    for (const state of [
      'draft',
      'review',
      'approved',
      'scheduled',
      'active',
      'superseded',
      'retired',
    ])
      expect(
        TemplateCompatibilityProjectionSchema.safeParse({
          ...projection,
          state,
        }).success,
      ).toBe(true);
    for (const bad of [
      { compatible: false },
      { withdrawn: true },
      { state: 'blocked' },
      { templateKey: 'Profile Header' },
      { templateDigest: 'A'.repeat(64) },
      { templateVersionNo: '0' },
      { ownerId: uuid },
      { rendererRef: 'secret' },
    ])
      expect(
        TemplateCompatibilityProjectionSchema.safeParse({
          ...projection,
          ...bad,
        }).success,
      ).toBe(false);
  });

  it('types the four failure codes and nothing else', () => {
    expect(TemplateCompatibilityFailureCodeSchema.options).toEqual([
      'NOT_FOUND',
      'INCOMPATIBLE',
      'WITHDRAWN',
      'VERSION_MISMATCH',
    ]);
    for (const code of TemplateCompatibilityFailureCodeSchema.options)
      expect(TemplateCompatibilityFailureSchema.parse({ code })).toEqual({
        code,
      });
    expect(
      TemplateCompatibilityFailureSchema.safeParse({ code: 'SOFT_FAIL' })
        .success,
    ).toBe(false);
    expect(
      TemplateCompatibilityFailureSchema.safeParse({
        code: 'NOT_FOUND',
        compatible: false,
      }).success,
    ).toBe(false);
  });
});
