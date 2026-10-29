import * as React from 'react';

import CmsLoadingRegion from '../cms-editorial-workflow/CmsLoadingRegion';

import CmsBulkUpdatePanel from './CmsBulkUpdatePanel';
import CmsCompositionInstanceList from './CmsCompositionInstanceList';
import CmsCompositionLeaveConfirm from './CmsCompositionLeaveConfirm';
import CmsCompositionStatus from './CmsCompositionStatus';
import CmsPatternInsertForm from './CmsPatternInsertForm';
import CmsPatternUpdateDiff from './CmsPatternUpdateDiff';
import { COMPOSITION_COPY } from './composition-copy';
import {
  useCompositionPage,
  type CompositionPageOptions,
} from './use-composition-page';

/**
 * The composition island (FE03 887, 1072, 1114, 1115; P2-S12-AC-045, AC-269): the insert form with its pattern
 * selector, the instance list and the update diff of the entry's current draft. It renders server-verified data and
 * sends exact requests; authority, eligibility and collisions are the Worker's and the database's.
 */
export default function CmsCompositionPage(
  options: CompositionPageOptions,
): React.ReactElement {
  const page = useCompositionPage(options);
  const { insert, updates, bulk, panel, session } = page;
  return (
    <div className="cms-composition">
      {session.entry.editable ? null : (
        <p className="cms-composition-note">{COMPOSITION_COPY.notEditable}</p>
      )}
      {options.csrfToken.length > 0 ? null : (
        <p className="cms-composition-note">{COMPOSITION_COPY.noSession}</p>
      )}
      {page.guard.pendingHref === null ? null : (
        <CmsCompositionLeaveConfirm
          onStay={page.guard.stay}
          onLeave={page.guard.leaveWithoutSaving}
        />
      )}
      <CmsPatternInsertForm
        page={insert.page}
        selectorState={insert.selectorState}
        fields={insert.fields}
        issues={insert.issues}
        pending={page.busy}
        disabled={page.disabled}
        onChange={insert.change}
        onSubmit={() => void insert.submit()}
        onLoadMore={() => void insert.loadMore()}
      />
      <CmsCompositionStatus status={session.status} />
      <CmsCompositionInstanceList
        rows={session.rows}
        selected={page.selected}
        reviewingId={panel.kind === 'diff' ? panel.diff.instance.id : null}
        busy={page.busy}
        disabled={page.disabled}
        onToggle={page.toggle}
        onReview={(id) => void updates.review(id)}
        onDetach={(id) => void updates.detach(id)}
        onBulkReview={() => void bulk.review()}
        onBulkDetach={() => void bulk.detach()}
      />
      <CmsLoadingRegion
        active={panel.kind === 'loading'}
        label="Reading the update…"
      />
      {panel.kind === 'failed' ? (
        <p role="alert" className="cms-composition-error">
          {panel.message}
        </p>
      ) : null}
      {panel.kind === 'diff' ? (
        <CmsPatternUpdateDiff
          diff={panel.diff}
          choices={panel.choices}
          busy={page.busy}
          disabled={page.disabled}
          onChoose={updates.choose}
          onAccept={() => void updates.accept()}
          onDetach={() => void updates.detach(panel.diff.instance.id)}
          onPlaceNewRoots={(roots) => void updates.placeNewRoots(roots)}
        />
      ) : null}
      {panel.kind === 'bulk' ? (
        <CmsBulkUpdatePanel
          diffs={panel.diffs}
          busy={page.busy}
          disabled={page.disabled}
          onAccept={() => void bulk.accept()}
          onClose={page.close}
        />
      ) : null}
    </div>
  );
}
