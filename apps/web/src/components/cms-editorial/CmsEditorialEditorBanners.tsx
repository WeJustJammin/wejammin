import * as React from 'react';

import { cmsEditorialAppConflictPath } from './cms-editorial-app-routes';
import CmsEditorialSyncConflict from './CmsEditorialSyncConflict';
import type {
  CmsEditorialEditorState,
  CmsEditorialEntryEditorInit,
} from './cms-editorial-entry-editor-state';

export interface CmsEditorialEditorBannersProps {
  readonly init: CmsEditorialEntryEditorInit;
  readonly state: CmsEditorialEditorState;
  /** Where the author returns after signing in again. */
  readonly signInHref: string;
  /** The current page, to open the other session's version beside this one. */
  readonly currentHref: string;
  readonly alertRef: React.RefObject<HTMLDivElement | null>;
  readonly onDiscardAndLoad: () => void;
}

/**
 * Everything the editor says besides its fields: the durable open-conflict
 * banner with its link, the sync-conflict alert (focused, nothing overwritten,
 * unsent edits kept), the sign-in and revoked-authority states, and the
 * read-only reason. Each message is fixed copy; none comes from a response.
 */
export default function CmsEditorialEditorBanners({
  init,
  state,
  signInHref,
  currentHref,
  alertRef,
  onDiscardAndLoad,
}: CmsEditorialEditorBannersProps): React.ReactElement {
  const conflictPath =
    state.openConflict === null
      ? null
      : cmsEditorialAppConflictPath(
          init.entryId,
          state.openConflict.conflictId,
        );
  return (
    <>
      {init.lifecycle === 'active' ? null : (
        <p role="note">
          This entry is {init.lifecycle.replaceAll('_', ' ')} and cannot be
          edited.
        </p>
      )}
      {conflictPath === null ? null : (
        <section aria-labelledby="cms-editorial-open-conflict">
          <h2 id="cms-editorial-open-conflict">
            This entry has an open conflict
          </h2>
          <p>
            Two versions changed the same field. Choose what to keep before
            publishing.
          </p>
          <p>
            <a href={conflictPath}>Resolve the conflict</a>
          </p>
        </section>
      )}
      <div
        ref={alertRef}
        tabIndex={-1}
        role={state.alert ? 'alert' : undefined}
      >
        {state.syncConflict === null ? null : (
          <CmsEditorialSyncConflict
            headingId="cms-editorial-sync-conflict"
            expectedVersion={state.syncConflict.expectedVersion}
            currentVersion={state.syncConflict.currentVersion}
            unsentChangeCount={state.unsentCount}
          />
        )}
        {state.phase === 'sync-conflict' ? (
          <p>
            {state.syncConflict === null ? `${state.message} ` : null}
            <a href={currentHref} target="_blank" rel="noopener">
              Open the current version in a new tab
            </a>{' '}
            <button type="button" onClick={onDiscardAndLoad}>
              Discard my changes and load the current version
            </button>
          </p>
        ) : null}
        {state.phase === 'unauthenticated' ? (
          <p>
            {state.message}{' '}
            <a href={signInHref} target="_blank" rel="noopener">
              Sign in again
            </a>{' '}
            (opens in a new tab; then choose Save draft here)
          </p>
        ) : state.alert &&
          state.syncConflict === null &&
          state.phase !== 'sync-conflict' ? (
          <p>{state.message}</p>
        ) : null}
      </div>
    </>
  );
}
