import {
  CMS_FIELD_KEY_PATTERN,
  CMS_TYPE_KEY_PATTERN,
} from '@wejammin/contracts/client';

/** A vocabulary names 1 to 64 unique content type keys and 1 to 64 unique field keys (FE03 :886). */
export const TAG_LIMIT = 64;
const REPORTED_VALUE_MAX = 64;

export type TagKind = 'type' | 'field';
export type TagProblemCode = 'tag_invalid' | 'tag_duplicate' | 'tag_limit';

export interface TagProblem {
  readonly code: TagProblemCode;
  /** The offending text as typed, cut to 64 characters plus an ellipsis. */
  readonly value: string;
}

export const tagPattern = (kind: TagKind): RegExp =>
  kind === 'type' ? CMS_TYPE_KEY_PATTERN : CMS_FIELD_KEY_PATTERN;

const shown = (value: string): string =>
  value.length > REPORTED_VALUE_MAX
    ? `${value.slice(0, REPORTED_VALUE_MAX)}…`
    : value;

/**
 * Add the keys typed or pasted in `input` to `existing`: split on commas and whitespace, each
 * key validated against the contract grammar, de-duplicated and kept in entry order. A key
 * that does not fit is reported, never silently dropped; the valid ones are still added.
 */
export const addTags = (
  input: string,
  existing: readonly string[],
  kind: TagKind,
): { readonly tags: string[]; readonly problems: TagProblem[] } => {
  const pattern = tagPattern(kind);
  const tags = [...existing];
  const problems: TagProblem[] = [];
  const reported = new Set<string>();
  const report = (code: TagProblemCode, value: string): void => {
    const key = `${code}:${value}`;
    if (reported.has(key)) return;
    reported.add(key);
    problems.push({ code, value: shown(value) });
  };
  for (const token of input.split(/[\s,]+/u)) {
    if (token === '') continue;
    if (!pattern.test(token)) report('tag_invalid', token);
    else if (tags.includes(token)) report('tag_duplicate', token);
    else if (tags.length >= TAG_LIMIT) report('tag_limit', token);
    else tags.push(token);
  }
  return { tags, problems };
};
