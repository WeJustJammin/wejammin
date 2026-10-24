/*
 * The code-owned derived-rule registry `CMS_RELATED_RULES` (BE03c OD-5, "Related-content eligibility
 * and derived rules"; FE03 :1794) as the browser needs it, zod-free (AC261). The version and the
 * reason code are the registry's values and are never typed by a person: `derivedRule.reasonCode` is
 * an equality expectation of the registry value (FE03 :1794). `related-rules.test.ts` is the drift
 * guard against the contract constant.
 */
export const RELATED_RULE_KEYS = ['shared-terms', 'same-type-recent'] as const;
export type RelatedRuleKey = (typeof RELATED_RULE_KEYS)[number];

export interface RelatedRuleMember {
  readonly version: string;
  readonly reasonCode: string;
  readonly label: string;
  readonly explanation: string;
}

export const RELATED_RULES: Readonly<
  Record<RelatedRuleKey, RelatedRuleMember>
> = {
  'shared-terms': {
    version: '1',
    reasonCode: 'shared_terms',
    label: 'Shared terms',
    explanation:
      'Published entries that share the most vocabulary terms with this entry, newest first on a tie.',
  },
  'same-type-recent': {
    version: '1',
    reasonCode: 'same_type_recent',
    label: 'Same type, most recent',
    explanation:
      'Published entries of this entry’s content type, most recently published first.',
  },
};

/** The registry member for `key`, or null for anything else (including inherited names). */
export const ruleByKey = (key: string): RelatedRuleMember | null =>
  (RELATED_RULE_KEYS as readonly string[]).includes(key)
    ? RELATED_RULES[key as RelatedRuleKey]
    : null;
