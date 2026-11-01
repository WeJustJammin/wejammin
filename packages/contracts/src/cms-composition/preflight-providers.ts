import {
  CMS_LOCALE_NO_FALLBACK_GATE,
  CMS_LOCALE_NO_FALLBACK_REASONS,
} from './locale-resolution.ts';

/*
 * BE03c "Preflight providers registered by Slice 12": three database providers,
 * each a newer 03b preflight-registry row that replaces the
 * `preflight.reference_gate` row of its category. The `route`, `media` and
 * `privacy` categories stay on the reference gate until Slices 13, 14 and 16
 * register theirs. This is the contract mirror of the three forward-migration
 * rows; the 03b registry parity test reads it.
 */

export type CmsSlice12PreflightProvider = Readonly<{
  category: 'pattern' | 'taxonomy' | 'locale';
  ownerSlice: '03c';
  providerKey: string;
  providerVersion: '1';
  providerKind: 'database';
  /** The provider's closed reason-code set for a `failed` result. */
  reasonCodes: readonly string[];
}>;

export const CMS_SLICE_12_PREFLIGHT_PROVIDERS = [
  {
    category: 'pattern',
    ownerSlice: '03c',
    providerKey: 'cms.pattern.active_digest',
    providerVersion: '1',
    providerKind: 'database',
    reasonCodes: [
      'pattern_not_active',
      'pattern_digest_changed',
      'nested_pattern_not_active',
      'pattern_block_rules_violated',
    ],
  },
  {
    category: 'taxonomy',
    ownerSlice: '03c',
    providerKey: 'cms.taxonomy.assignment_integrity',
    providerVersion: '1',
    providerKind: 'database',
    reasonCodes: [
      'term_merged_unconverged',
      'allowlist_changed',
      'taxonomy_version_not_active',
    ],
  },
  {
    category: CMS_LOCALE_NO_FALLBACK_GATE.category,
    ownerSlice: '03c',
    providerKey: CMS_LOCALE_NO_FALLBACK_GATE.providerKey,
    providerVersion: CMS_LOCALE_NO_FALLBACK_GATE.providerVersion,
    providerKind: 'database',
    reasonCodes: CMS_LOCALE_NO_FALLBACK_REASONS,
  },
] as const satisfies readonly CmsSlice12PreflightProvider[];
