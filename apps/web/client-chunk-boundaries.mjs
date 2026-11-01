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
export const CLIENT_CORE_CONTRACT_MODULES = Object.freeze([
  '/packages/contracts/src/client.ts',
  '/packages/contracts/src/authentication/return-target.ts',
  '/packages/contracts/src/content-schema-registry/field-rules.ts',
  '/packages/contracts/src/content-schema-registry/locale-canonical.ts',
  '/packages/contracts/src/content-schema-registry/locale-config-rules.ts',
  '/packages/contracts/src/content-schema-registry/route-policy-base.ts',
  '/packages/contracts/src/content-schema-registry/template-binding-messages.ts',
]);

/**
 * The zod-free vocabularies and pure rules only the Slice 11 workflow and review
 * islands use at hydration (the preflight categories, the publication actions,
 * the pinned tz release, the local date-time reader, the assignment bounds and
 * the JSON equality). They own a chunk beside the core one so the registry
 * routes, which load the core chunk and none of these, and the editor routes do
 * not pay for them (AC261, AC-106). Every module imports only modules of this
 * list or the core list, so the chunk can never take part in the cycle above.
 */
export const CLIENT_WORKFLOW_CONTRACT_MODULES = Object.freeze([
  '/packages/contracts/src/cms-editorial/json-equal.ts',
  '/packages/contracts/src/cms-editorial/preflight-categories.ts',
  '/packages/contracts/src/cms-editorial/publication-vocabulary.ts',
  '/packages/contracts/src/cms-editorial/review-assignment-rules.ts',
  '/packages/contracts/src/cms-editorial/time-authority/local-datetime.ts',
  '/packages/contracts/src/cms-editorial/time-authority/tzdb-pin.ts',
]);

/**
 * The zod-free walkers of the structured field values (the rich_text.v1 grammar
 * and the depth-1 object contract), the authored-text predicate and the field
 * pointer reader. Only the entry editor, create and conflict islands validate
 * rich text and read pointers, so they own a chunk of their own: the workflow,
 * review and grant routes, which never touch these rules, do not pay for it
 * (AC-106).
 */
export const CLIENT_EDITOR_CONTRACT_MODULES = Object.freeze([
  '/packages/contracts/src/cms-editorial/field-pointer.ts',
  '/packages/contracts/src/content-schema-registry/structured-values-rules.ts',
  '/packages/contracts/src/content-schema-registry/structured-values-text.ts',
]);

/** Every module of the zod-free browser entry: the core, workflow and editor lists. */
export const CLIENT_SAFE_CONTRACT_MODULES = Object.freeze([
  ...CLIENT_CORE_CONTRACT_MODULES,
  ...CLIENT_WORKFLOW_CONTRACT_MODULES,
  ...CLIENT_EDITOR_CONTRACT_MODULES,
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
 * The pinned tz snapshot of the CMS Time authority (BE03b E8, about 218 KB or
 * 26 KB gzip) and the modules only its subpath reaches. The schedule form
 * imports `@wejammin/contracts/time-authority` dynamically when it opens, so
 * these modules own a lazy chunk instead of the eager `contracts` chunk every
 * protected island loads. The resolver, the pin and the calendar rules are
 * exported from the main barrel and therefore stay eager.
 * `client-chunk-time-authority.test.ts` proves this list is exactly the closure
 * only the subpath reaches.
 */
export const TIME_AUTHORITY_LAZY_CONTRACT_MODULES = Object.freeze([
  '/packages/contracts/src/cms-editorial/time-authority/index.ts',
  '/packages/contracts/src/cms-editorial/time-authority/time-authority.ts',
  '/packages/contracts/src/cms-editorial/time-authority/tzdb-snapshot-data.ts',
  '/packages/contracts/src/cms-editorial/time-authority/tzdb-snapshot.ts',
]);

/**
 * @param {string} id
 * @returns {boolean}
 */
export const isTimeAuthorityLazyModule = (id) =>
  TIME_AUTHORITY_LAZY_CONTRACT_MODULES.some((module) => id.endsWith(module));

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
 * @returns {boolean}
 */
export const isClientCoreContractModule = (id) =>
  CLIENT_CORE_CONTRACT_MODULES.some((module) => id.endsWith(module));

/**
 * @param {string} id
 * @returns {boolean}
 */
export const isClientWorkflowContractModule = (id) =>
  CLIENT_WORKFLOW_CONTRACT_MODULES.some((module) => id.endsWith(module));

/**
 * @param {string} id
 * @returns {boolean}
 */
export const isClientEditorContractModule = (id) =>
  CLIENT_EDITOR_CONTRACT_MODULES.some((module) => id.endsWith(module));

/**
 * @param {string} id
 * @returns {string | undefined}
 */
export const clientChunkFor = (id) => {
  if (id.includes('/node_modules/zod/')) return 'zod';
  if (isTimeAuthorityLazyModule(id)) return 'contracts-time-authority';
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
    test: isClientCoreContractModule,
    priority: 100,
  },
  {
    name: 'contracts-client-workflow',
    test: isClientWorkflowContractModule,
    priority: 100,
  },
  {
    name: 'contracts-client-editor',
    test: isClientEditorContractModule,
    priority: 100,
  },
  { name: clientChunkFor },
]);

/** The Rolldown `output` option the Astro build applies to browser chunks. */
export const clientChunkOutput = {
  codeSplitting: { groups: [...clientChunkGroups] },
};
