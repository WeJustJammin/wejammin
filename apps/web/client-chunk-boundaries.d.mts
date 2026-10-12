export const CLIENT_CORE_CONTRACT_MODULES: readonly string[];
export const CLIENT_WORKFLOW_CONTRACT_MODULES: readonly string[];
export const CLIENT_EDITOR_CONTRACT_MODULES: readonly string[];
export const CLIENT_SAFE_CONTRACT_MODULES: readonly string[];
export const CLIENT_RULE_CONTRACT_MODULES: readonly string[];
export const TIME_AUTHORITY_LAZY_CONTRACT_MODULES: readonly string[];
export function isTimeAuthorityLazyModule(id: string): boolean;
export function isClientSafeContractModule(id: string): boolean;
export function isClientCoreContractModule(id: string): boolean;
export function isClientWorkflowContractModule(id: string): boolean;
export function isClientEditorContractModule(id: string): boolean;
export function isClientRuleContractModule(id: string): boolean;
export function clientChunkFor(id: string): string | undefined;
export const clientChunkGroups: readonly {
  readonly name: string | ((id: string) => string | undefined);
  readonly test?: (id: string) => boolean;
  readonly priority?: number;
}[];
export const clientChunkOutput: {
  readonly codeSplitting: {
    readonly groups: (typeof clientChunkGroups)[number][];
  };
};
