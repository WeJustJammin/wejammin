import * as React from 'react';

import { sourceReviewCopy } from './locale-variant-copy';
import type { LocaleSourceReviewState } from './use-locale-source-review';

interface Props {
  readonly state: LocaleSourceReviewState;
  readonly pending: boolean;
  readonly onReload: () => void;
  readonly onAdopt: () => void;
}

/**
 * The review gate after a 409: the refetched source text is already shown beside its fields; nothing is
 * adopted (version, source revision and fingerprint) until the person says so, because a fingerprint of the
 * new source stamped onto a translation of the old one would hide its staleness.
 */
export default function CmsLocaleSourceReview({
  state,
  pending,
  onReload,
  onAdopt,
}: Props): React.ReactElement {
  const failure = state.kind === 'failed' || state.kind === 'rate_limited';
  return (
    <div className="cms-locale-review" role="status">
      {state.kind === 'reading' ? (
        <p>Reading the current source… Your translations are kept.</p>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <p>
            The current source is read. Review the source text shown beside the
            fields, then use it.
          </p>
          <button type="button" disabled={pending} onClick={onAdopt}>
            Use the current source
          </button>
        </>
      ) : null}
      {failure ? (
        <>
          <p>{sourceReviewCopy(state)}</p>
          <button type="button" disabled={pending} onClick={onReload}>
            Reload the source
          </button>
        </>
      ) : null}
    </div>
  );
}
