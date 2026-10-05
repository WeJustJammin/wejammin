import { describe, expect, it } from 'vitest';

import {
  CmsTemplateKeySchema,
  TemplateDesignerContextSchema,
  TemplateVersionHeadersSchema,
  TemplateVersionRequestSchema,
  TemplateVersionResourceSchema,
} from './index';

const typeId = '123e4567-e89b-42d3-a456-426614174000';
const templateId = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);

const request = {
  templateKey: 'profile-header',
  compatibleTypeIds: [typeId],
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
  blockRegistryDigest: hash,
  expectedVersion: null,
} as const;

const resource = {
  id: templateId,
  version: '1',
  contentHash: hash,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: 'profile-header',
  templateVersion: 1,
  compatibleTypeIds: [typeId],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: hash,
} as const;

const rejectedAt = (candidate: unknown, path: string): void => {
  const parsed = TemplateVersionRequestSchema.safeParse(candidate);
  expect(parsed.success).toBe(false);
  if (!parsed.success)
    expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toContain(
      path,
    );
};

describe('CMS-03C-01 template definition contracts', () => {
  it('accepts only a bounded, disclosure-safe designer context', () => {
    const context = {
      contentTypes: [
        {
          id: typeId,
          typeKey: 'profile',
          activeVersionId: templateId,
          activeVersion: 1,
          sourceLocale: 'en-US',
        },
      ],
      registeredBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
    };
    expect(TemplateDesignerContextSchema.parse(context)).toEqual(context);
    expect(
      TemplateDesignerContextSchema.safeParse({ ...context, ownerId: typeId })
        .success,
    ).toBe(false);
    expect(
      TemplateDesignerContextSchema.safeParse({
        ...context,
        registeredBlocks: [
          { ...context.registeredBlocks[0], rendererRef: 'private' },
        ],
      }).success,
    ).toBe(false);
    expect(
      TemplateDesignerContextSchema.safeParse({
        ...context,
        contentTypes: Array(65).fill(context.contentTypes[0]),
      }).success,
    ).toBe(false);
  });
  it('accepts the exact bounded draft request and resource without browser authority fields', () => {
    expect(TemplateVersionRequestSchema.parse(request)).toEqual(request);
    expect(TemplateVersionResourceSchema.parse(resource)).toEqual(resource);
    expect(
      TemplateVersionResourceSchema.safeParse({
        ...resource,
        ownerId: typeId,
      }).success,
    ).toBe(false);
  });

  it('enforces immutable template-key grammar and a positive version field', () => {
    expect(CmsTemplateKeySchema.parse('a-')).toBe('a-');
    expect(CmsTemplateKeySchema.safeParse('a').success).toBe(false);
    expect(CmsTemplateKeySchema.safeParse('Profile_Header').success).toBe(
      false,
    );
    rejectedAt({ ...request, templateKey: 'bad_key' }, 'templateKey');
    rejectedAt({ ...request, expectedVersion: '0' }, 'expectedVersion');
    expect(
      TemplateVersionResourceSchema.safeParse({
        ...resource,
        templateVersion: 0,
      }).success,
    ).toBe(false);
  });

  it('bounds compatible content-type identities and rejects malformed IDs', () => {
    rejectedAt({ ...request, compatibleTypeIds: [] }, 'compatibleTypeIds');
    rejectedAt(
      { ...request, compatibleTypeIds: Array(65).fill(typeId) },
      'compatibleTypeIds',
    );
    rejectedAt(
      { ...request, compatibleTypeIds: ['not-a-uuid'] },
      'compatibleTypeIds.0',
    );
    rejectedAt(
      { ...request, compatibleTypeIds: [typeId, typeId] },
      'compatibleTypeIds',
    );
    rejectedAt(
      { ...request, compatibleTypeIds: [typeId, typeId.toUpperCase()] },
      'compatibleTypeIds',
    );
  });

  it('rejects off-grammar blocks, invalid versions, slot overflow, and unknown slot keys', () => {
    rejectedAt(
      {
        ...request,
        slots: [
          {
            ...request.slots[0],
            allowedBlocks: [{ blockKey: 'Bad', blockVersion: 1 }],
          },
        ],
      },
      'slots.0.allowedBlocks.0.blockKey',
    );
    rejectedAt(
      {
        ...request,
        slots: [
          {
            ...request.slots[0],
            allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 0 }],
          },
        ],
      },
      'slots.0.allowedBlocks.0.blockVersion',
    );
    rejectedAt(
      { ...request, slots: Array(65).fill(request.slots[0]) },
      'slots',
    );
    expect(
      TemplateVersionRequestSchema.safeParse({
        ...request,
        slots: [{ ...request.slots[0], script: 'alert(1)' }],
      }).success,
    ).toBe(false);
    rejectedAt(
      { ...request, slots: [request.slots[0], request.slots[0]] },
      'slots.1.key',
    );
    rejectedAt(
      {
        ...request,
        slots: [
          {
            ...request.slots[0],
            allowedBlocks: [
              request.slots[0].allowedBlocks[0],
              request.slots[0].allowedBlocks[0],
            ],
          },
        ],
      },
      'slots.0.allowedBlocks.1',
    );
  });

  it('bounds reserved regions and strict projection bindings', () => {
    rejectedAt(
      { ...request, reservedRegions: Array(33).fill('header') },
      'reservedRegions',
    );
    rejectedAt(
      { ...request, reservedRegions: ['header', 'now', 'record', 'detail'] },
      'reservedRegions',
    );
    rejectedAt(
      {
        ...request,
        reservedRegions: ['now', 'header', 'record', 'detail', 'provenance'],
      },
      'reservedRegions.0',
    );
    rejectedAt(
      {
        ...request,
        reservedRegions: [
          'header',
          'now',
          'record',
          'detail',
          'provenance',
          'header',
        ],
      },
      'reservedRegions.5',
    );
    rejectedAt(
      {
        ...request,
        bindings: { title: { projection: 'bad/uri', required: true } },
      },
      'bindings.title.projection',
    );
    expect(
      TemplateVersionRequestSchema.safeParse({
        ...request,
        bindings: {
          title: {
            projection: 'profile.title',
            required: true,
            authority: 'admin',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('enforces locale, safe audience, and a lowercase optional registry digest', () => {
    rejectedAt({ ...request, locale: 'invalid_locale' }, 'locale');
    rejectedAt({ ...request, audience: '<script>' }, 'audience');
    rejectedAt(
      { ...request, blockRegistryDigest: 'A'.repeat(64) },
      'blockRegistryDigest',
    );
    const { blockRegistryDigest: _expectation, ...withoutExpectation } =
      request;
    void _expectation;
    expect(TemplateVersionRequestSchema.parse(withoutExpectation)).toEqual(
      withoutExpectation,
    );
  });

  it('rejects unexpected request or resource fields and unknown resource states', () => {
    expect(
      TemplateVersionRequestSchema.safeParse({
        ...request,
        ownerId: typeId,
      }).success,
    ).toBe(false);
    expect(
      TemplateVersionResourceSchema.safeParse({
        ...resource,
        state: 'published',
      }).success,
    ).toBe(false);
  });

  it('requires JSON and a bounded idempotency key, with only an exact strong If-Match for updates', () => {
    const headers = {
      contentType: 'application/json',
      idempotencyKey: 's12-template-0001',
    };
    expect(TemplateVersionHeadersSchema.safeParse(headers).success).toBe(true);
    expect(
      TemplateVersionHeadersSchema.safeParse({
        ...headers,
        ifMatch: '"2"',
      }).success,
    ).toBe(true);
    expect(
      TemplateVersionHeadersSchema.safeParse({ ...headers, ifMatch: 'W/"2"' })
        .success,
    ).toBe(false);
    expect(
      TemplateVersionHeadersSchema.safeParse({ ...headers, ifMatch: '2' })
        .success,
    ).toBe(false);
    expect(
      TemplateVersionHeadersSchema.safeParse({
        ...headers,
        actorId: typeId,
      }).success,
    ).toBe(false);
  });
});
