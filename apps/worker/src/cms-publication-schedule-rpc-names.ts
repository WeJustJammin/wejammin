/**
 * The two database RPCs of CMS-03B-20. The names live apart from the port so
 * the shared async RPC type can list them without importing the port: only the
 * scheduled sweep may import `cms-publication-schedule-rpc.ts`.
 */
export const CMS_CLAIM_DUE_SCHEDULES_RPC =
  'cms_claim_due_publication_schedules' as const;
export const CMS_EXECUTE_SCHEDULE_RPC =
  'cms_execute_publication_schedule' as const;

export type CmsPublicationScheduleRpcName =
  typeof CMS_CLAIM_DUE_SCHEDULES_RPC | typeof CMS_EXECUTE_SCHEDULE_RPC;
