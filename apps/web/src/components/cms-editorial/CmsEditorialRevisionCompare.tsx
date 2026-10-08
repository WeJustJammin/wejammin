import type {
  RevisionHistoryChange,
  RevisionHistoryComparisonDomain,
  RevisionHistoryPage,
} from '@wejammin/contracts';
import * as React from 'react';

import CmsEditorialRestoreForm from './CmsEditorialRestoreForm';
import { cmsEditorialReasonMessage } from './cms-editorial-reason-copy';

export interface CmsEditorialRevisionCompareProps {
  readonly compare: RevisionHistoryPage['compare'];
  /** A typed 422 of the comparison read: shown instead of any change list. */
  readonly refusal: 'comparison_too_large' | 'comparison_unavailable' | null;
  readonly entryId: string;
  readonly expectedVersion: string | null;
}

const DOMAINS: readonly RevisionHistoryComparisonDomain[] = [
  'field',
  'block',
  'relation',
];

const LABELS: Readonly<Record<RevisionHistoryComparisonDomain, string>> = {
  field: 'Field',
  block: 'Block',
  relation: 'Relation',
};

const hashText = (hash: string | null): string => hash ?? 'none';

const Row = ({ change }: { readonly change: RevisionHistoryChange }) => {
  // The pointer grammar is normative: /fields/{id}, /blocks/{path},
  // /relations/{fieldId}/{token}. A relation exposes only its keyed token.
  const segments = change.path.split('/');
  const subject =
    change.domain === 'relation'
      ? (segments[2] ?? '')
      : segments.slice(2).join('/');
  return (
    <li>
      {LABELS[change.domain]} <code>{subject}</code>: {change.kind} · Before
      hash: <code>{hashText(change.leftHash)}</code> · After hash:{' '}
      <code>{hashText(change.rightHash)}</code>
      {change.domain === 'relation' ? (
        <>
          {' '}
          · Target token: <code>{segments[3]}</code>
        </>
      ) : null}
    </li>
  );
};

/**
 * The CMS-03B-03 comparison (server-rendered): changes grouped field, block,
 * relation with a polite count, side hashes only, a keyed relation token and
 * never a target identity. The two typed refusals (more than 512 changes, an
 * unresolvable recorded version) are their own states, never a truncated list.
 */
export default function CmsEditorialRevisionCompare({
  compare,
  refusal,
  entryId,
  expectedVersion,
}: CmsEditorialRevisionCompareProps): React.ReactElement | null {
  if (compare === null && refusal === null) return null;
  const heading = (
    <h2 id="history-compare-title" tabIndex={-1}>
      Comparison
    </h2>
  );
  if (refusal !== null || compare === null)
    return (
      <section aria-labelledby="history-compare-title">
        {heading}
        <p role="status">
          {cmsEditorialReasonMessage(refusal) ??
            'These revisions cannot be compared.'}
        </p>
      </section>
    );
  const counts = DOMAINS.map((domain) => ({
    domain,
    members: compare.changes.filter((change) => change.domain === domain),
  })).filter((group) => group.members.length > 0);
  const total = compare.changes.length;
  return (
    <section aria-labelledby="history-compare-title">
      {heading}
      <p role="status" aria-live="polite">
        {total === 0
          ? 'No differences between these revisions.'
          : `${total} ${total === 1 ? 'change' : 'changes'}: ${counts
              .map((group) => `${group.members.length} ${group.domain}`)
              .join(', ')}.`}
      </p>
      {counts.map((group) => (
        <section key={group.domain}>
          <h3>{LABELS[group.domain]} changes</h3>
          <ul>
            {group.members.map((change) => (
              <Row key={change.path} change={change} />
            ))}
          </ul>
        </section>
      ))}
      <CmsEditorialRestoreForm
        compare={compare}
        entryId={entryId}
        expectedVersion={expectedVersion}
      />
    </section>
  );
}
