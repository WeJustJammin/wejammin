import * as React from 'react';

import { useCmsEditorialLeaveGuard } from '../cms-editorial/use-cms-editorial-leave-guard';
import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import CmsTaxonomyTermFilter, { FILTER_LABEL } from './CmsTaxonomyTermFilter';
import CmsTaxonomyTermLeaveConfirm from './CmsTaxonomyTermLeaveConfirm';
import CmsTaxonomyTermStatus from './CmsTaxonomyTermStatus';
import CmsTaxonomyTermTable from './CmsTaxonomyTermTable';
import LazyTermAction from './term-action-view';
import type { TermLifecycle, TermsPageFacts } from './taxonomy-terms-read';
import { useTermForm, type TermFormOptions } from './use-term-form';
import {
  useTermList,
  type ActiveVersion,
  type TermListOptions,
} from './use-term-list';

export interface CmsTaxonomyTermFormProps {
  readonly vocabulary: {
    readonly taxonomyId: string;
    readonly taxonomyKey: string;
    readonly shape: TaxonomyShape;
    /** The vocabulary's active version; null when none is active. */
    readonly active: ActiveVersion | null;
    /** No active version was found in a full read of the newest 50 versions (BE03c 406). */
    readonly versionsBounded?: boolean | undefined;
  };
  /** The page of terms as the server rendered it. */
  readonly terms: TermsPageFacts;
  /** The URL state the page was served for (FE03 :1068). */
  readonly query: {
    readonly lifecycle: TermLifecycle | null;
    readonly cursor: string | null;
  };
  /** The vocabulary page path: filter and pager links stay on it. */
  readonly basePath: string;
  /** The vocabulary's governed review (the owned queue when no review is known). */
  readonly reviewHref: string;
  readonly csrfToken: string;
  /** Seams for a test. */
  readonly submit?: TermFormOptions['submit'];
  readonly readTerms?: TermListOptions['readTerms'];
  readonly readVersions?: TermListOptions['readVersions'];
  readonly replaceUrl?: TermListOptions['replaceUrl'];
  /** Leaves this page for a destination the person confirmed. */
  readonly navigate?: (href: string) => void;
}

const defaultNavigate = (href: string): void => {
  if (typeof window !== 'undefined') window.location.assign(href);
};

const defaultReplaceUrl =
  (basePath: string) =>
  (lifecycle: TermLifecycle | null): void => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(
      null,
      '',
      lifecycle === null ? basePath : `${basePath}?lifecycle=${lifecycle}`,
    );
  };

/**
 * The vocabulary's terms and their actions (FE03 :887): the curator's list from
 * `cmsTaxonomyTermsRead` and the create, rename, alias, deprecate and merge forms of
 * CMS-03C-03. Actions exist only against an `active` version; the list is refetched after
 * every action, and the cursor and filter are URL state.
 */
export default function CmsTaxonomyTermForm(
  props: CmsTaxonomyTermFormProps,
): React.ReactElement {
  const { vocabulary, query, basePath, reviewHref, csrfToken } = props;
  const list = useTermList({
    taxonomyId: vocabulary.taxonomyId,
    initialPage: props.terms,
    initialActive: vocabulary.active,
    initialBounded: vocabulary.versionsBounded,
    lifecycle: query.lifecycle,
    cursor: query.cursor,
    replaceUrl: props.replaceUrl ?? defaultReplaceUrl(basePath),
    readTerms: props.readTerms,
    readVersions: props.readVersions,
  });
  const failed = list.notice.kind === 'failed';
  const term = useTermForm({
    taxonomyId: vocabulary.taxonomyId,
    shape: vocabulary.shape,
    active: failed ? null : list.active,
    csrfToken,
    refresh: list.refresh,
    submit: props.submit,
  });
  // FE03 "Unsaved changes": the draft stays while the person decides, an inline confirmation guards in-app links and
  // `beforeunload` is armed only while the open form holds unsent input. There is no autosave, so the only exits are
  // keeping the draft or the explicit discard.
  const guard = useCmsEditorialLeaveGuard({
    active: term.dirty,
    save: async () => undefined,
    stillUnsent: () => true,
    navigate: props.navigate ?? defaultNavigate,
  });
  const canAct = list.active !== null && !failed;
  const issues = term.status.kind === 'invalid' ? term.status.issues : [];
  const pageLink = (cursor: string | null): string => {
    const search = new URLSearchParams();
    if (query.lifecycle !== null) search.set('lifecycle', query.lifecycle);
    if (cursor !== null) search.set('cursor', cursor);
    return search.size === 0 ? basePath : `${basePath}?${search}`;
  };
  return (
    <section
      className="cms-taxonomy-terms"
      aria-labelledby="cms-terms-title"
      onClickCapture={guard.onClickCapture}
    >
      <h2 id="cms-terms-title">Terms</h2>
      {guard.pendingHref === null ? null : (
        <CmsTaxonomyTermLeaveConfirm
          onStay={guard.stay}
          onLeave={guard.leaveWithoutSaving}
        />
      )}
      {list.active === null ? (
        <p role="status">
          {list.bounded
            ? 'No active version was found among the newest 50 versions of this vocabulary. Older versions are not searched, so its terms are listed read-only.'
            : 'This vocabulary has no active version, so its terms cannot change. They are listed read-only.'}{' '}
          <a href={reviewHref}>Open the vocabulary&apos;s governed review</a>
        </p>
      ) : (
        <p>Term actions run under the active version, {list.active.version}.</p>
      )}
      {failed ? (
        <p role="alert">
          The list could not be refreshed, so the last verified list is shown
          and term actions are off.{' '}
          <button
            type="button"
            disabled={list.refreshing}
            onClick={() => void list.refresh()}
          >
            {list.refreshing ? 'Refreshing…' : 'Refresh the list'}
          </button>
        </p>
      ) : null}
      {list.notice.kind === 'restarted' ? (
        <p role="status">
          The list changed while you were paging, so it restarted from the first
          page.
        </p>
      ) : null}
      <CmsTaxonomyTermFilter basePath={basePath} lifecycle={query.lifecycle} />
      <CmsTaxonomyTermStatus
        status={term.status}
        terms={list.page.items}
        reviewHref={reviewHref}
        returnTo={basePath}
      />
      {canAct ? (
        <button
          type="button"
          onClick={(event) => term.open('create', null, event.currentTarget)}
        >
          Create a term
        </button>
      ) : null}
      {term.form === null ? null : (
        <LazyTermAction
          form={term.form}
          shape={vocabulary.shape}
          taxonomyId={vocabulary.taxonomyId}
          terms={list.page.items}
          pageComplete={
            query.lifecycle === null &&
            list.cursor === null &&
            list.page.nextCursor === null
          }
          readTerms={props.readTerms}
          issues={issues}
          pending={term.pending}
          disabled={term.blocked}
          onChange={term.edit}
          onSubmit={() => void term.onSubmit()}
          onCancel={term.close}
          shouldTakeFocus={term.focusIsAtTrigger}
        />
      )}
      <p aria-live="polite">
        {list.page.items.length}{' '}
        {list.page.items.length === 1 ? 'term' : 'terms'} on this page
        {query.lifecycle === null
          ? ''
          : ` (${FILTER_LABEL[query.lifecycle].toLowerCase()} only)`}
        .
      </p>
      <CmsTaxonomyTermTable
        terms={list.page.items}
        taxonomyKey={vocabulary.taxonomyKey}
        canAct={canAct}
        onAction={(action, target, trigger) =>
          term.open(action, target, trigger)
        }
      />
      <nav aria-label="Term pages" className="cms-term-pager">
        {list.cursor === null ? null : <a href={pageLink(null)}>First page</a>}
        {list.page.nextCursor === null ? null : (
          <a href={pageLink(list.page.nextCursor)}>Next page of terms</a>
        )}
      </nav>
    </section>
  );
}
