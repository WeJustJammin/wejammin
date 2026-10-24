import type * as React from 'react';

import type CmsEditorialDecisionFormType from './CmsEditorialDecisionForm';
import type CmsEditorialReviewAssignmentFormType from './CmsEditorialReviewAssignmentForm';
import { loadView, loadViewOnIntent } from './cms-lazy-view';

/**
 * The two command forms of the editorial review detail island, each in a chunk of its own (FE03
 * island budget of 35 KB and initial-route budget of 90 KB). The island renders a form only for
 * an action the server permits. The decision form's chunk loads then; the owner-only assignment
 * forms wait for the first pointer, touch, focus or key in their region (`cms-lazy-intent.ts`),
 * like the governed ones, so a reviewer-less owner page does not pay for them in the cold load.
 */
export const DecisionFormView: React.ComponentType<
  React.ComponentProps<typeof CmsEditorialDecisionFormType>
> = await loadView(() => import('./CmsEditorialDecisionForm'));

export const ReviewAssignmentFormView: React.ComponentType<
  React.ComponentProps<typeof CmsEditorialReviewAssignmentFormType>
> = await loadViewOnIntent(
  'review-assignment',
  () => import('./CmsEditorialReviewAssignmentForm'),
);
