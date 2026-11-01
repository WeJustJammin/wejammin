/**
 * The BE00 job type and database RPC of the taxonomy merge convergence (BE03c 1334, 1351, 1377; lane taxonomy-terms
 * f2). The names live apart from the effect so the shared async RPC type can list the RPC without importing the effect:
 * only `cms-taxonomy-merge-converge-effect.ts` may call it.
 */
export const CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE =
  'cms.taxonomy.merge_converge' as const;
export const CMS_RUN_TAXONOMY_MERGE_CONVERGE_RPC =
  'cms_run_taxonomy_merge_converge' as const;

export type CmsTaxonomyMergeConvergeRpcName =
  typeof CMS_RUN_TAXONOMY_MERGE_CONVERGE_RPC;

/**
 * The BE00 job error codes this effect may write (`^[A-Z][A-Z0-9_]{0,63}$`); the registered vocabulary of this job type
 * is the BE03c section "Merge convergence Job disposition" (BE00 233, 554, 571), repeated in the runbook
 * `docs/runbooks/platform/cms-taxonomy-merge-converge.md`; a test keeps the three identical. The job is NEVER answered `queued`: the redelivery of an ordinary job carries the envelope version of its
 * creation, which the generic dispatch skips as stale once the claim advanced the job, so a re-queued job would be
 * parked for good. A transient fault is retried inside the invocation (15 s, 60 s pauses) and, if it persists, settles
 * the job `failed`. The unconverged assignments stay resolvable through the retired term's redirect (BE03c 1377) and
 * the bounded recovery sweep (owner decision DEC-194, `cms-taxonomy-merge-reconcile-sweep.ts`) re-requests a fresh
 * job for the acting party: at most one per 15 minutes and not after 3 consecutive failed generations.
 */
export const TAXONOMY_MERGE_JOB_ERROR = {
  claimInvalid: 'MERGE_CONVERGE_CLAIM_INVALID',
  requestInvalid: 'MERGE_CONVERGE_REQUEST_INVALID',
  jobUnknown: 'MERGE_CONVERGE_JOB_UNKNOWN',
  conflict: 'MERGE_CONVERGE_CONFLICT',
  capabilityMissing: 'CAPABILITY_MISSING',
  unavailable: 'DEPENDENCY_UNAVAILABLE',
  invalidResponse: 'DEPENDENCY_INVALID_RESPONSE',
  unmapped: 'MERGE_CONVERGE_OUTCOME_UNMAPPED',
} as const;

/** The canonical UUID grammar of a BE00 job result reference (`job-status.ts`). */
export const CANONICAL_JOB_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
