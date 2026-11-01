import { describe, expect, it } from 'vitest';

import {
  TemplateLatestApiRequestSchema,
  TemplateVersionDetailSchema,
} from './index';

const typeId = '123e4567-e89b-42d3-a456-426614174000';
const detail = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateId: '123e4567-e89b-42d3-a456-426614174002',
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

describe('cmsTemplateLatestRead path contract', () => {
  it('[P2-S12-AC-166] accepts only a grammar-valid, non-reserved path templateKey and no other member', () => {
    expect(
      TemplateLatestApiRequestSchema.parse({ templateKey: 'profile-header' }),
    ).toEqual({ templateKey: 'profile-header' });
    for (const candidate of [
      { templateKey: 'context' },
      { templateKey: 'versions' },
      { templateKey: 'new' },
      { templateKey: 'Bad_Key' },
      { templateKey: '' },
      { templateKey: 'a' },
      { templateKey: 'profile-header', ownerId: 'x' },
      {},
    ])
      expect(TemplateLatestApiRequestSchema.safeParse(candidate).success).toBe(
        false,
      );
  });

  it('[P2-S12-AC-165] requires the lineage templateId on the editable detail', () => {
    const { templateId: _omitted, ...withoutLineage } = detail;
    void _omitted;
    expect(TemplateVersionDetailSchema.safeParse(withoutLineage).success).toBe(
      false,
    );
  });
});
