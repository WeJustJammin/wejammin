import { z } from 'zod';

import {
  CmsEditorialRefusalDetailsSchema,
  CmsViolationSchema,
} from '../cms-editorial/refusals.ts';
import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';
import { CanonicalDomainSchema } from './canonical-taxonomy-match.ts';
import {
  LOCALE_FALLBACK_CHAIN_MISMATCH,
  LocaleFallbackChainMismatchDetailsSchema,
} from './locale-variant.ts';

/*
 * BE03c "Slice 12 typed refusals": within the 03c catalogs a refusal carries
 * exactly one `details.reasonCode` token from the closed lists below, plus only
 * the members named per token. Each token has exactly one status and keeps it
 * on every operation that raises it. A provider timeout or fault is a 503
 * `DEPENDENCY_UNAVAILABLE`, never a token, and a stale CAS operand is the
 * catalog's `*_VERSION_CONFLICT` code (the shorthands `VERSION_MISMATCH` and
 * `CONFLICT` are not application codes here, DEC-180 R5).
 */

/** 403 tokens: the submitter, creator or a revision author acting as reviewer is `separation_of_duties`. */
export const CMS_SLICE_12_FORBIDDEN_REASONS = [
  'capability_missing',
  'separation_of_duties',
] as const;

/**
 * 409 tokens. `FALLBACK_CHAIN_MISMATCH` is the one uppercase token (03a OD-4,
 * kept verbatim); `block_registry_digest_mismatch` is DEC-186: a differing
 * client digest expectation, raised by CMS-03C-01, -02 and -12.
 */
export const CMS_SLICE_12_CONFLICT_REASONS = [
  'subject_not_submittable',
  'review_not_open',
  'duplicate_decision',
  'specialist_slot_unsatisfiable',
  'reviewer_not_eligible',
  'assignment_exists',
  'assignment_limit',
  'dependency_changed',
  'subject_not_activatable',
  'subject_not_retirable',
  'activation_conflict',
  'schedule_exists',
  'revision_not_editable',
  'pattern_cycle',
  'diff_has_collisions',
  'taxonomy_not_active',
  'locale_limit_reached',
  'block_registry_digest_mismatch',
  LOCALE_FALLBACK_CHAIN_MISMATCH,
] as const;

/** The 03b time tokens a scheduled activation (CMS-03C-09) may raise, as 422. */
export const CMS_SLICE_12_TIME_REASONS = [
  'unknown_timezone',
  'tzdb_version_mismatch',
  'nonexistent_local_time',
  'ambiguous_local_time',
  'disambiguation_not_applicable',
  'resolved_utc_mismatch',
  'schedule_out_of_horizon',
  'authority_ends_before_schedule',
] as const;

/** 422 tokens, the 03b time tokens included. */
export const CMS_SLICE_12_VALIDATION_REASONS = [
  'key_reserved',
  'pattern_version_not_active',
  'pattern_incompatible',
  'nested_pattern_not_active',
  'pattern_depth_exceeded',
  'pattern_nodes_exceeded',
  'block_rules_violated',
  'diff_too_large',
  'canonical_overlap',
  'canonical_source_unavailable',
  'term_unavailable',
  'derived_rule_unknown',
  'related_target_ineligible',
  'expiry_out_of_bounds',
  ...CMS_SLICE_12_TIME_REASONS,
] as const;

export const CmsSlice12ReasonCodeSchema = z.enum([
  ...CMS_SLICE_12_FORBIDDEN_REASONS,
  ...CMS_SLICE_12_CONFLICT_REASONS,
  ...CMS_SLICE_12_VALIDATION_REASONS,
]);
export type CmsSlice12ReasonCode = z.infer<typeof CmsSlice12ReasonCodeSchema>;

/** The one HTTP status of a reason token: 403, 409 or 422. */
export const cmsSlice12ReasonStatus = (
  reason: CmsSlice12ReasonCode,
): 403 | 409 | 422 =>
  (CMS_SLICE_12_FORBIDDEN_REASONS as readonly string[]).includes(reason)
    ? 403
    : (CMS_SLICE_12_CONFLICT_REASONS as readonly string[]).includes(reason)
      ? 409
      : 422;

const pattern422 = [
  'pattern_version_not_active',
  'pattern_incompatible',
  'nested_pattern_not_active',
] as const;

/**
 * DEC-210 (BE03c "Block composition rules"): the registry `allowedChildren` and
 * `slotRules` of a pinned block version are enforced at the pattern save
 * (CMS-03C-12), the placement (CMS-03C-02) and the accept/detach (CMS-03C-15);
 * the one 422 token names the operation's pointer in `details.violations`.
 */
const blockRules422 = ['block_rules_violated'] as const;

/**
 * The tokens each 03c operation may publish, derived from the route field
 * validation matrix and the contract and error matrix. `term_unavailable` is a
 * 03b taxonomy field-value refusal and belongs to no 03c operation.
 */
export const CMS_SLICE_12_OPERATION_REASONS = {
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
    ...pattern422,
    ...blockRules422,
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
    LOCALE_FALLBACK_CHAIN_MISMATCH,
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
    'pattern_depth_exceeded',
    'pattern_nodes_exceeded',
    ...pattern422,
    ...blockRules422,
  ],
  'CMS-03C-13': ['capability_missing'],
  'CMS-03C-14': ['capability_missing', 'diff_too_large'],
  // FE03 885 and P2-S12-AC-123: CMS-03C-15 publishes `revision_not_editable` (409, BE03c 1304) when the instance's revision is no
  // longer the entry's editable draft; the front end keeps the author's choices on it.
  'CMS-03C-15': [
    'capability_missing',
    'revision_not_editable',
    'diff_has_collisions',
    ...pattern422,
    ...blockRules422,
  ],
  'CMS-03C-16': ['capability_missing'],
  'CMS-03C-17': ['capability_missing'],
  cmsTemplateLatestRead: ['capability_missing'],
  cmsPatternLatestRead: ['capability_missing'],
  cmsTaxonomyVersionsRead: ['capability_missing'],
  cmsTaxonomyTermsRead: ['capability_missing'],
  // DEC-195: a visible source without edit is the one 403; no other typed token.
  cmsRelatedContentRead: ['capability_missing'],
  // DEC-205: a visible entry without edit is the one 403; no other typed token.
  cmsLocaleVariantRead: ['capability_missing'],
  // DEC-206: a visible entry without edit is the one 403; no other typed token.
  cmsCompositionInstancesRead: ['capability_missing'],
  // DEC-196: an owner-party member without cms.template_designer is the one 403; no other typed token.
  cmsPatternNestableRead: ['capability_missing'],
} as const satisfies Readonly<Record<string, readonly CmsSlice12ReasonCode[]>>;

const ViolationsSchema = z.array(CmsViolationSchema).max(50).readonly();

const plainDetails = <const Token extends CmsSlice12ReasonCode>(token: Token) =>
  z
    .strictObject({
      reasonCode: z.literal(token),
      violations: ViolationsSchema.optional(),
    })
    .readonly();

/**
 * The `details` of a Slice 12 typed 403/409/422 refusal outside the 03b time
 * tokens, keyed by its single `reasonCode`. `canonical_overlap` names the
 * domain and the canonical id to reference instead, `canonical_source_unavailable`
 * names the unbuilt domain, and `FALLBACK_CHAIN_MISMATCH` returns the active
 * chain; every other token names no further member.
 */
export const CmsCompositionRefusalDetailsSchema = z.discriminatedUnion(
  'reasonCode',
  [
    plainDetails('capability_missing'),
    plainDetails('separation_of_duties'),
    plainDetails('subject_not_submittable'),
    plainDetails('review_not_open'),
    plainDetails('duplicate_decision'),
    plainDetails('specialist_slot_unsatisfiable'),
    plainDetails('reviewer_not_eligible'),
    plainDetails('assignment_exists'),
    plainDetails('assignment_limit'),
    plainDetails('dependency_changed'),
    plainDetails('subject_not_activatable'),
    plainDetails('subject_not_retirable'),
    plainDetails('activation_conflict'),
    plainDetails('schedule_exists'),
    plainDetails('revision_not_editable'),
    plainDetails('pattern_cycle'),
    plainDetails('diff_has_collisions'),
    plainDetails('taxonomy_not_active'),
    plainDetails('locale_limit_reached'),
    plainDetails('block_registry_digest_mismatch'),
    plainDetails('key_reserved'),
    plainDetails('pattern_version_not_active'),
    plainDetails('pattern_incompatible'),
    plainDetails('nested_pattern_not_active'),
    plainDetails('pattern_depth_exceeded'),
    plainDetails('pattern_nodes_exceeded'),
    plainDetails('block_rules_violated'),
    plainDetails('diff_too_large'),
    plainDetails('term_unavailable'),
    plainDetails('derived_rule_unknown'),
    plainDetails('related_target_ineligible'),
    plainDetails('expiry_out_of_bounds'),
    z
      .strictObject({
        reasonCode: z.literal('canonical_overlap'),
        domain: CanonicalDomainSchema,
        canonicalId: CmsUuidSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    z
      .strictObject({
        reasonCode: z.literal('canonical_source_unavailable'),
        domain: CanonicalDomainSchema,
        violations: ViolationsSchema.optional(),
      })
      .readonly(),
    LocaleFallbackChainMismatchDetailsSchema,
  ],
);

/**
 * The 03b time-authority refusals of a scheduled activation: the S11 detail
 * schema restricted to the eight time tokens, so the 03b members (pinned
 * version, expected instant, horizon, alternatives) keep one definition.
 */
export const CmsGovernedTimeRefusalDetailsSchema =
  CmsEditorialRefusalDetailsSchema.refine(
    (details) =>
      (CMS_SLICE_12_TIME_REASONS as readonly string[]).includes(
        details.reasonCode,
      ),
    'not_a_time_token',
  );

export const CmsSlice12RefusalDetailsSchema = z.union([
  CmsCompositionRefusalDetailsSchema,
  CmsGovernedTimeRefusalDetailsSchema,
]);

export type CmsCompositionRefusalDetails = z.infer<
  typeof CmsCompositionRefusalDetailsSchema
>;
export type CmsSlice12RefusalDetails = z.infer<
  typeof CmsSlice12RefusalDetailsSchema
>;
