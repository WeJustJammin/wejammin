/**
 * The two protected `platform_api` RPCs of the linked-update scan (BE03c "Linked update", "Job
 * transport"). Both are granted to the Worker service credential alone and appear in no browser
 * route. The names live apart from the port so the shared async RPC type can list them without
 * importing it.
 */
export const CMS_LINKED_SCAN_RPC = {
  /** Rereads a committed pattern activation as the job payload it names. */
  resolveEvent: 'cms_linked_scan_resolve_event',
  /** One bounded run of the job: at most 500 instances after a cursor. */
  run: 'cms_scan_linked_pattern_updates',
} as const;

export type CmsLinkedScanRpcName =
  (typeof CMS_LINKED_SCAN_RPC)[keyof typeof CMS_LINKED_SCAN_RPC];
