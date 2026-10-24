import type * as React from 'react';

import type CmsGovernedActivationFormType from './CmsGovernedActivationForm';
import type CmsGovernedAssignmentFormType from './CmsGovernedAssignmentForm';
import type CmsGovernedDecisionFormType from './CmsGovernedDecisionForm';
import { loadViewOnIntent } from '../cms-editorial-workflow/cms-lazy-view';

/**
 * The three command forms of the definition review detail island, each in a chunk of its own
 * (FE03 island budget of 35 KB and initial-route budget of 90 KB). A reader who is offered none of
 * them loads none; `WhenOffered` mounts a form the first time the server offers its action, and its
 * chunk then waits for the first sign of intent in the form's region (`cms-lazy-intent.ts`): its
 * controls stay native and enabled until it has hydrated, what was entered is carried into its
 * state, and a submit pressed before that is held and replayed once. A reviewer offered every action would otherwise fetch
 * all three forms and their command machinery with the page (103 KB against the 90 KB route budget).
 */
export const GovernedDecisionFormView: React.ComponentType<
  React.ComponentProps<typeof CmsGovernedDecisionFormType>
> = await loadViewOnIntent(
  'governed-decision',
  () => import('./CmsGovernedDecisionForm'),
);

export const GovernedAssignmentFormView: React.ComponentType<
  React.ComponentProps<typeof CmsGovernedAssignmentFormType>
> = await loadViewOnIntent(
  'governed-assignment',
  () => import('./CmsGovernedAssignmentForm'),
);

export const GovernedActivationFormView: React.ComponentType<
  React.ComponentProps<typeof CmsGovernedActivationFormType>
> = await loadViewOnIntent(
  'governed-activation',
  () => import('./CmsGovernedActivationForm'),
);
