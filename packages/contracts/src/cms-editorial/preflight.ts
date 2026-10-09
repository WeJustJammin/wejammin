import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';

/*
 * BE03b Publication preflight registry (D19, DEC-134, D25). Review submission,
 * schedule acceptance, schedule execution and publication evaluate one closed
 * set of seventeen categories through a code-owned registry. This module is the
 * TypeScript mirror of `platform_private.cms_preflight_registry`: a CI parity
 * test compares the SQL rows with `CMS_PREFLIGHT_REGISTRY` and the enum.
 */

/** The seventeen categories in registry order (BE03b `PreflightCategory`). */
export const CMS_PREFLIGHT_CATEGORIES = [
  'contract',
  'schema',
  'template',
  'block',
  'pattern',
  'taxonomy',
  'settings',
  'relation',
  'privacy',
  'security',
  'accessibility',
  'media',
  'route',
  'locale',
  'migration',
  'domain_binding',
  'revocation',
] as const;

export const PreflightCategorySchema = z.enum(CMS_PREFLIGHT_CATEGORIES);
export type PreflightCategory = z.infer<typeof PreflightCategorySchema>;

/** BE03b `PreflightOutcome`: types only the per-category `PreflightResult`. */
export const PreflightOutcomeSchema = z.enum([
  'passed',
  'failed',
  'unavailable',
]);
export type PreflightOutcome = z.infer<typeof PreflightOutcomeSchema>;

/** The registry phases; CMS-03B-08 runs no phase and CMS-03B-15 reads `submit`. */
export const CMS_PREFLIGHT_PHASES = [
  'submit',
  'schedule',
  'publish',
  'execute',
] as const;
export type CmsPreflightPhase = (typeof CMS_PREFLIGHT_PHASES)[number];

const PHASE_CATEGORIES = {
  submit: CMS_PREFLIGHT_CATEGORIES,
  schedule: CMS_PREFLIGHT_CATEGORIES,
  publish: CMS_PREFLIGHT_CATEGORIES,
  execute: CMS_PREFLIGHT_CATEGORIES,
} as const satisfies Record<CmsPreflightPhase, readonly PreflightCategory[]>;

/**
 * Every phase reports all seventeen categories; what differs per phase is the
 * scope of the `revocation` provider (submit: entry lifecycle and the
 * submitter's authority; schedule and publish: the caller's publisher grant at
 * the instant the action takes effect; execute: revocation of the schedule
 * creator's grant and its end before the fire instant).
 */
export const cmsPreflightCategoriesForPhase = (
  phase: CmsPreflightPhase,
): readonly PreflightCategory[] => PHASE_CATEGORIES[phase];

export const CMS_A11Y_CHECKER_KEY = 'cms.a11y.structural' as const;
export const CMS_A11Y_CHECKER_VERSION = '1' as const;
/** BE05c wall-clock budget of the structural checker, input load included. */
export const CMS_A11Y_CHECKER_TIMEOUT_MS = 2_000 as const;
/** The RPC accepts accessibility evidence evaluated within this many seconds. */
export const CMS_PREFLIGHT_EVIDENCE_MAX_AGE_SECONDS = 60 as const;

export type CmsPreflightProviderKind = 'database' | 'worker' | 'reference_gate';

export type CmsPreflightRegistryRow = Readonly<{
  category: PreflightCategory;
  registryVersion: '1';
  /** The owning shard(s) of the category. */
  ownerSlice: string;
  providerKey: string;
  providerVersion: '1';
  providerKind: CmsPreflightProviderKind;
  /** The reference kind counted by `cms_revision_references`; null unless a reference gate. */
  referenceKind: PreflightCategory | null;
  /** The provider's closed reason-code set for a `failed` result. */
  reasonCodes: readonly string[];
}>;

const databaseRow = (
  category: PreflightCategory,
  ownerSlice: string,
  reasonCodes: readonly string[],
): CmsPreflightRegistryRow => ({
  category,
  registryVersion: '1',
  ownerSlice,
  providerKey: `preflight.${category}`,
  providerVersion: '1',
  providerKind: 'database',
  referenceKind: null,
  reasonCodes,
});

/** D19: a category whose owning domain has no provider yet passes only with no reference. */
const referenceGateRow = (
  category: PreflightCategory,
  ownerSlice: string,
): CmsPreflightRegistryRow => ({
  category,
  registryVersion: '1',
  ownerSlice,
  providerKey: 'preflight.reference_gate',
  providerVersion: '1',
  providerKind: 'reference_gate',
  referenceKind: category,
  reasonCodes: ['provider_unbuilt_reference'],
});

/** BE03b registry table (`Publication preflight registry`), rows 1-17 in order. */
export const CMS_PREFLIGHT_REGISTRY = [
  databaseRow('contract', '03a/03b', ['value_invalid', 'validators_changed']),
  databaseRow('schema', '03a', [
    'schema_not_active',
    'schema_evidence_changed',
  ]),
  databaseRow('template', '03c', [
    'template_not_active',
    'template_incompatible',
    'template_changed',
  ]),
  databaseRow('block', '03a/03c', ['block_withdrawn', 'block_digest_changed']),
  referenceGateRow('pattern', '03c'),
  referenceGateRow('taxonomy', '03c'),
  databaseRow('settings', '05a', ['settings_changed']),
  databaseRow('relation', '03a/03b', [
    'relation_target_unavailable',
    'relation_version_changed',
  ]),
  referenceGateRow('privacy', '05/16'),
  databaseRow('security', '03b', ['unsafe_content']),
  {
    category: 'accessibility',
    registryVersion: '1',
    ownerSlice: '05c',
    providerKey: CMS_A11Y_CHECKER_KEY,
    providerVersion: CMS_A11Y_CHECKER_VERSION,
    providerKind: 'worker',
    referenceKind: null,
    reasonCodes: ['blocking_finding', 'checker_failed'],
  },
  referenceGateRow('media', '04b'),
  referenceGateRow('route', '04a'),
  referenceGateRow('locale', '03c'),
  databaseRow('migration', '03a', ['migration_in_progress']),
  databaseRow('domain_binding', '03a', ['binding_not_allowlisted']),
  databaseRow('revocation', '03b/BE01', [
    'entry_unavailable',
    'reviewer_authority_changed',
    'publisher_authority_ended',
  ]),
] as const satisfies readonly CmsPreflightRegistryRow[];

const registeredReasons = (category: PreflightCategory): readonly string[] =>
  CMS_PREFLIGHT_REGISTRY.find((row) => row.category === category)
    ?.reasonCodes ?? [];

/**
 * DEC-160 (BE03b D19, "Unavailable reasons"): the closed set of reasons an
 * `unavailable` result of `category` may carry. A database or reference-gate
 * provider that cannot answer (a dependency failed or timed out, or the
 * registry row names a provider the deployed code does not implement) is
 * `provider_unavailable`; the worker accessibility provider is
 * `checker_failed` (DEC-150). No other unavailable token exists.
 */
export const cmsPreflightUnavailableReasons = (
  category: PreflightCategory,
): readonly string[] =>
  category === 'accessibility' ? ['checker_failed'] : ['provider_unavailable'];

/**
 * DEC-160: the closed set of reasons a `failed` result of `category` may
 * carry: the provider's registered reasons without its unavailable reason (a
 * checker that could not complete is `unavailable`, never `failed`, DEC-150).
 */
export const cmsPreflightFailedReasons = (
  category: PreflightCategory,
): readonly string[] => {
  const unavailable = cmsPreflightUnavailableReasons(category);
  return registeredReasons(category).filter(
    (reason) => !unavailable.includes(reason),
  );
};

const PreflightReasonTokenSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/u, 'reason_code_invalid');

/**
 * The reason invariants every non-passed preflight member holds (DEC-160): the
 * reason is null exactly when the outcome is `passed`; a `failed` member names
 * a token of its category's registered failed set, and an `unavailable` member
 * names the category's unavailable reason. Shared by `PreflightResult` and the
 * refusal entry of `details.preflight`, which carry the same three members.
 */
const refinePreflightReason = (
  value: {
    readonly category: PreflightCategory;
    readonly outcome: PreflightOutcome;
    readonly reasonCode: string | null;
  },
  context: z.RefinementCtx,
): void => {
  const { category, outcome, reasonCode } = value;
  if ((outcome === 'passed') !== (reasonCode === null)) {
    context.addIssue({
      code: 'custom',
      path: ['reasonCode'],
      message: 'reasonCode is null exactly when the outcome is passed',
    });
    return;
  }
  if (
    outcome === 'failed' &&
    reasonCode !== null &&
    !cmsPreflightFailedReasons(category).includes(reasonCode)
  )
    context.addIssue({
      code: 'custom',
      path: ['reasonCode'],
      message: 'a failed result names a reason of its category provider',
    });
  if (
    outcome === 'unavailable' &&
    reasonCode !== null &&
    !cmsPreflightUnavailableReasons(category).includes(reasonCode)
  )
    context.addIssue({
      code: 'custom',
      path: ['reasonCode'],
      message:
        'an unavailable result names the unavailable reason of its category provider',
    });
};

/**
 * BE03b `PreflightResult`. `reasonCode` is null exactly when the outcome is
 * `passed`; a `failed` result names a token of its category's registered
 * failed set and an `unavailable` result the category's one unavailable reason
 * (`provider_unavailable`, or `checker_failed` for accessibility, DEC-160).
 */
export const PreflightResultSchema = z
  .strictObject({
    category: PreflightCategorySchema,
    outcome: PreflightOutcomeSchema,
    providerKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/u),
    providerVersion: CmsVersionSchema,
    reasonCode: PreflightReasonTokenSchema.nullable(),
    blockingCount: z.number().int().min(0).max(1000),
  })
  .superRefine(refinePreflightReason)
  .readonly();

/** BE03b `PreflightReport`: exactly one result per category, in registry order. */
export const PreflightReportSchema = z
  .strictObject({
    evaluatedAt: CmsInstantSchema,
    passed: z.boolean(),
    results: z.array(PreflightResultSchema).length(17).readonly(),
  })
  .superRefine((value, context) => {
    if (value.passed !== value.results.every((r) => r.outcome === 'passed'))
      context.addIssue({
        code: 'custom',
        path: ['passed'],
        message: 'passed is true exactly when every category passed',
      });
    if (
      value.results.some(
        (result, index) => result.category !== CMS_PREFLIGHT_CATEGORIES[index],
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['results'],
        message: 'results list every category once, in registry order',
      });
  })
  .readonly();

/**
 * One entry of `details.preflight` on a 422 or 503 refusal: no counts, no
 * text, and the same reason invariants as the result it projects.
 */
export const PreflightRefusalEntrySchema = z
  .strictObject({
    category: PreflightCategorySchema,
    outcome: PreflightOutcomeSchema,
    reasonCode: PreflightReasonTokenSchema.nullable(),
  })
  .superRefine(refinePreflightReason)
  .readonly();

export type PreflightResult = z.infer<typeof PreflightResultSchema>;
export type PreflightReport = z.infer<typeof PreflightReportSchema>;
export type PreflightRefusalEntry = z.infer<typeof PreflightRefusalEntrySchema>;

/**
 * BE03b Aggregation: every category is evaluated (no short circuit). Any
 * `failed` refuses 422 `preflight_failed`; otherwise any `unavailable` refuses
 * 503 `DEPENDENCY_UNAVAILABLE`; otherwise the command proceeds.
 */
export const aggregatePreflight = (
  results: readonly PreflightResult[],
): Readonly<{
  kind: PreflightOutcome;
  entries: readonly PreflightRefusalEntry[];
}> => ({
  kind: results.some((r) => r.outcome === 'failed')
    ? 'failed'
    : results.some((r) => r.outcome === 'unavailable')
      ? 'unavailable'
      : 'passed',
  entries: results.map(({ category, outcome, reasonCode }) => ({
    category,
    outcome,
    reasonCode,
  })),
});

/**
 * BE03b Schedule execution: at execution a `failed` result blocks the schedule
 * (`preflight_failed`, prior publication intact) and an `unavailable` result is
 * retried (`failed_retryable`).
 */
export const cmsPreflightExecutionOutcome = (
  kind: PreflightOutcome,
): 'blocked' | 'failed_retryable' | 'proceed' =>
  kind === 'failed'
    ? 'blocked'
    : kind === 'unavailable'
      ? 'failed_retryable'
      : 'proceed';

/**
 * The BE05c checker run state (DEC-150): a fresh gate call yields exactly
 * `healthy`, `blocked` or `failed`; `requested`, `running` and `stale` never
 * reach the evidence, and it is not a `PreflightOutcome`.
 */
export const AccessibilityRunOutcomeSchema = z.enum([
  'healthy',
  'blocked',
  'failed',
]);

/**
 * BE03b `PreflightEvidence`: what the Worker-resident accessibility checker
 * hands the RPC. It is never a browser or PostgREST input. `bindingHash` is the
 * SHA-256 of the JCS `{ checkerKey, checkerVersion, revisionId,
 * revisionContentHash, dependencyHash }` the RPC recomputes from canonical rows.
 */
export const PreflightEvidenceSchema = z
  .strictObject({
    category: z.literal('accessibility'),
    providerKey: z.literal(CMS_A11Y_CHECKER_KEY),
    providerVersion: CmsVersionSchema,
    outcome: AccessibilityRunOutcomeSchema,
    blockingCount: z.number().int().min(0).max(1000),
    inputHash: CmsHashSchema,
    bindingHash: CmsHashSchema,
    evaluatedAt: CmsInstantSchema,
  })
  .superRefine((value, context) => {
    if (value.outcome === 'healthy' && value.blockingCount !== 0)
      context.addIssue({
        code: 'custom',
        path: ['blockingCount'],
        message: 'a healthy run has no blocking finding',
      });
    if (value.outcome === 'blocked' && value.blockingCount === 0)
      context.addIssue({
        code: 'custom',
        path: ['blockingCount'],
        message: 'a blocked run has a blocking finding',
      });
  })
  .readonly();

export type PreflightEvidence = z.infer<typeof PreflightEvidenceSchema>;

/**
 * The input whose JCS SHA-256 is `PreflightEvidence.bindingHash`:
 * `{ checkerKey, checkerVersion, revisionId, revisionContentHash,
 * dependencyHash }`. The Worker evaluated it and the RPC recomputes it from
 * canonical rows, refusing a mismatch (409 `dependency_changed`).
 */
export const AccessibilityBindingInputSchema = z
  .strictObject({
    checkerKey: z.literal(CMS_A11Y_CHECKER_KEY),
    checkerVersion: CmsVersionSchema,
    revisionId: CmsUuidSchema,
    revisionContentHash: CmsHashSchema,
    dependencyHash: CmsHashSchema,
  })
  .readonly();

export type AccessibilityBindingInput = z.infer<
  typeof AccessibilityBindingInputSchema
>;

/**
 * BE03b Accessibility outcome mapping (DEC-150): `healthy` is a `passed` result,
 * `blocked` a `failed` result (`blocking_finding`) and a `failed` run (timeout,
 * dependency failure or unreadable target) an `unavailable` result
 * (`checker_failed`).
 */
export const preflightResultForAccessibilityEvidence = (
  evidence: PreflightEvidence,
): PreflightResult => {
  const base = {
    category: 'accessibility',
    providerKey: evidence.providerKey,
    providerVersion: evidence.providerVersion,
  } as const;
  if (evidence.outcome === 'healthy')
    return { ...base, outcome: 'passed', reasonCode: null, blockingCount: 0 };
  if (evidence.outcome === 'blocked')
    return {
      ...base,
      outcome: 'failed',
      reasonCode: 'blocking_finding',
      blockingCount: evidence.blockingCount,
    };
  return {
    ...base,
    outcome: 'unavailable',
    reasonCode: 'checker_failed',
    blockingCount: evidence.blockingCount,
  };
};

/** True when the evidence was evaluated within 60 seconds of the RPC instant. */
export const cmsPreflightEvidenceIsFresh = (
  evaluatedAt: string,
  nowMs: number,
): boolean => {
  const evaluatedMs = Date.parse(evaluatedAt);
  return (
    Number.isFinite(evaluatedMs) &&
    Math.abs(nowMs - evaluatedMs) <=
      CMS_PREFLIGHT_EVIDENCE_MAX_AGE_SECONDS * 1_000
  );
};
