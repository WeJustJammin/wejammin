import type { CmsDefinitionVersionState } from '@wejammin/contracts';
import * as React from 'react';

/**
 * One distinct glyph per lifecycle state (FE03 "Lifecycle is text and icon"). The icon is decorative: the adjacent text
 * names the state, so the svg is hidden from assistive technology and never the only signal. Every glyph differs in shape,
 * not only in colour, and inherits the text colour.
 */
const GLYPH: Readonly<Record<CmsDefinitionVersionState, React.ReactElement>> = {
  draft: <path d="M3 13l1-4 7-7 3 3-7 7z" />,
  review: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5v3l2 1" />
    </>
  ),
  approved: <path d="M3 8.5l3.5 3.5L13 4" />,
  scheduled: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" />
      <path d="M2.5 7h11M5.5 2v3M10.5 2v3" />
    </>
  ),
  active: <circle cx="8" cy="8" r="4" fill="currentColor" />,
  superseded: <path d="M3 8h10M9 4l4 4-4 4" />,
  retired: <path d="M4 4l8 8M12 4l-8 8" />,
  blocked: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M4.5 11.5l7-7" />
    </>
  ),
};

export default function CmsGovernedLifecycleIcon({
  state,
}: {
  readonly state: CmsDefinitionVersionState;
}): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-lifecycle-icon={state}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPH[state]}
    </svg>
  );
}
