import type { JsonValue, LocaleVariantRequest } from '@wejammin/contracts';
import { MODULE_UNAVAILABLE_COPY } from '../../lib/module-unavailable';
import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import {
  isCmsFieldValueEmpty,
  validateCmsFieldValue,
} from '../cms-editorial-fields/cms-field-value';
import { isLocaleTag } from './locale-variant-path';
import type {
  LocaleEntryFacts,
  LocaleFieldInit,
  LocaleIssue,
  LocaleIssueCode,
} from './locale-variant-types';

const MAX_FIELDS = 128;
const MAX_CHAIN = 16;

/** What the author typed, and the read-only chain submitted unchanged as the equality expectation. */
export interface LocaleVariantFields {
  readonly fields: readonly LocaleFieldInit[];
  readonly values: Readonly<Record<string, JsonValue | null>>;
  readonly fallbackChain: readonly string[];
  /** Raw control text that cannot become a value (a control's own message), by field id. */
  readonly inputErrors?: Readonly<Record<string, string>>;
}

export type { LocaleIssue, LocaleIssueCode } from './locale-variant-types';

export type LocaleVariantBuild =
  | {
      readonly ok: true;
      readonly value: LocaleVariantRequest;
      /** The serialized request: the identity of a logical attempt. */
      readonly body: string;
    }
  | { readonly ok: false; readonly issues: readonly LocaleIssue[] };

const FORM_MESSAGES: Readonly<Record<LocaleIssueCode, string>> = {
  entry_invalid: 'The entry address is not valid. Reload the page.',
  locale_invalid: 'The language tag is not valid. Check the address.',
  source_invalid: 'The source revision is not valid. Reload the page.',
  hash_invalid: 'The source fingerprint is not valid. Reload the page.',
  version_invalid: 'The entry version is not valid. Reload the page.',
  chain_invalid: 'The fallback order is not valid. Reload the page.',
  nothing_to_save: 'Enter at least one translation before saving.',
  too_many_fields: 'A translation can carry at most 128 fields.',
  field_invalid: 'This translation is not valid.',
  module_unavailable: MODULE_UNAVAILABLE_COPY,
};

const formIssue = (code: LocaleIssueCode): LocaleIssue => ({
  code,
  message: FORM_MESSAGES[code],
  target: 'form',
});

const chainIsValid = (chain: readonly string[], locale: string): boolean =>
  chain.length <= MAX_CHAIN &&
  chain.every((tag) => isLocaleTag(tag)) &&
  new Set(chain.map((tag) => tag.toLowerCase())).size === chain.length &&
  !chain.some((tag) => tag.toLowerCase() === locale.toLowerCase());

/**
 * Client-side preparation of a `LocaleVariantRequest` (FE03 :891). It lets the form name what is wrong before
 * a send. Authority, the source revision, the active chain and the schema are the Worker's and the
 * database's to decide (BE03c 385): the chain is never typed, it is the read-only order the page showed.
 * Only filled fields are sent, and `noFallbackFieldIds` are the schema's `no_fallback` fields.
 */
export const buildLocaleVariantRequest = (
  input: LocaleVariantFields,
  facts: LocaleEntryFacts,
): LocaleVariantBuild => {
  const issues: LocaleIssue[] = [];
  if (!isCmsUuid(facts.entryId)) issues.push(formIssue('entry_invalid'));
  if (!isLocaleTag(facts.locale)) issues.push(formIssue('locale_invalid'));
  if (!isCmsUuid(facts.sourceRevisionId))
    issues.push(formIssue('source_invalid'));
  if (!CMS_HASH_PATTERN.test(facts.sourceHash))
    issues.push(formIssue('hash_invalid'));
  if (!isCmsVersion(facts.version)) issues.push(formIssue('version_invalid'));
  if (!chainIsValid(input.fallbackChain, facts.locale))
    issues.push(formIssue('chain_invalid'));

  const filled: { fieldId: string; value: JsonValue }[] = [];
  for (const field of input.fields) {
    const value = input.values[field.descriptor.fieldId] ?? null;
    const unreadable = input.inputErrors?.[field.descriptor.fieldId];
    if (unreadable !== undefined) {
      issues.push({
        code: 'field_invalid',
        target: field.descriptor.fieldId,
        message: `${field.descriptor.label}: ${unreadable}`,
        detail: unreadable,
      });
      continue;
    }
    // A translation is optional per field, so an empty control is "not translated", never "required".
    const descriptor = { ...field.descriptor, required: false };
    if (isCmsFieldValueEmpty(descriptor, value) || value === null) continue;
    const problems = validateCmsFieldValue(descriptor, value);
    if (problems.length > 0) {
      issues.push({
        code: 'field_invalid',
        target: field.descriptor.fieldId,
        message: `${field.descriptor.label}: ${problems[0]?.message ?? FORM_MESSAGES.field_invalid}`,
        detail: problems[0]?.message ?? FORM_MESSAGES.field_invalid,
      });
      continue;
    }
    filled.push({ fieldId: field.descriptor.fieldId, value });
  }
  if (filled.length > MAX_FIELDS) issues.push(formIssue('too_many_fields'));
  if (filled.length === 0 && issues.every((i) => i.code !== 'field_invalid'))
    issues.push(formIssue('nothing_to_save'));
  if (issues.length > 0) return { ok: false, issues };

  const value: LocaleVariantRequest = {
    entryId: facts.entryId,
    locale: facts.locale,
    sourceRevisionId: facts.sourceRevisionId,
    fields: filled,
    fallbackChain: [...input.fallbackChain],
    noFallbackFieldIds: input.fields
      .filter((field) => field.mode === 'no_fallback')
      .map((field) => field.descriptor.fieldId),
    sourceHash: facts.sourceHash,
    expectedVersion: facts.version,
  };
  return { ok: true, value, body: JSON.stringify(value) };
};
