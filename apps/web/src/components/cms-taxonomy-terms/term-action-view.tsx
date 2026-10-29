import * as React from 'react';

import { retryable } from '../../lib/retryable-import';
import { createOnDemandView } from '../cms-editorial-workflow/cms-on-demand-view';
import type CmsTaxonomyTermAction from './CmsTaxonomyTermAction';

/**
 * The term action form is client state: nothing of it is in the served page, and it exists only after the person
 * pressed Create a term or a table action (`term.form !== null`). Its fields, review step and parent choices are
 * therefore a chunk of their own that loads on that press, not part of the cold load of the vocabulary route
 * (FE03 "Performance budgets and loading strategy"; P2-S11-AC-106). A chunk that cannot be fetched keeps the page and
 * offers the load again (`retryableLazy`); a load slower than 250 ms shows the loading state (P2-S12-AC-271).
 */
export type TermActionProps = React.ComponentProps<
  typeof CmsTaxonomyTermAction
>;

/** The seam a test replaces: the dynamic import of the form. */
export const termActionImporters = {
  view: retryable(() => import('./CmsTaxonomyTermAction')),
};

export const TERM_ACTION_LOADING_COPY = 'Loading the term form\u2026';

type Loader = () => Promise<{
  readonly default: React.ComponentType<TermActionProps>;
}>;

/** A view of the form over `load`: one lazy component for the life of the island, so a form opened again renders at once. */
export const createLazyTermAction = (
  load: Loader,
): ((props: TermActionProps) => React.ReactElement) =>
  createOnDemandView<TermActionProps>(load, TERM_ACTION_LOADING_COPY);

/** The form of one term action, fetched when first opened. */
export default createLazyTermAction(() => termActionImporters.view());
