import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import { ISSUE_COPY, type RequestIssueCode } from './related-content-copy';
import {
  MAX_EXCLUSIONS,
  MAX_PINS,
  type RelatedLists,
} from './related-content-lists';
import { ruleByKey, type RelatedRuleKey } from './related-rules';

export interface RelatedContentFields {
  readonly lists: RelatedLists;
  /** The chosen registry rule, or '' for none. */
  readonly ruleKey: RelatedRuleKey | '';
  /** The raw text of the candidate bound; read only when a rule is chosen. */
  readonly maxCandidates: string;
}

export interface RelatedContentContext {
  readonly entryId: string;
  /** The entry aggregate `version`: the strong `If-Match` and the body `expectedVersion` (BE03c 215). */
  readonly entryVersion: string;
}

export type RequestIssueTarget =
  'pins' | 'exclusions' | 'rule' | 'maxCandidates' | 'form';

export interface RequestIssue {
  readonly code: RequestIssueCode;
  readonly message: string;
  readonly target: RequestIssueTarget;
}

export type RelatedContentBuild =
  | {
      readonly ok: true;
      readonly value: RelatedContentRuleRequest;
      /** The serialized request: the identity of a logical attempt. */
      readonly body: string;
    }
  | { readonly ok: false; readonly issues: RequestIssue[] };

const MAX_CANDIDATES_TEXT = /^[1-9]\d{0,2}$/u;

const issue = (
  code: RequestIssueCode,
  target: RequestIssueTarget,
): RequestIssue => ({
  code,
  message: ISSUE_COPY[code],
  target,
});

const overlaps = (lists: RelatedLists): boolean => {
  const excluded = new Set(lists.exclusions.map((id) => id.toLowerCase()));
  return lists.pins.some((id) => excluded.has(id.toLowerCase()));
};

const ruleIssues = (fields: RelatedContentFields): RequestIssue[] => {
  if (fields.ruleKey === '') return [];
  if (ruleByKey(fields.ruleKey) === null)
    return [issue('rule_unknown', 'rule')];
  const text = fields.maxCandidates.trim();
  if (text === '') return [issue('max_candidates_required', 'maxCandidates')];
  const count = MAX_CANDIDATES_TEXT.test(text) ? Number(text) : 0;
  return count >= 1 && count <= 128
    ? []
    : [issue('max_candidates_range', 'maxCandidates')];
};

/**
 * Client-side preparation of a `RelatedContentRuleRequest` from the form (FE03 :890). It only lets the
 * form name what is wrong before a send: the proxy, the Worker and the database recheck every rule and
 * own capability, the registry, and the eligibility of every target (BE03c 1417), none of which the
 * browser can or does decide.
 */
export const buildRelatedContentRequest = (
  fields: RelatedContentFields,
  context: RelatedContentContext,
): RelatedContentBuild => {
  const issues: RequestIssue[] = [];
  if (!isCmsUuid(context.entryId)) issues.push(issue('entry_invalid', 'form'));
  if (!isCmsVersion(context.entryVersion))
    issues.push(issue('version_invalid', 'form'));
  if (fields.lists.pins.length > MAX_PINS)
    issues.push(issue('pins_limit', 'pins'));
  if (fields.lists.exclusions.length > MAX_EXCLUSIONS)
    issues.push(issue('exclusions_limit', 'exclusions'));
  if (overlaps(fields.lists))
    issues.push(issue('pin_exclusion_overlap', 'pins'));
  issues.push(...ruleIssues(fields));
  if (issues.length > 0) return { ok: false, issues };
  const member = fields.ruleKey === '' ? null : ruleByKey(fields.ruleKey);
  const value: RelatedContentRuleRequest = {
    entryId: context.entryId,
    pins: [...fields.lists.pins],
    exclusions: [...fields.lists.exclusions],
    derivedRule:
      member === null || fields.ruleKey === ''
        ? null
        : {
            key: fields.ruleKey,
            version: member.version,
            reasonCode: member.reasonCode,
            maxCandidates: Number(fields.maxCandidates.trim()),
          },
    expectedVersion: context.entryVersion,
  };
  return { ok: true, value, body: JSON.stringify(value) };
};
