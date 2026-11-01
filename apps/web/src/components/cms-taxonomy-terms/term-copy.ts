import { MODULE_UNAVAILABLE_COPY } from '../../lib/module-unavailable';

/**
 * Fixed copy of the term form (FE03 "Form contract": a field copy states the rule and the
 * correction; `reasonCode` copy is fixed). Written here, never taken from a response.
 */
export type TermIssueCode =
  | 'term_key_invalid'
  | 'labels_required'
  | 'labels_exceeded'
  | 'label_locale_invalid'
  | 'label_text_invalid'
  | 'aliases_exceeded'
  | 'alias_invalid'
  | 'alias_required'
  | 'parent_not_allowed'
  | 'parent_invalid'
  | 'survivor_required'
  | 'survivor_invalid'
  | 'survivor_same'
  | 'target_missing'
  | 'version_invalid'
  | 'request_too_large'
  | 'module_unavailable';

export const TERM_ISSUE_COPY: Readonly<Record<TermIssueCode, string>> = {
  module_unavailable: MODULE_UNAVAILABLE_COPY,
  term_key_invalid:
    'Use 2 to 64 lowercase letters, digits or hyphens, starting with a letter. The key never changes.',
  labels_required: 'Add at least one label.',
  labels_exceeded: 'A term has at most 64 labels. Remove some.',
  label_locale_invalid:
    'Use a language code such as en or en-GB: letters, with optional hyphenated parts.',
  label_text_invalid:
    'Enter the label, 1 to 160 characters, or remove this row.',
  aliases_exceeded: 'A term has at most 64 aliases. Remove some.',
  alias_invalid: 'An alias is 1 to 160 characters. Retype it or remove it.',
  alias_required: 'Add the alias to add.',
  parent_not_allowed: 'A flat vocabulary has no parent terms. Reload the page.',
  parent_invalid: 'The parent term could not be read. Reload the page.',
  survivor_required: 'Choose the term this one merges into.',
  survivor_invalid:
    'The term to merge into could not be read. Reload the page.',
  survivor_same: 'A term cannot merge into itself. Choose another term.',
  target_missing: 'Choose the term to change. Reload the page if it is gone.',
  version_invalid: 'The active version could not be read. Reload the page.',
  request_too_large:
    'The term is too large to send (256 KiB at most). Remove labels or aliases.',
};

export const ACTION_LABEL = {
  create: 'Create a term',
  rename: 'Rename',
  alias: 'Add an alias',
  deprecate: 'Deprecate',
  merge: 'Merge',
} as const;

/** The consequence stated before the commit of an irreversible action (FE03 :887). */
export const ACTION_CONSEQUENCE = {
  create: 'A new term is created as active. Its key can never change.',
  rename:
    'The labels are replaced by the ones below. The key and every use of the term are unchanged.',
  alias:
    'The alias is added to the term. Existing aliases stay. Lookups by the alias find the term.',
  deprecate:
    'A deprecated term stays resolvable but authors can no longer choose it. It cannot be made active again.',
  merge:
    'The retired term redirects permanently to the term it merges into, and every use of it moves there. This cannot be undone.',
} as const;

export const SUBMIT_LABEL = {
  create: 'Create term',
  rename: 'Rename term',
  alias: 'Add the alias',
  deprecate: 'Review the deprecation',
  merge: 'Review the merge',
} as const;

export const PARENT_HELP = {
  rename:
    'Leave the current parent to keep the term where it is. Choosing none moves it to the top level.',
  create: 'Lists the active and deprecated terms of this vocabulary.',
} as const;
