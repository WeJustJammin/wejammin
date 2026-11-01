import { READ_OPERATIONS } from './phase-02-slice-12-registry-parity-reads';
import type { SpecOperation } from './phase-02-slice-12-registry-parity-types';
import { WRITE_OPERATIONS } from './phase-02-slice-12-registry-parity-writes';

export * from './phase-02-slice-12-registry-parity-types';

/** The 26 BE03c browser operations: CMS-03C-01 to CMS-03C-17 and the nine named supporting reads. */
export const BROWSER_OPERATIONS: readonly SpecOperation[] = [
  ...WRITE_OPERATIONS,
  ...READ_OPERATIONS,
];

/** The numbered browser operations of the Route Registry table. */
export const NUMBERED_IDS: readonly string[] = Array.from(
  { length: 17 },
  (_unused, index) => `CMS-03C-${String(index + 1).padStart(2, '0')}`,
);

/** The named supporting reads of the Route Registry table. */
export const SUPPORTING_READ_IDS: readonly string[] = [
  'cmsTemplateContextRead',
  'cmsRelatedContentRead',
  'cmsLocaleVariantRead',
  'cmsTemplateLatestRead',
  'cmsPatternLatestRead',
  'cmsTaxonomyVersionsRead',
  'cmsTaxonomyTermsRead',
  'cmsCompositionInstancesRead',
  'cmsPatternNestableRead',
];

/**
 * "Internal service operations": CMS-03C-18 to CMS-03C-21 are not browser routes. Each names the
 * database RPC (or job, or registered provider) that must appear in no browser inventory.
 */
export const INTERNAL_OPERATIONS: Readonly<Record<string, readonly string[]>> =
  {
    'CMS-03C-18': ['cms_canonical_taxonomy_match'],
    'CMS-03C-19': [
      'cms_claim_due_governed_activations',
      'cms_execute_governed_activation',
      'cms.governed_activation.execute',
    ],
    'CMS-03C-20': ['cms_resolve_locale_field', 'cms.locale.no_fallback_gate'],
    'CMS-03C-21': ['cms_related_content_public_targets'],
  };
