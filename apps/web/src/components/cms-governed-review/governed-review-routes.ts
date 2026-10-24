/**
 * The paths of the governed review surface. They live apart from the command table and the
 * read-only review view so an island or a panel can name them without loading either (FE03 island
 * and initial-route budgets: the table loads with the first form, the view with its own island).
 */

/** The same-origin route base of the governed review resources. */
export const GOVERNED_ROUTE_BASE = '/api/v1/cms/governed-reviews';

/** The definition review queue page; a review is `{queue}/{reviewId}`. */
export const GOVERNED_QUEUE_PATH =
  '/app/cms-content-modeling/definition-reviews';
