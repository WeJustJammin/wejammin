import { describe, expect, it } from 'vitest';

import {
  CMS_KEY_RESERVED_REASON,
  TemplateVersionApiRequestSchema,
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

const lineageId = '123e4567-e89b-42d3-a456-426614174002';
const resource = {
  id: templateId,
  version: '1',
  contentHash: hash,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateId: lineageId,
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

describe('CMS-03C-01 template keys, audience and lineage (E13, E4)', () => {
  it('[P2-S12-AC-189] refuses a reserved templateKey at /templateKey with the key_reserved reason', () => {
    for (const templateKey of ['context', 'versions', 'new']) {
      const parsed = TemplateVersionRequestSchema.safeParse({
        ...request,
        templateKey,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues).toHaveLength(1);
        expect(parsed.error.issues[0]?.path).toEqual(['templateKey']);
        expect(parsed.error.issues[0]?.message).toBe(CMS_KEY_RESERVED_REASON);
      }
    }
    // `selector` is a reserved pattern key only; a template may use it.
    expect(
      TemplateVersionRequestSchema.safeParse({
        ...request,
        templateKey: 'selector',
      }).success,
    ).toBe(true);
    expect(
      TemplateVersionResourceSchema.safeParse({
        ...resource,
        templateKey: 'context',
      }).success,
    ).toBe(false);
  });

  it('[P2-S12-AC-025] enforces the BE04c audience grammar ^[a-z0-9_-]{1,48}$ as submitted, never trimmed', () => {
    for (const audience of [
      'public',
      'a',
      'members_only',
      'tier-2',
      '0',
      'a'.repeat(48),
    ])
      expect(
        TemplateVersionRequestSchema.safeParse({ ...request, audience })
          .success,
      ).toBe(true);
    for (const audience of [
      '',
      'Members',
      ' public',
      'public ',
      'a b',
      'a.b',
      'a'.repeat(49),
      '<script>',
      'pub\nlic',
    ])
      rejectedAt({ ...request, audience }, 'audience');
  });

  it('[P2-S12-AC-191] carries the stable lineage templateId on the resource and requires it', () => {
    expect(TemplateVersionResourceSchema.parse(resource).templateId).toBe(
      lineageId,
    );
    const { templateId: _omitted, ...withoutLineage } = resource;
    void _omitted;
    expect(
      TemplateVersionResourceSchema.safeParse(withoutLineage).success,
    ).toBe(false);
    expect(
      TemplateVersionResourceSchema.safeParse({
        ...resource,
        templateId: 'not-a-uuid',
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03C-01 If-Match operand', () => {
  const headers = {
    contentType: 'application/json',
    idempotencyKey: 's12-template-0001',
  };

  it('[P2-S12-AC-007] omits If-Match on a first version and ties it to the parent version expectedVersion on a successor', () => {
    expect(
      TemplateVersionApiRequestSchema.safeParse({ headers, body: request })
        .success,
    ).toBe(true);
    const successor = { ...request, expectedVersion: '2' };
    expect(
      TemplateVersionApiRequestSchema.safeParse({
        headers: { ...headers, ifMatch: '"2"' },
        body: successor,
      }).success,
    ).toBe(true);
    for (const candidate of [
      { headers, body: successor },
      { headers: { ...headers, ifMatch: '"3"' }, body: successor },
      { headers: { ...headers, ifMatch: '"2"' }, body: request },
    ]) {
      const parsed = TemplateVersionApiRequestSchema.safeParse(candidate);
      expect(parsed.success).toBe(false);
      if (!parsed.success)
        expect(
          parsed.error.issues.map((issue) => issue.path.join('.')),
        ).toEqual(['headers.ifMatch']);
    }
  });
});
