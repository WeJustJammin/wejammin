import * as React from 'react';

import type { CandidatePage } from './related-candidates';
import CmsRelatedCandidates from './CmsRelatedCandidates';
import CmsRelatedConflictReview from './CmsRelatedConflictReview';
import CmsRelatedExclusionList from './CmsRelatedExclusionList';
import CmsRelatedPinList from './CmsRelatedPinList';
import CmsRelatedRuleFields from './CmsRelatedRuleFields';
import CmsRelatedStatus from './CmsRelatedStatus';
import type { fetchCandidatePage } from './related-candidates';
import type { submitRelatedContent } from './related-content-submit';
import type {
  RelatedEntryFacts,
  RelatedRuleSnapshot,
} from './related-content-types';
import { useRelatedContentForm } from './use-related-content-form';

export interface CmsRelatedContentFormProps {
  readonly entry: RelatedEntryFacts;
  /** The stored rule the form starts from (`cmsRelatedContentRead`); an empty rule when none is active. */
  readonly rule: RelatedRuleSnapshot;
  /** The first page of readable entries, as the server verified it. */
  readonly candidates: CandidatePage;
  /** The page's own path: sign-in and reload links return to it. */
  readonly returnTo: string;
  readonly csrfToken: string;
  /** Seams for a test. */
  readonly submit?: typeof submitRelatedContent;
  readonly loadPage?: typeof fetchCandidatePage;
}

const rowSet = (
  rows: readonly { readonly list: string; readonly index: number }[],
  list: 'pins' | 'exclusions',
): ReadonlySet<number> =>
  new Set(rows.filter((row) => row.list === list).map((row) => row.index));

/**
 * Pin, exclude and choose a derived rule for one entry (CMS-03C-05, FE03 :890). Everything is form
 * state: pins and exclusions never reach the URL. A save replaces the whole stored set (BE03c 1417), so the
 * form starts from the stored rule the page read (DEC-195) and every stored item is sent unless the person
 * removes it; an id the person cannot open is labelled as an unavailable entry and kept.
 */
export default function CmsRelatedContentForm(
  props: CmsRelatedContentFormProps,
): React.ReactElement {
  const { entry, rule, candidates, returnTo, csrfToken } = props;
  const form = useRelatedContentForm({
    entry,
    rule,
    candidates,
    csrfToken,
    submit: props.submit,
    loadPage: props.loadPage,
  });
  const issues = form.status.kind === 'invalid' ? form.status.issues : [];
  const maxIssue =
    issues.find((issue) => issue.target === 'maxCandidates')?.message ?? null;
  return (
    <form
      className="cms-related-content"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <dl className="cms-related-facts">
        <div>
          <dt>Entry</dt>
          <dd>
            <code>{entry.entryId}</code>
          </dd>
        </div>
        <div>
          <dt>Locale</dt>
          <dd>{entry.locale}</dd>
        </div>
        <div>
          <dt>Entry version</dt>
          <dd>{form.version}</dd>
        </div>
      </dl>
      <p aria-live="polite" className="cms-related-live">
        {form.note}
      </p>
      <CmsRelatedStatus status={form.status} returnTo={returnTo} />
      {form.conflict.required ? (
        <CmsRelatedConflictReview
          state={form.conflict.state}
          waiting={form.conflict.waiting}
          pending={form.pending}
          reapplyBlocked={form.reapplyBlocked}
          returnTo={returnTo}
          onReview={() => void form.review()}
          onReapply={() => void form.reapply()}
        />
      ) : null}
      <CmsRelatedPinList
        pins={form.lists.pins}
        factsOf={form.factsOf}
        isUnavailable={form.isUnavailable}
        refused={rowSet(form.rows, 'pins')}
        onMove={form.move}
        onRemove={form.unpin}
      />
      <CmsRelatedExclusionList
        exclusions={form.lists.exclusions}
        factsOf={form.factsOf}
        isUnavailable={form.isUnavailable}
        refused={rowSet(form.rows, 'exclusions')}
        onRemove={form.unexclude}
      />
      <CmsRelatedCandidates
        items={form.candidates.items}
        lists={form.lists}
        hasMore={form.candidates.nextCursor !== null}
        note={form.candidates.note}
        waitSeconds={form.candidates.waitSeconds}
        waiting={form.candidates.waiting}
        returnTo={returnTo}
        onPin={form.pin}
        onExclude={form.exclude}
        onLoadMore={() => void form.candidates.loadMore()}
      />
      <CmsRelatedRuleFields
        ruleKey={form.ruleKey}
        maxCandidates={form.maxCandidates}
        maxIssue={maxIssue}
        boundUnknown={form.boundUnknown}
        onRule={form.chooseRule}
        onMax={form.setMaxCandidates}
      />
      <div className="cms-related-submit">
        <button type="submit" disabled={form.pending || form.blocked}>
          {form.pending ? 'Saving…' : 'Save related content'}
        </button>
        {csrfToken.length === 0 ? (
          <p className="cms-related-error">
            Saving is unavailable because this page has no security token.
            Reload the page.
          </p>
        ) : null}
        {form.rateWaiting ? (
          <p role="status">Waiting before you can save again.</p>
        ) : null}
      </div>
    </form>
  );
}
