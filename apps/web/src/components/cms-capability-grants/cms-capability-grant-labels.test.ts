import { describe, expect, it } from 'vitest';
import { GRANTABLE_CMS_CAPABILITIES } from '@wejammin/contracts';

import {
  CMS_CAPABILITY_GROUPS,
  capabilityLabel,
  capabilityOptionText,
} from './cms-capability-grant-labels';

/** FE03: a native select over the generated registry in four labelled groups. */

describe('capability groups', () => {
  it('[P2-S09-AC-1013] has the four FE03 groups in order', () => {
    expect(CMS_CAPABILITY_GROUPS.map((group) => group.label)).toStrictEqual([
      'Design',
      'Authoring',
      'Delivery and media',
      'Review',
    ]);
  });

  it('places every generated grantable capability in exactly one group', () => {
    const placed = CMS_CAPABILITY_GROUPS.flatMap((group) => group.capabilities);
    expect([...placed].sort()).toStrictEqual(
      [...GRANTABLE_CMS_CAPABILITIES].sort(),
    );
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('keeps the FE03 membership', () => {
    const byGroup = Object.fromEntries(
      CMS_CAPABILITY_GROUPS.map((group) => [group.label, group.capabilities]),
    );
    expect(byGroup.Design).toStrictEqual([
      'cms.schema_registry.read',
      'cms.schema_designer',
      'cms.template_designer',
      'cms.taxonomy_curator',
    ]);
    expect(byGroup.Authoring).toStrictEqual([
      'cms.author',
      'cms.editor',
      'cms.publisher',
    ]);
    expect(byGroup['Delivery and media']).toStrictEqual([
      'cms.navigation_editor',
      'cms.media_contributor',
      'cms.media_curator',
    ]);
    expect(byGroup.Review).toStrictEqual([
      'cms.reviewer',
      'cms.reviewer.policy',
      'cms.reviewer.legal',
      'cms.reviewer.security',
      'cms.reviewer.financial',
    ]);
  });
});

describe('capability labels', () => {
  it.each([
    ['cms.schema_registry.read', 'View schema registry'],
    ['cms.schema_designer', 'Design schemas'],
    ['cms.template_designer', 'Design templates'],
    ['cms.taxonomy_curator', 'Curate taxonomies'],
    ['cms.author', 'Author entries'],
    ['cms.editor', 'Edit and return entries'],
    ['cms.publisher', 'Publish entries'],
    ['cms.navigation_editor', 'Edit navigation and routes'],
    ['cms.media_contributor', 'Contribute media'],
    ['cms.media_curator', 'Curate media'],
    ['cms.reviewer', 'Review entries'],
  ] as const)('labels %s as "%s"', (key, label) => {
    expect(capabilityLabel(key)).toBe(label);
  });

  it('labels each specialist reviewer distinctly', () => {
    const labels = (['policy', 'legal', 'security', 'financial'] as const).map(
      (kind) => capabilityLabel(`cms.reviewer.${kind}`),
    );
    expect(new Set(labels).size).toBe(4);
    for (const label of labels) expect(label).toMatch(/specialist reviewer/iu);
  });

  it('[P2-S09-AC-1013] never makes the key the only text of an option', () => {
    for (const key of GRANTABLE_CMS_CAPABILITIES) {
      const text = capabilityOptionText(key);
      expect(text).toContain(capabilityLabel(key));
      expect(text).toContain(key);
      expect(capabilityLabel(key)).not.toBe(key);
    }
  });
});
