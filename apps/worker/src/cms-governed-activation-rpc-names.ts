/**
 * The two database RPCs of CMS-03C-19. The names live apart from the port so the shared async RPC
 * type can list them without importing the port: only the governed activation sweep may import
 * `cms-governed-activation-rpc.ts`.
 */
export const CMS_CLAIM_DUE_GOVERNED_ACTIVATIONS_RPC =
  'cms_claim_due_governed_activations' as const;
export const CMS_EXECUTE_GOVERNED_ACTIVATION_RPC =
  'cms_execute_governed_activation' as const;

export type CmsGovernedActivationRpcName =
  | typeof CMS_CLAIM_DUE_GOVERNED_ACTIVATIONS_RPC
  | typeof CMS_EXECUTE_GOVERNED_ACTIVATION_RPC;
