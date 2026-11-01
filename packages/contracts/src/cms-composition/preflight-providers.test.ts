import { describe, expect, it } from 'vitest';

import { CMS_PREFLIGHT_CATEGORIES } from '../cms-editorial/preflight-categories';
import { CMS_PREFLIGHT_REGISTRY } from '../cms-editorial/preflight';
import {
  CMS_LOCALE_NO_FALLBACK_GATE,
  CMS_LOCALE_NO_FALLBACK_REASONS,
} from './locale-resolution';
import { CMS_SLICE_12_PREFLIGHT_PROVIDERS } from './preflight-providers';

describe('Preflight providers registered by Slice 12 (BE03c)', () => {
  it('[P2-S12-AC-241] registers exactly the pattern, taxonomy and locale providers, each replacing a reference gate', () => {
    expect(
      CMS_SLICE_12_PREFLIGHT_PROVIDERS.map((row) => [
        row.category,
        row.providerKey,
        row.providerVersion,
        row.providerKind,
      ]),
    ).toEqual([
      ['pattern', 'cms.pattern.active_digest', '1', 'database'],
      ['taxonomy', 'cms.taxonomy.assignment_integrity', '1', 'database'],
      ['locale', 'cms.locale.no_fallback_gate', '1', 'database'],
    ]);
    for (const row of CMS_SLICE_12_PREFLIGHT_PROVIDERS) {
      expect(CMS_PREFLIGHT_CATEGORIES as readonly string[]).toContain(
        row.category,
      );
      expect(row.ownerSlice).toBe('03c');
    }
  });

  const EXPECTED_REASONS = [
    [
      'pattern',
      'P2-S12-AC-238',
      [
        'pattern_not_active',
        'pattern_digest_changed',
        'nested_pattern_not_active',
        'pattern_depth_exceeded',
        'pattern_nodes_exceeded',
        'pattern_block_rules_violated',
      ],
    ],
    [
      'taxonomy',
      'P2-S12-AC-239',
      [
        'term_merged_unconverged',
        'allowlist_changed',
        'taxonomy_version_not_active',
      ],
    ],
    ['locale', 'P2-S12-AC-240', [...CMS_LOCALE_NO_FALLBACK_REASONS]],
  ] as const;

  for (const [category, marker, reasons] of EXPECTED_REASONS)
    it(`[${marker}] closes the ${category} provider to its own failure reasons`, () => {
      const row = CMS_SLICE_12_PREFLIGHT_PROVIDERS.find(
        (provider) => provider.category === category,
      );
      expect([...(row?.reasonCodes ?? [])]).toEqual([...reasons]);
      for (const reason of reasons)
        expect(reason).toMatch(/^[a-z][a-z0-9_]{0,63}$/u);
    });

  it('[P2-S12-AC-241] gives no two providers a shared reason code', () => {
    const all = CMS_SLICE_12_PREFLIGHT_PROVIDERS.flatMap(
      (row) => row.reasonCodes,
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it('[P2-S12-AC-240] shares the locale gate descriptor with the resolver contract', () => {
    const locale = CMS_SLICE_12_PREFLIGHT_PROVIDERS.find(
      (row) => row.category === 'locale',
    );
    expect(locale?.providerKey).toBe(CMS_LOCALE_NO_FALLBACK_GATE.providerKey);
    expect(locale?.providerVersion).toBe(
      CMS_LOCALE_NO_FALLBACK_GATE.providerVersion,
    );
  });

  it('[P2-S12-AC-239][P2-S12-AC-241] equals the 03b registry rows: each provider is the registry version 2 row of its category', () => {
    for (const provider of CMS_SLICE_12_PREFLIGHT_PROVIDERS) {
      const row = CMS_PREFLIGHT_REGISTRY.find(
        (entry) => entry.category === provider.category,
      );
      expect(row).toMatchObject({
        registryVersion: '2',
        ownerSlice: provider.ownerSlice,
        providerKey: provider.providerKey,
        providerVersion: provider.providerVersion,
        providerKind: provider.providerKind,
        referenceKind: null,
      });
      expect([...(row?.reasonCodes ?? [])]).toEqual([...provider.reasonCodes]);
    }
  });
});
