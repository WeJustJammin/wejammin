import * as React from 'react';

export interface CmsWorkflowStatusRegionProps {
  /** The confirmation of the last committed command, or '' when there is none. */
  readonly text: string;
}

/**
 * The island's one persistent polite status line (FE03 "announce status").
 * It is mounted empty with the island, before any command, so assistive
 * technology has registered it when the first confirmation arrives; it belongs
 * to no form, so the canonical refetch that removes a form never removes the
 * confirmation that form produced.
 */
export default function CmsWorkflowStatusRegion({
  text,
}: CmsWorkflowStatusRegionProps): React.ReactElement {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-cms-workflow-status="island"
    >
      {text}
    </p>
  );
}
