import { beforeAll } from 'vitest';

import { termActionImporters } from './term-action-view';

/*
 * Importing this file makes the term action form (a chunk that loads when the person opens an action) available to the
 * test file at once: the form tests look at the opened form, not at the load. The proof of the load itself
 * (`cms-on-demand-taxonomy-locale.proof.test.tsx`, `term-action-view.test.tsx`) never imports it.
 */
beforeAll(async () => {
  await termActionImporters.view();
});
