import type * as React from 'react';

import type CmsGovernedSubmitFormType from './CmsGovernedSubmitForm';
import { loadViewOnIntent } from '../cms-editorial-workflow/cms-lazy-view';

/**
 * The submit form of the bounded governed panel, in a chunk of its own (FE03 island budget of
 * 35 KB and initial-route budget of 90 KB on the pattern, taxonomy and template pages, which
 * also hydrate a designer). `WhenOffered` mounts it the first time the subject is a draft, and the
 * chunk (the whole command machinery) then waits for the first sign of intent in the form's region
 * (`cms-lazy-intent.ts`): the form is a button with no field, so a submit pressed before the
 * chunk arrives is held and replayed once the form has hydrated.
 */
export const GovernedSubmitFormView: React.ComponentType<
  React.ComponentProps<typeof CmsGovernedSubmitFormType>
> = await loadViewOnIntent(
  'governed-submit',
  () => import('./CmsGovernedSubmitForm'),
);
