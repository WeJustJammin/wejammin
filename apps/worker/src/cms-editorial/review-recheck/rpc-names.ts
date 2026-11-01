/**
 * The two protected `platform_api` RPCs of the dependency recheck (BE03b "Review
 * invalidation / Dependency recheck"). Both are granted to the Worker service
 * credential alone and appear in no browser route. The names live apart from
 * the port so the shared async RPC type can list them without importing it.
 */
export const CMS_REVIEW_RECHECK_RPC = {
  /** Rereads a committed source event as the dependency index lookup it names. */
  resolveEvent: 'cms_dependency_recheck_resolve_event',
  /** One bounded run of the job: at most 500 live reviews after a cursor. */
  run: 'cms_dependency_recheck_run',
} as const;

export type CmsReviewRecheckRpcName =
  (typeof CMS_REVIEW_RECHECK_RPC)[keyof typeof CMS_REVIEW_RECHECK_RPC];
