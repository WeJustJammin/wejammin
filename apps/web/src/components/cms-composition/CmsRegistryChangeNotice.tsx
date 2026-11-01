import * as React from 'react';

import CmsLoadingRegion from '../cms-editorial-workflow/CmsLoadingRegion';
import type { RegistryReadState } from './registry-read-types';

interface Props {
  readonly state: RegistryReadState;
  /** A 429's stated wait has not elapsed: the read stays off. */
  readonly waiting: boolean;
  readonly onRead: () => void;
}

/**
 * What the automatic read of the designer context after a 409 `block_registry_digest_mismatch` found: the selectors the
 * registry gained and lost, or that it did not change, or why it could not be read (with the control that repeats it).
 * The person's values are never part of this notice.
 *
 * The polite region of the result is always mounted, empty until a read finishes (`state` starts at `none` on every
 * mount), so a screen reader hears the lines when they are written into the node that already exists (review V20 m8).
 */
export default function CmsRegistryChangeNotice({
  state,
  waiting,
  onRead,
}: Props): React.ReactElement {
  return (
    <section aria-label={state.kind === 'none' ? undefined : 'Block registry'}>
      <CmsLoadingRegion
        active={state.kind === 'checking'}
        label="Reading the block choices…"
      />
      <div role="status" aria-live="polite" data-registry-change="">
        {state.kind === 'read' ? state.lines.join(' ') : ''}
      </div>
      {state.kind === 'failed' ? (
        <>
          <p role={state.rateLimited ? 'status' : 'alert'}>{state.message}</p>
          <button type="button" disabled={waiting} onClick={onRead}>
            Read the block choices again
          </button>
        </>
      ) : null}
    </section>
  );
}
