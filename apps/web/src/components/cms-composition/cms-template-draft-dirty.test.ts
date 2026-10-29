import { describe, expect, it } from 'vitest';

import type { CmsTemplateDraftFields } from './cms-template-designer-request';
import { cmsTemplateDraftDirty } from './cms-template-draft-dirty';

/** [P2-S12-AC-042] FE03 927 "Unsaved changes": unsent work is a difference from the confirmed preimage. */
const original: CmsTemplateDraftFields = {
  templateKey: 'release-note',
  compatibleTypeIds: ['a', 'b'],
  locale: 'en-US',
  audience: 'public',
  extraRegions: 'aside',
  slots: [
    { key: 'main', required: true, maxCount: '3', allowedBlockRefs: ['x@1'] },
  ],
  bindings: [{ key: 'title', projection: 'headline', required: false }],
};

describe('cmsTemplateDraftDirty', () => {
  it('[P2-S12-AC-042] is clean for an identical copy, whatever the order of the content-type set and the row ui ids', () => {
    expect(
      cmsTemplateDraftDirty(
        {
          ...original,
          compatibleTypeIds: ['b', 'a'],
          slots: [{ ...original.slots[0]!, uiId: 'row-7' } as never],
          bindings: [{ ...original.bindings[0]!, uiId: 'row-8' } as never],
        },
        original,
      ),
    ).toBe(false);
  });

  it.each([
    ['templateKey', { templateKey: 'other' }],
    ['compatibleTypeIds', { compatibleTypeIds: ['a'] }],
    ['locale', { locale: 'fr-FR' }],
    ['audience', { audience: 'members' }],
    ['extraRegions', { extraRegions: '' }],
    ['a slot key', { slots: [{ ...original.slots[0]!, key: 'side' }] }],
    [
      'a slot required flag',
      { slots: [{ ...original.slots[0]!, required: false }] },
    ],
    ['a slot maxCount', { slots: [{ ...original.slots[0]!, maxCount: '4' }] }],
    [
      'a slot block list',
      { slots: [{ ...original.slots[0]!, allowedBlockRefs: [] }] },
    ],
    ['a removed slot', { slots: [] }],
    ['a binding key', { bindings: [{ ...original.bindings[0]!, key: 'sub' }] }],
    [
      'a binding projection',
      { bindings: [{ ...original.bindings[0]!, projection: 'x' }] },
    ],
    [
      'a binding required flag',
      { bindings: [{ ...original.bindings[0]!, required: true }] },
    ],
    ['a removed binding', { bindings: [] }],
  ] as const)('[P2-S12-AC-042] is dirty for %s', (_name, change) => {
    expect(cmsTemplateDraftDirty({ ...original, ...change }, original)).toBe(
      true,
    );
  });
});
