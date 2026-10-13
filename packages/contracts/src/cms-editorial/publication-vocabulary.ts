/**
 * Zod-free closed vocabularies of the publication lineage (BE03b).
 *
 * The schedule form lists the actions without shipping zod; `workflow-models.ts`
 * builds `PublicationActionSchema` from this tuple, so the form and the contract
 * cannot drift.
 */

/** BE03b publication action vocabulary, shared by schedule and publication rows. */
export const PUBLICATION_ACTIONS = [
  'publish',
  'unpublish',
  'expire',
  'archive',
] as const;
