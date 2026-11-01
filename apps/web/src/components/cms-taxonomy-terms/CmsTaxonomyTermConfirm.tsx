import * as React from 'react';

import type { TermFacts } from './taxonomy-terms-read';
import { termName } from './term-names';
import type { TermAction } from './term-action-request';

interface BaseProps {
  readonly target: TermFacts;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onBack: () => void;
}

/** A merge is reviewed only with the survivor it names; a deprecation has none (FE03 :887). */
type Props =
  | (BaseProps & {
      readonly action: Extract<TermAction, 'deprecate'>;
      readonly survivor?: undefined;
    })
  | (BaseProps & {
      readonly action: Extract<TermAction, 'merge'>;
      readonly survivor: TermFacts;
    });

/** The separate review step before an irreversible action (FE03 :887, :1718). */
export default function CmsTaxonomyTermConfirm(
  props: Props,
): React.ReactElement {
  const { target, pending, disabled, onBack } = props;
  const action = props.action;
  return (
    <div
      className="cms-term-confirm"
      role="group"
      aria-labelledby="cms-term-confirm-title"
    >
      <h4 id="cms-term-confirm-title">
        {action === 'merge' ? 'Confirm the merge' : 'Confirm the deprecation'}
      </h4>
      {props.action === 'merge' ? (
        <p>
          Merge {termName(target)} into {termName(props.survivor)}. The retired
          term &ldquo;{target.termKey}&rdquo; redirects permanently to &ldquo;
          {props.survivor.termKey}&rdquo; and every use of it moves there. This
          cannot be undone.
        </p>
      ) : (
        <p>
          Deprecate {termName(target)}. It stays resolvable, but authors can no
          longer choose it, and it cannot be made active again.
        </p>
      )}
      <button type="submit" disabled={pending || disabled}>
        {pending
          ? 'Saving…'
          : action === 'merge'
            ? 'Merge permanently'
            : 'Deprecate permanently'}
      </button>
      <button type="button" disabled={pending} onClick={onBack}>
        Back
      </button>
    </div>
  );
}
