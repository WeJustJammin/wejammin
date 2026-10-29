import { describe, expect, it } from 'vitest';

import {
  TemplateVersionDetailSchema,
  TemplateVersionRequestSchema,
  TemplateVersionResourceSchema,
} from './index';

/**
 * [P2-S12-AC-001] "accessibility contracts in templates". A template keeps a block's accessibility
 * contract because it references exact immutable block versions (`blockKey` + `blockVersion`) and its
 * strict CMS-03C-01 definition has no member that could state or override one: every object of the
 * definition is closed, so an `accessibility` member (or any unknown member) is refused wherever it
 * is put. The block's own accessibility contract is registered with the signed block version (IA03
 * AC-CMS-10) and is the only one a template can reach.
 */
const typeId = '123e4567-e89b-42d3-a456-426614174000';
const hash = 'a'.repeat(64);

const definition = {
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
};

const MEMBERS = ['accessibility', 'accessibilityManifest', 'ariaLabel'];

/** Places `member` in each object of the definition the person controls; returns where it went. */
const placements = (member: string) =>
  [
    {
      where: 'the definition',
      parent: [],
      body: { ...definition, [member]: { role: 'region' } },
    },
    {
      where: 'a slot',
      parent: ['slots', 0],
      body: {
        ...definition,
        slots: [{ ...definition.slots[0], [member]: { role: 'region' } }],
      },
    },
    {
      where: 'an allowed block reference',
      parent: ['slots', 0, 'allowedBlocks', 0],
      body: {
        ...definition,
        slots: [
          {
            ...definition.slots[0],
            allowedBlocks: [
              {
                blockKey: 'profile.header',
                blockVersion: 1,
                [member]: { role: 'region' },
              },
            ],
          },
        ],
      },
    },
    {
      where: 'a binding',
      parent: ['bindings', 'title'],
      body: {
        ...definition,
        bindings: {
          title: {
            projection: 'profile.title',
            required: true,
            [member]: { role: 'region' },
          },
        },
      },
    },
  ] as const;

describe('CMS-03C-01 definition carries no accessibility member', () => {
  it('[P2-S12-AC-001] accepts the definition without any accessibility member (control)', () => {
    expect(TemplateVersionRequestSchema.safeParse(definition).success).toBe(
      true,
    );
  });

  describe.each(MEMBERS)('the member %s', (member) => {
    it.each(placements(member))(
      '[P2-S12-AC-001] is refused as an unrecognized key in $where',
      ({ parent, body }) => {
        const parsed = TemplateVersionRequestSchema.safeParse(body);
        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(
          parsed.error.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            keys: 'keys' in issue ? issue.keys : undefined,
          })),
        ).toEqual([
          { code: 'unrecognized_keys', path: parent, keys: [member] },
        ]);
      },
    );
  });

  it('[P2-S12-AC-001] a block reference names only the immutable pair, so the contract it points at is the registered one', () => {
    const reference =
      TemplateVersionRequestSchema.shape.slots.element.shape.allowedBlocks
        .element;
    expect(Object.keys(reference.shape).sort()).toEqual([
      'blockKey',
      'blockVersion',
    ]);
    expect(
      reference.safeParse({ blockKey: 'profile.header', blockVersion: 0 })
        .success,
    ).toBe(false);
    expect(reference.safeParse({ blockKey: 'profile.header' }).success).toBe(
      false,
    );
  });

  it('[P2-S12-AC-001] the stored version and the editable detail are closed too, so no accessibility member is ever read back', () => {
    const resource = {
      id: '123e4567-e89b-42d3-a456-426614174001',
      version: '1',
      contentHash: hash,
      createdAt: '2026-09-27T12:00:00Z',
      updatedAt: '2026-09-27T12:00:00Z',
      state: 'draft',
      templateId: '123e4567-e89b-42d3-a456-426614174002',
      templateKey: 'profile-header',
      templateVersion: 1,
      compatibleTypeIds: [typeId],
      reservedRegions: definition.reservedRegions,
      blockRegistryDigest: hash,
    };
    expect(TemplateVersionResourceSchema.safeParse(resource).success).toBe(
      true,
    );
    expect(
      TemplateVersionResourceSchema.safeParse({
        ...resource,
        accessibility: {},
      }).success,
    ).toBe(false);
    const detail = {
      ...resource,
      slots: definition.slots,
      bindings: definition.bindings,
      locale: 'en-US',
      audience: 'public',
    };
    expect(TemplateVersionDetailSchema.safeParse(detail).success).toBe(true);
    expect(
      TemplateVersionDetailSchema.safeParse({ ...detail, accessibility: {} })
        .success,
    ).toBe(false);
  });
});
