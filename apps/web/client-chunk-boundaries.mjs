/**
 * Keep browser contract schemas and their Zod runtime in dependency chunks.
 * Without this boundary, the production bundler creates a circular src ⇄
 * api-error split; Zod's UUID constructor runs before its chunk initializes
 * and protected React islands never hydrate.
 *
 * @param {string} id
 * @returns {string | undefined}
 */
export const clientChunkFor = (id) => {
  if (id.includes('/node_modules/zod/')) return 'zod';
  if (id.includes('/packages/contracts/src/')) return 'contracts';
  return undefined;
};
