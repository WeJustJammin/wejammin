import { describe, expect, it } from 'vitest';

import {
  CMS_SLICE_12_OPERATION_REASONS,
  CMS_SLICE_12_TIME_REASONS,
  CmsSlice12ReasonCodeSchema,
} from './refusals';

describe('BE03c Slice 12 typed refusals per operation', () => {
  const OPERATION_MARKER: Record<string, string> = {
    'CMS-03C-01': 'P2-S12-AC-008',
    'CMS-03C-02': 'P2-S12-AC-014',
    'CMS-03C-03': 'P2-S12-AC-020',
    'CMS-03C-04': 'P2-S12-AC-057',
    cmsLocaleVariantRead: 'P2-S12-AC-057',
    cmsCompositionInstancesRead: 'P2-S12-AC-269',
    cmsPatternNestableRead: 'P2-S12-AC-105',
    'CMS-03C-05': 'P2-S12-AC-062',
    cmsRelatedContentRead: 'P2-S12-AC-062',
    'CMS-03C-06': 'P2-S12-AC-068',
    'CMS-03C-07': 'P2-S12-AC-074',
    'CMS-03C-08': 'P2-S12-AC-080',
    'CMS-03C-09': 'P2-S12-AC-086',
    'CMS-03C-10': 'P2-S12-AC-092',
    'CMS-03C-11': 'P2-S12-AC-098',
    'CMS-03C-12': 'P2-S12-AC-104',
    'CMS-03C-13': 'P2-S12-AC-110',
    'CMS-03C-14': 'P2-S12-AC-116',
    'CMS-03C-15': 'P2-S12-AC-122',
    'CMS-03C-16': 'P2-S12-AC-128',
    'CMS-03C-17': 'P2-S12-AC-134',
    cmsTemplateLatestRead: 'P2-S12-AC-169',
    cmsPatternLatestRead: 'P2-S12-AC-175',
    cmsTaxonomyVersionsRead: 'P2-S12-AC-181',
    cmsTaxonomyTermsRead: 'P2-S12-AC-187',
  };

  const EXPECTED_REASONS = {
    'CMS-03C-01': [
      'capability_missing',
      'block_registry_digest_mismatch',
      'key_reserved',
    ],
    'CMS-03C-02': [
      'capability_missing',
      'revision_not_editable',
      'pattern_cycle',
      'block_registry_digest_mismatch',
      'pattern_version_not_active',
      'pattern_incompatible',
      'nested_pattern_not_active',
      'block_rules_violated',
    ],
    'CMS-03C-03': [
      'capability_missing',
      'taxonomy_not_active',
      'canonical_overlap',
      'canonical_source_unavailable',
    ],
    'CMS-03C-04': [
      'capability_missing',
      'locale_limit_reached',
      'FALLBACK_CHAIN_MISMATCH',
    ],
    'CMS-03C-05': [
      'capability_missing',
      'derived_rule_unknown',
      'related_target_ineligible',
    ],
    'CMS-03C-06': [
      'capability_missing',
      'separation_of_duties',
      'subject_not_submittable',
      'canonical_source_unavailable',
    ],
    'CMS-03C-07': [
      'capability_missing',
      'separation_of_duties',
      'review_not_open',
      'duplicate_decision',
      'specialist_slot_unsatisfiable',
      'dependency_changed',
    ],
    'CMS-03C-08': [
      'capability_missing',
      'reviewer_not_eligible',
      'assignment_exists',
      'assignment_limit',
      'review_not_open',
      'expiry_out_of_bounds',
    ],
    'CMS-03C-09': [
      'capability_missing',
      'subject_not_activatable',
      'subject_not_retirable',
      'dependency_changed',
      'activation_conflict',
      'schedule_exists',
      'canonical_source_unavailable',
      ...CMS_SLICE_12_TIME_REASONS,
    ],
    'CMS-03C-10': ['capability_missing'],
    'CMS-03C-11': [],
    'CMS-03C-12': [
      'capability_missing',
      'pattern_cycle',
      'block_registry_digest_mismatch',
      'key_reserved',
      'pattern_version_not_active',
      'pattern_incompatible',
      'nested_pattern_not_active',
      'pattern_depth_exceeded',
      'pattern_nodes_exceeded',
      'block_rules_violated',
    ],
    'CMS-03C-13': ['capability_missing'],
    'CMS-03C-14': ['capability_missing', 'diff_too_large'],
    'CMS-03C-15': [
      'capability_missing',
      'revision_not_editable',
      'diff_has_collisions',
      'pattern_version_not_active',
      'pattern_incompatible',
      'nested_pattern_not_active',
      'block_rules_violated',
    ],
    'CMS-03C-16': ['capability_missing'],
    'CMS-03C-17': ['capability_missing'],
    cmsTemplateLatestRead: ['capability_missing'],
    cmsPatternLatestRead: ['capability_missing'],
    cmsTaxonomyVersionsRead: ['capability_missing'],
    cmsTaxonomyTermsRead: ['capability_missing'],
    cmsRelatedContentRead: ['capability_missing'],
    cmsLocaleVariantRead: ['capability_missing'],
    cmsCompositionInstancesRead: ['capability_missing'],
    // DEC-196: a visible owner party without cms.template_designer is the one 403; no other typed token.
    cmsPatternNestableRead: ['capability_missing'],
  } as const;

  it('[P2-S12-AC-274] names an allowlist for exactly the 25 Slice 12 operations of the error catalog', () => {
    expect(Object.keys(CMS_SLICE_12_OPERATION_REASONS).sort()).toEqual(
      Object.keys(EXPECTED_REASONS).sort(),
    );
    expect(Object.keys(OPERATION_MARKER).sort()).toEqual(
      Object.keys(EXPECTED_REASONS).sort(),
    );
  });

  for (const [operation, tokens] of Object.entries(EXPECTED_REASONS))
    it(`[${OPERATION_MARKER[operation]}] ${operation} may publish exactly the typed refusals the BE03c matrices name, every one in the closed set`, () => {
      const actual = (
        CMS_SLICE_12_OPERATION_REASONS as Record<string, readonly string[]>
      )[operation];
      expect([...(actual ?? [])].sort()).toEqual([...tokens].sort());
      for (const token of tokens)
        expect(CmsSlice12ReasonCodeSchema.safeParse(token).success).toBe(true);
    });
});
