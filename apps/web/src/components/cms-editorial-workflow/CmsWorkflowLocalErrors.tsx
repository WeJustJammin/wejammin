import * as React from 'react';

import type { WorkflowLocalError } from './CmsWorkflowCommandFrame';

export interface CmsWorkflowLocalErrorsProps {
  readonly errors: readonly WorkflowLocalError[];
  readonly focusRef: React.RefObject<HTMLDivElement | null>;
}

/** Field errors found before anything was sent; they take focus as one alert. */
export default function CmsWorkflowLocalErrors({
  errors,
  focusRef,
}: CmsWorkflowLocalErrorsProps): React.ReactElement | null {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      ref={focusRef}
      data-cms-workflow-local-errors=""
    >
      <p>Check these fields before continuing.</p>
      <ul>
        {errors.map((error) => (
          <li key={error.id}>
            <a href={`#${error.id}`}>{error.label}</a>: {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
