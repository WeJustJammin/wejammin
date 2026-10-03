export const CLIENT_SAFE_CONTRACT_MODULES: readonly string[];
export const CLIENT_RULE_CONTRACT_MODULES: readonly string[];
export function isClientSafeContractModule(id: string): boolean;
export function isClientRuleContractModule(id: string): boolean;
export function clientChunkFor(id: string): string | undefined;
export const clientChunkGroups: readonly {
  readonly name: string | ((id: string) => string | undefined);
  readonly test?: (id: string) => boolean;
  readonly priority?: number;
}[];
