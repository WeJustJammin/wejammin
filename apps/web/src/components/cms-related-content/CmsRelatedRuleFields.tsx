import * as React from 'react';

import { SAVED_BOUND_UNKNOWN } from './related-content-copy';
import {
  RELATED_RULES,
  RELATED_RULE_KEYS,
  type RelatedRuleKey,
} from './related-rules';

export const RULE_NONE_ID = 'cms-related-rule-none';
export const MAX_CANDIDATES_ID = 'cms-related-max-candidates';

interface Props {
  readonly ruleKey: RelatedRuleKey | '';
  readonly maxCandidates: string;
  /** The message of a problem with the bound, or null. */
  readonly maxIssue: string | null;
  /** The stored rule is shown without its bound (DEC-195): say so beside the field. */
  readonly boundUnknown: boolean;
  readonly onRule: (key: RelatedRuleKey | '') => void;
  readonly onMax: (text: string) => void;
}

/** The derived rule (FE03 :1794): chosen from the registry; version and reason are never typed. */
export default function CmsRelatedRuleFields({
  ruleKey,
  maxCandidates,
  maxIssue,
  boundUnknown,
  onRule,
  onMax,
}: Props): React.ReactElement {
  return (
    <fieldset className="cms-related-rule">
      <legend>Derived rule</legend>
      <p>
        A rule adds more related entries after the pins. It only chooses
        published entries, and excluded entries are always removed.
      </p>
      <label className="cms-related-choice">
        <input
          type="radio"
          id={RULE_NONE_ID}
          name="cms-related-rule"
          checked={ruleKey === ''}
          onChange={() => onRule('')}
        />
        No derived rule
      </label>
      {RELATED_RULE_KEYS.map((key) => (
        <label key={key} className="cms-related-choice">
          <input
            type="radio"
            name="cms-related-rule"
            checked={ruleKey === key}
            onChange={() => onRule(key)}
          />
          {RELATED_RULES[key].label}
          <small>{RELATED_RULES[key].explanation}</small>
        </label>
      ))}
      {ruleKey === '' ? null : (
        <div className="cms-related-field">
          <label htmlFor={MAX_CANDIDATES_ID}>
            Most entries the rule may choose (1 to 128)
          </label>
          <input
            id={MAX_CANDIDATES_ID}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={maxCandidates}
            aria-invalid={maxIssue === null ? undefined : true}
            aria-describedby={
              [
                boundUnknown ? `${MAX_CANDIDATES_ID}-hint` : null,
                maxIssue === null ? null : `${MAX_CANDIDATES_ID}-error`,
              ]
                .filter((id) => id !== null)
                .join(' ') || undefined
            }
            onChange={(event) => onMax(event.target.value)}
          />
          {boundUnknown ? (
            <p id={`${MAX_CANDIDATES_ID}-hint`} className="cms-related-note">
              {SAVED_BOUND_UNKNOWN}
            </p>
          ) : null}
          {maxIssue === null ? null : (
            <p id={`${MAX_CANDIDATES_ID}-error`} className="cms-related-error">
              {maxIssue}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
