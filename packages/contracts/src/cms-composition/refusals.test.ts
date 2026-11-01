import { describe, expect, it } from 'vitest';

import { CMS_SLICE_11_VALIDATION_REASONS } from '../cms-editorial/refusals';
import {
  CMS_SLICE_12_CONFLICT_REASONS,
  CMS_SLICE_12_FORBIDDEN_REASONS,
  CMS_SLICE_12_TIME_REASONS,
  CMS_SLICE_12_VALIDATION_REASONS,
  CmsCompositionRefusalDetailsSchema,
  CmsSlice12RefusalDetailsSchema,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from './refusals';

const canonicalId = '123e4567-e89b-42d3-a456-426614174000';

const refused = (
  schema: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown,
) => !schema.safeParse(v).success;

/** Tokens that carry required members beyond `reasonCode`. */
const WITH_MEMBERS = new Set([
  'canonical_overlap',
  'canonical_source_unavailable',
  'FALLBACK_CHAIN_MISMATCH',
  'tzdb_version_mismatch',
  'resolved_utc_mismatch',
  'schedule_out_of_horizon',
  'nonexistent_local_time',
  'ambiguous_local_time',
]);

describe('BE03c Slice 12 typed refusals (closed reason-token sets)', () => {
  it('[P2-S12-AC-274] lists exactly the 403 tokens capability_missing and separation_of_duties', () => {
    expect([...CMS_SLICE_12_FORBIDDEN_REASONS]).toEqual([
      'capability_missing',
      'separation_of_duties',
    ]);
  });

  it('[P2-S12-AC-274] lists exactly the BE03c 409 tokens, DEC-186 digest mismatch and FALLBACK_CHAIN_MISMATCH included', () => {
    expect([...CMS_SLICE_12_CONFLICT_REASONS].sort()).toEqual(
      [
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
        'FALLBACK_CHAIN_MISMATCH',
      ].sort(),
    );
  });

  it('[P2-S12-AC-274] lists exactly the BE03c 422 tokens and the 03b time tokens of a scheduled activation', () => {
    expect([...CMS_SLICE_12_VALIDATION_REASONS].sort()).toEqual(
      [
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
      ].sort(),
    );
    expect([...CMS_SLICE_12_TIME_REASONS]).toEqual([
      'unknown_timezone',
      'tzdb_version_mismatch',
      'nonexistent_local_time',
      'ambiguous_local_time',
      'disambiguation_not_applicable',
      'resolved_utc_mismatch',
      'schedule_out_of_horizon',
      'authority_ends_before_schedule',
    ]);
    // The time tokens are the 03b vocabulary, not a second copy that can drift.
    for (const token of CMS_SLICE_12_TIME_REASONS)
      expect(CMS_SLICE_11_VALIDATION_REASONS as readonly string[]).toContain(
        token,
      );
  });

  it('[P2-S12-AC-274] lists each token under exactly one status and keeps it on every operation', () => {
    const all = [
      ...CMS_SLICE_12_FORBIDDEN_REASONS,
      ...CMS_SLICE_12_CONFLICT_REASONS,
      ...CMS_SLICE_12_VALIDATION_REASONS,
    ];
    expect(new Set(all).size).toBe(all.length);
    for (const token of CMS_SLICE_12_FORBIDDEN_REASONS)
      expect(cmsSlice12ReasonStatus(token)).toBe(403);
    for (const token of CMS_SLICE_12_CONFLICT_REASONS)
      expect(cmsSlice12ReasonStatus(token)).toBe(409);
    for (const token of CMS_SLICE_12_VALIDATION_REASONS)
      expect(cmsSlice12ReasonStatus(token)).toBe(422);
    // R5: the three pattern-state tokens are request validation, never a 409.
    for (const token of [
      'pattern_version_not_active',
      'pattern_incompatible',
      'nested_pattern_not_active',
    ] as const)
      expect(cmsSlice12ReasonStatus(token)).toBe(422);
    expect(cmsSlice12ReasonStatus('block_registry_digest_mismatch')).toBe(409);
    expect(cmsSlice12ReasonStatus('canonical_source_unavailable')).toBe(422);
  });

  it('[P2-S12-AC-274] makes every token lowercase snake_case except the one documented FALLBACK_CHAIN_MISMATCH exception', () => {
    const all = [
      ...CMS_SLICE_12_FORBIDDEN_REASONS,
      ...CMS_SLICE_12_CONFLICT_REASONS,
      ...CMS_SLICE_12_VALIDATION_REASONS,
    ];
    const odd = all.filter((token) => !/^[a-z][a-z0-9_]{0,63}$/u.test(token));
    expect(odd).toEqual(['FALLBACK_CHAIN_MISMATCH']);
    expect(CmsSlice12ReasonCodeSchema.options).toHaveLength(all.length);
    expect(CmsSlice12ReasonCodeSchema.safeParse('made_up').success).toBe(false);
    expect(CmsSlice12ReasonCodeSchema.safeParse('CONFLICT').success).toBe(
      false,
    );
    expect(
      CmsSlice12ReasonCodeSchema.safeParse('VERSION_MISMATCH').success,
    ).toBe(false);
  });

  it('[P2-S12-AC-274] accepts a plain token with bounded RFC 6901 violations only', () => {
    for (const reasonCode of [
      ...CMS_SLICE_12_FORBIDDEN_REASONS,
      ...CMS_SLICE_12_CONFLICT_REASONS,
      ...CMS_SLICE_12_VALIDATION_REASONS,
    ].filter((token) => !WITH_MEMBERS.has(token)))
      expect(
        CmsSlice12RefusalDetailsSchema.safeParse({ reasonCode }).success,
        reasonCode,
      ).toBe(true);
    const violation = {
      path: '/subjectHash',
      code: 'subject_hash_mismatch',
      message: 'The value is invalid.',
    };
    expect(
      CmsCompositionRefusalDetailsSchema.safeParse({
        reasonCode: 'key_reserved',
        violations: [violation],
      }).success,
    ).toBe(true);
    expect(
      refused(CmsCompositionRefusalDetailsSchema, {
        reasonCode: 'key_reserved',
        violations: Array.from({ length: 51 }, () => violation),
      }),
    ).toBe(true);
    expect(
      refused(CmsCompositionRefusalDetailsSchema, {
        reasonCode: 'key_reserved',
        violations: [{ ...violation, path: 'templateKey' }],
      }),
    ).toBe(true);
    expect(
      refused(CmsCompositionRefusalDetailsSchema, {
        reasonCode: 'key_reserved',
        violations: [{ ...violation, value: 'context' }],
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-274] refuses an unknown token, a missing token and any member the token does not name', () => {
    expect(
      refused(CmsSlice12RefusalDetailsSchema, { reasonCode: 'made_up' }),
    ).toBe(true);
    expect(refused(CmsSlice12RefusalDetailsSchema, {})).toBe(true);
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'review_not_open',
        ownerId: 'x',
      }),
    ).toBe(true);
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'capability_missing',
        policy: 'cms.reviewer',
      }),
    ).toBe(true);
    // Shorthands that are not application tokens in the 03c catalogs.
    for (const reasonCode of [
      'VERSION_MISMATCH',
      'CONFLICT',
      'CAPABILITY_REQUIRED',
    ])
      expect(
        refused(CmsSlice12RefusalDetailsSchema, { reasonCode }),
        reasonCode,
      ).toBe(true);
  });

  it('[P2-S12-AC-222] carries the canonical domain and canonical id on a canonical_overlap refusal', () => {
    const body = {
      reasonCode: 'canonical_overlap',
      domain: 'role',
      canonicalId,
    };
    expect(CmsSlice12RefusalDetailsSchema.parse(body)).toEqual(body);
    for (const candidate of [
      { reasonCode: 'canonical_overlap' },
      { reasonCode: 'canonical_overlap', domain: 'role' },
      { reasonCode: 'canonical_overlap', canonicalId },
      { ...body, domain: 'genre' },
      { ...body, canonicalId: 'not-a-uuid' },
      { ...body, label: 'Guitarist' },
    ])
      expect(refused(CmsSlice12RefusalDetailsSchema, candidate)).toBe(true);
    for (const domain of [
      'role',
      'instrument',
      'gear',
      'place',
      'rights',
      'jurisdiction',
    ])
      expect(
        CmsSlice12RefusalDetailsSchema.safeParse({ ...body, domain }).success,
      ).toBe(true);
  });

  it('[P2-S12-AC-223] carries the canonical domain on a canonical_source_unavailable refusal', () => {
    const body = { reasonCode: 'canonical_source_unavailable', domain: 'gear' };
    expect(CmsSlice12RefusalDetailsSchema.parse(body)).toEqual(body);
    for (const candidate of [
      { reasonCode: 'canonical_source_unavailable' },
      { ...body, domain: 'genre' },
      { ...body, canonicalId },
    ])
      expect(refused(CmsSlice12RefusalDetailsSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-233] types the FALLBACK_CHAIN_MISMATCH 409 with the active chain of at most 16 tags', () => {
    const body = {
      reasonCode: 'FALLBACK_CHAIN_MISMATCH',
      activeFallbackChain: ['en', 'fr'],
    };
    expect(CmsSlice12RefusalDetailsSchema.parse(body)).toEqual(body);
    expect(
      CmsSlice12RefusalDetailsSchema.safeParse({
        ...body,
        activeFallbackChain: [],
      }).success,
    ).toBe(true);
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        ...body,
        activeFallbackChain: Array.from({ length: 17 }, () => 'en'),
      }),
    ).toBe(true);
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'FALLBACK_CHAIN_MISMATCH',
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-274] types block_rules_violated as one 422 token with bounded RFC 6901 violations (DEC-210)', () => {
    expect(cmsSlice12ReasonStatus('block_rules_violated')).toBe(422);
    const violation = {
      path: '/instances/0/choices',
      code: 'block_rules_violated',
      message: 'The value is invalid.',
    };
    expect(
      CmsSlice12RefusalDetailsSchema.parse({
        reasonCode: 'block_rules_violated',
        violations: [violation],
      }),
    ).toEqual({ reasonCode: 'block_rules_violated', violations: [violation] });
    expect(
      CmsSlice12RefusalDetailsSchema.safeParse({
        reasonCode: 'block_rules_violated',
      }).success,
    ).toBe(true);
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'block_rules_violated',
        domain: 'role',
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-083] keeps the 03b time-authority detail members on the scheduled-activation 422 tokens', () => {
    expect(
      CmsSlice12RefusalDetailsSchema.safeParse({
        reasonCode: 'schedule_out_of_horizon',
        minUtc: '2026-10-13T00:01:00Z',
        maxUtc: '2027-10-14T00:00:00Z',
      }).success,
    ).toBe(true);
    // A time token without its required member is not a typed refusal.
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'schedule_out_of_horizon',
      }),
    ).toBe(true);
    expect(
      CmsSlice12RefusalDetailsSchema.safeParse({
        reasonCode: 'unknown_timezone',
      }).success,
    ).toBe(true);
    // A 03b token that is not in the Slice 12 vocabulary stays refused.
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'preflight_failed',
        preflight: [],
      }),
    ).toBe(true);
    expect(
      refused(CmsSlice12RefusalDetailsSchema, {
        reasonCode: 'publication_conflict',
      }),
    ).toBe(true);
  });
});
