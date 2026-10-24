import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldFrame from './CmsFieldFrame';
import CmsTaxonomyFieldEditor, {
  CMS_TAXONOMY_TERM_IDS_MAX,
} from './CmsTaxonomyFieldEditor';
import type { CmsTaxonomyDescriptor } from './cms-field-descriptor';
import type { CmsFieldIssue } from './cms-field-issue';
import {
  rateLimitedCopy,
  useTaxonomyRead,
  type TaxonomyContextInput,
  type TaxonomyReadNotice,
} from './cms-taxonomy-field-connection';

/*
 * The connected CMS-03C-17 taxonomy field (P2-S12-AC-135; FE03 "Slice 12 governed definition,
 * composition, taxonomy, locale and related-content surfaces"): the presentational
 * CmsTaxonomyFieldEditor over the verified page the selector read returns. The host owns the
 * value, so a read never writes one; the commands below the group are the only controls, and
 * each appears only when it can act.
 */

export interface CmsTaxonomyFieldConnectedProps {
  readonly descriptor: CmsTaxonomyDescriptor;
  readonly context: TaxonomyContextInput;
  readonly value: JsonValue | null;
  readonly issues?: readonly CmsFieldIssue[] | undefined;
  readonly disabled?: boolean | undefined;
  readonly onBlur?: (() => void) | undefined;
  readonly onChange: (value: JsonValue | null) => void;
}

const HINT = 'Select up to ' + String(CMS_TAXONOMY_TERM_IDS_MAX) + ' terms.';
const LOAD_NEXT = 'Load next terms';
const START_AGAIN = 'Start again';
const RETRY = 'Try again';

const COPY = {
  loading: 'Loading terms\u2026',
  empty: 'No vocabulary lists this field',
  signed_out:
    'Your session ended, so these terms cannot be loaded. Sign in again to continue.',
  forbidden: 'You do not have access to these terms.',
  not_found: 'This vocabulary is not available to this account.',
  degraded:
    'These terms could not be loaded right now. Your selection is kept. Try again.',
} as const;

const noticeCopy = (
  notice: TaxonomyReadNotice,
  remainingSeconds: number | null,
): string | null => {
  switch (notice.kind) {
    case 'ready':
      return null;
    case 'rate_limited':
      return rateLimitedCopy(remainingSeconds);
    case 'loading':
      return COPY.loading;
    case 'empty':
      return COPY.empty;
    case 'signed_out':
      return COPY.signed_out;
    case 'forbidden':
      return COPY.forbidden;
    case 'not_found':
      return COPY.not_found;
    case 'degraded':
      return COPY.degraded;
  }
};

const signInHref = (): string =>
  '/auth/sign-in?returnTo=' +
  encodeURIComponent(document.location.pathname + document.location.search);

export default function CmsTaxonomyFieldConnected({
  descriptor,
  context,
  value,
  issues,
  disabled,
  onBlur,
  onChange,
}: CmsTaxonomyFieldConnectedProps): React.ReactElement {
  const read = useTaxonomyRead(descriptor.key, context);
  const copy = noticeCopy(read.notice, read.remainingSeconds);
  const wholeFieldIssues = (issues ?? []).filter(
    (issue) => issue.index === undefined && issue.propertyKey === undefined,
  );
  const status =
    copy === null ? null : (
      <p role="status" aria-live="polite">
        {copy}
        {read.notice.kind === 'signed_out' ? (
          <>
            {' '}
            <a href={signInHref()}>Sign in</a>
          </>
        ) : null}
      </p>
    );
  const commands = (
    <>
      {read.canLoadNext ? (
        <button type="button" disabled={read.waiting} onClick={read.loadNext}>
          {LOAD_NEXT}
        </button>
      ) : null}
      {read.canStartAgain ? (
        <button type="button" disabled={read.waiting} onClick={read.startAgain}>
          {START_AGAIN}
        </button>
      ) : null}
      {read.canRetry ? (
        <button type="button" disabled={read.waiting} onClick={read.retry}>
          {RETRY}
        </button>
      ) : null}
    </>
  );
  const page = read.page;
  if (page === null)
    return (
      <CmsFieldFrame
        field={descriptor}
        mode="legend"
        hint={HINT}
        issues={wholeFieldIssues}
      >
        {() => (
          <>
            {status}
            {commands}
          </>
        )}
      </CmsFieldFrame>
    );
  return (
    <>
      <CmsTaxonomyFieldEditor
        descriptor={descriptor}
        page={page}
        value={value}
        issues={issues}
        disabled={read.stale || disabled === true}
        onBlur={onBlur}
        onChange={onChange}
      />
      {status}
      {commands}
    </>
  );
}
