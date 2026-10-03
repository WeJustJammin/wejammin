import * as React from 'react';

import { STEP_UP_PAGE_HEADINGS } from './step-up-page-headings';
import type { StepUpPageKey } from './step-up-page-headings';

export interface StepUpPageHeadingProps {
  readonly page: StepUpPageKey;
}

/**
 * The one h1 of an auth page. It is `tabindex="-1"` so `focus-page-heading`
 * can move focus to it on route load; it is rendered on the server only.
 */
export default function StepUpPageHeading({
  page,
}: StepUpPageHeadingProps): React.ReactElement {
  const copy = STEP_UP_PAGE_HEADINGS[page];
  return (
    <div className="infra-shell-header">
      <p className="infra-eyebrow">{copy.eyebrow}</p>
      <h1 id="page-title" tabIndex={-1}>
        {copy.heading}
      </h1>
      <p>{copy.description}</p>
    </div>
  );
}
