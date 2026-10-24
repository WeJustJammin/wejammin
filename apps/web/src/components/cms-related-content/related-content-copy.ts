/*
 * Fixed copy of the related-content form. Every refusal of a target is ONE message that never says
 * why (FE03 :890, :2665, BE03c 1417: a write must never be an existence oracle), so the text here is
 * the only text the form can show for it; nothing is taken from a response.
 */
export const TARGET_REFUSED_MESSAGE =
  'This entry cannot be used for related content. Remove it and save again.';

export const EXCLUSIONS_WIN_NOTE =
  'Exclusions win. An entry that is excluded is never shown as related, even if it is also pinned or chosen by the rule. Excluding a pinned entry removes its pin.';

/**
 * DEC-195: the label detail of a stored target the person cannot open. It states no reason, so the read is no
 * existence oracle, and says what the form will do with it.
 */
export const UNAVAILABLE_ENTRY_NOTE =
  'You cannot open this entry. It stays in the rule until you remove it, and saving may refuse it.';

/** DEC-195: the read names the derived rule without its bound, so the form asks for the bound again. */
export const SAVED_BOUND_UNKNOWN =
  'The saved bound is not shown on this page. Enter how many entries the rule may choose, then save.';

export type RequestIssueCode =
  | 'entry_invalid'
  | 'version_invalid'
  | 'pins_limit'
  | 'exclusions_limit'
  | 'pin_exclusion_overlap'
  | 'rule_unknown'
  | 'max_candidates_required'
  | 'max_candidates_range';

export const ISSUE_COPY: Readonly<Record<RequestIssueCode, string>> = {
  entry_invalid: 'This entry address is not valid. Reload the page.',
  version_invalid: 'The entry version is not valid. Reload the page.',
  pins_limit: 'Pin at most 32 entries.',
  exclusions_limit: 'Exclude at most 64 entries.',
  pin_exclusion_overlap:
    'An entry cannot be both pinned and excluded. Remove one of the two.',
  rule_unknown: 'Choose one of the listed rules, or no rule.',
  max_candidates_required:
    'Enter how many entries the rule may choose, from 1 to 128.',
  max_candidates_range: 'Enter a whole number from 1 to 128.',
};

/** What the live region says when a pin or exclusion is refused locally (the control stays focusable). */
export const LIST_REFUSAL_COPY = {
  already_pinned: 'This entry is already pinned.',
  already_excluded: 'This entry is already excluded.',
  excluded:
    'This entry is excluded. Remove the exclusion first, because exclusions win.',
  pin_limit: 'You can pin at most 32 entries.',
  exclusion_limit: 'You can exclude at most 64 entries.',
} as const;
