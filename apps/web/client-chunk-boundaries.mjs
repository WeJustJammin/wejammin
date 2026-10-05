/**
 * Keep browser contract schemas and their Zod runtime in dependency chunks.
 * Without this boundary, the production bundler creates a circular src ⇄
 * api-error split; Zod's UUID constructor runs before its chunk initializes
 * and protected React islands never hydrate.
 *
 * The zod-free browser entry of the contracts (`client.ts`) and the modules it
 * re-exports are the exception: they own a `contracts-client` chunk so a
 * protected island that needs one constant or pure rule never loads the
 * zod-carrying `contracts` chunk with it (AC261). These modules import only
 * each other, so the chunk can never take part in the cycle above.
 * `client-chunk-boundaries.test.ts` proves this list is exactly the static
 * closure of `client.ts`.
 */
export const CLIENT_SAFE_CONTRACT_MODULES = Object.freeze([
  '/packages/contracts/src/client.ts',
  '/packages/contracts/src/authentication/return-target.ts',
  '/packages/contracts/src/content-schema-registry/field-rules.ts',
  '/packages/contracts/src/content-schema-registry/locale-canonical.ts',
  '/packages/contracts/src/content-schema-registry/locale-config-rules.ts',
  '/packages/contracts/src/content-schema-registry/route-policy-base.ts',
  '/packages/contracts/src/content-schema-registry/template-binding-messages.ts',
]);

/**
 * The registry field syntax rules are used only by the lazily loaded command
 * enhancement (blur feedback), so they must not ride in the chunk the islands
 * load at hydration.
 */
export const CLIENT_RULE_CONTRACT_MODULES = Object.freeze([
  '/packages/contracts/src/content-schema-registry/field-rules.ts',
]);

/**
 * @param {string} id
 * @returns {boolean}
 */
export const isClientRuleContractModule = (id) =>
  CLIENT_RULE_CONTRACT_MODULES.some((module) => id.endsWith(module));

/**
 * @param {string} id
 * @returns {boolean}
 */
export const isClientSafeContractModule = (id) =>
  CLIENT_SAFE_CONTRACT_MODULES.some((module) => id.endsWith(module));

/**
 * @param {string} id
 * @returns {string | undefined}
 */
export const clientChunkFor = (id) => {
  if (id.includes('/node_modules/zod/')) return 'zod';
  if (id.includes('/packages/contracts/src/')) return 'contracts';
  return undefined;
};

/**
 * Rolldown code-splitting groups. The zod-free group is declared with the
 * higher priority, so it claims its modules (and, as its dependency closure is
 * zod-free, only those) before the zod carrying `contracts` group, which
 * includes its dependencies to avoid circular chunks, can pull them into
 * itself.
 */
export const clientChunkGroups = Object.freeze([
  {
    name: 'contracts-client-rules',
    test: isClientRuleContractModule,
    priority: 110,
  },
  {
    name: 'contracts-client',
    test: isClientSafeContractModule,
    priority: 100,
  },
  { name: clientChunkFor },
]);

/** The Rolldown `output` option the Astro build applies to browser chunks. */
export const clientChunkOutput = {
  codeSplitting: { groups: [...clientChunkGroups] },
};
