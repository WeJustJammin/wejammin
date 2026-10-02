import { describe, expect, it } from 'vitest';

import { TemplateVersionDetailSchema } from './index';

const typeId = '123e4567-e89b-42d3-a456-426614174000';
const detail = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: 'profile-header',
  templateVersion: 2,
  compatibleTypeIds: [typeId],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'b'.repeat(64),
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
} as const;

describe('CMS-11 protected latest-template detail contract', () => {
  it('returns a complete editable definition with a strong current version', () => {
    expect(TemplateVersionDetailSchema.parse(detail)).toEqual(detail);
    expect(
      TemplateVersionDetailSchema.safeParse({ ...detail, ownerId: typeId })
        .success,
    ).toBe(false);
  });

  it('rejects hidden renderer data and malformed editable fields', () => {
    expect(
      TemplateVersionDetailSchema.safeParse({
        ...detail,
        slots: [{ ...detail.slots[0], rendererRef: 'secret' }],
      }).success,
    ).toBe(false);
    expect(
      TemplateVersionDetailSchema.safeParse({ ...detail, audience: '<script>' })
        .success,
    ).toBe(false);
    expect(
      TemplateVersionDetailSchema.safeParse({ ...detail, templateVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      TemplateVersionDetailSchema.safeParse({
        ...detail,
        compatibleTypeIds: [],
      }).success,
    ).toBe(false);
    expect(
      TemplateVersionDetailSchema.safeParse({
        ...detail,
        reservedRegions: ['now', 'header', 'record', 'detail', 'provenance'],
      }).success,
    ).toBe(false);
  });
});
