import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import type { TermFacts } from './taxonomy-terms-read';
import type { TaxonomyShape } from '../cms-taxonomy-designer/taxonomy-vocabulary';
import { TERM_ISSUE_COPY, type TermIssueCode } from './term-copy';
import {
  TERM_KEY_REGEX,
  TERM_LIMITS,
  isLocale,
  isTermAlias,
  isTermLabelText,
} from './term-rules';

export type TermAction = TaxonomyTermActionRequest['action'];

export interface TermLabelRow {
  readonly locale: string;
  readonly label: string;
}

export interface TermFormFields {
  readonly action: TermAction;
  /** Typed for a create; an action on an existing term uses the term's own key. */
  readonly termKey: string;
  /** The chosen parent term id; empty means no parent. */
  readonly parentId: string;
  /** The chosen survivor term id of a merge. */
  readonly survivorId: string;
  readonly labels: readonly TermLabelRow[];
  /** The aliases of a create, or the aliases to add on an alias action. */
  readonly aliases: readonly string[];
}

export interface TermActionContext {
  readonly taxonomyId: string;
  readonly shape: TaxonomyShape;
  /** The vocabulary's active version: both the `If-Match` and `expectedVersion` operand. */
  readonly activeVersion: string;
  /** The term an action other than create acts on. */
  readonly target: TermFacts | null;
}

export type TermIssueField =
  'termKey' | 'labels' | 'aliases' | 'parentId' | 'survivorId' | 'form';

export interface TermIssue {
  readonly code: TermIssueCode;
  readonly field: TermIssueField;
  readonly message: string;
  /** The zero-based row of a label the problem belongs to. */
  readonly row?: number;
}

export type TermBuildResult =
  | {
      readonly ok: true;
      readonly value: TaxonomyTermActionRequest;
      /** The serialized request: the identity of a logical attempt. */
      readonly body: string;
    }
  | { readonly ok: false; readonly issues: TermIssue[] };

const MAX_BODY_BYTES = 262_144;

const issue = (
  code: TermIssueCode,
  field: TermIssueField,
  row?: number,
): TermIssue => ({
  code,
  field,
  message: TERM_ISSUE_COPY[code],
  ...(row === undefined ? {} : { row }),
});

const clean = (value: string): string => value.trim().normalize('NFC');

const labelIssues = (rows: readonly TermLabelRow[]): TermIssue[] => {
  if (rows.length === 0) return [issue('labels_required', 'labels')];
  if (rows.length > TERM_LIMITS.labels)
    return [issue('labels_exceeded', 'labels')];
  return rows.flatMap((row, index) => [
    ...(isLocale(row.locale.trim())
      ? []
      : [issue('label_locale_invalid', 'labels', index)]),
    ...(isTermLabelText(clean(row.label))
      ? []
      : [issue('label_text_invalid', 'labels', index)]),
  ]);
};

const aliasIssues = (aliases: readonly string[]): TermIssue[] => {
  if (aliases.length > TERM_LIMITS.aliases)
    return [issue('aliases_exceeded', 'aliases')];
  return aliases.every((alias) => isTermAlias(clean(alias)))
    ? []
    : [issue('alias_invalid', 'aliases')];
};

const cleanRows = (rows: readonly TermLabelRow[]): TermLabelRow[] =>
  rows.map((row) => ({ locale: row.locale.trim(), label: clean(row.label) }));

/** The parent a create or a rename applies: none, or one of the vocabulary's terms. */
const parentOf = (
  fields: TermFormFields,
  context: TermActionContext,
): { readonly parentId: string | null; readonly issues: TermIssue[] } => {
  if (fields.parentId === '') return { parentId: null, issues: [] };
  if (context.shape === 'flat')
    return {
      parentId: null,
      issues: [issue('parent_not_allowed', 'parentId')],
    };
  return isCmsUuid(fields.parentId)
    ? { parentId: fields.parentId, issues: [] }
    : { parentId: null, issues: [issue('parent_invalid', 'parentId')] };
};

/**
 * Client-side preparation of a `TaxonomyTermActionRequest` from the form (FE03 :887). It only
 * lets the form name what is wrong before a send: the proxy, the Worker and the database
 * recheck every rule and own the curator capability, the active-version rule, the canonical
 * overlap check and the hierarchy. A term is addressed by its key; an action other than
 * create sends the term's own key and, where the action ignores them, its own labels.
 */
export const buildTermActionRequest = (
  fields: TermFormFields,
  context: TermActionContext,
): TermBuildResult => {
  const { action } = fields;
  const issues: TermIssue[] = [];
  const target = action === 'create' ? null : context.target;
  if (action !== 'create' && target === null)
    return { ok: false, issues: [issue('target_missing', 'form')] };
  const termKey = target === null ? fields.termKey.trim() : target.termKey;
  if (target === null && !TERM_KEY_REGEX.test(termKey))
    issues.push(issue('term_key_invalid', 'termKey'));
  if (!isCmsVersion(context.activeVersion))
    issues.push(issue('version_invalid', 'form'));

  let labels: TermLabelRow[] = target === null ? [] : [...target.labels];
  let aliases: string[] = [];
  let parentId: string | null = null;
  let survivorId: string | null = null;
  if (action === 'create' || action === 'rename') {
    issues.push(...labelIssues(fields.labels));
    labels = cleanRows(fields.labels);
    const parent = parentOf(fields, context);
    issues.push(...parent.issues);
    parentId = parent.parentId;
  }
  if (action === 'create' || action === 'alias') {
    issues.push(...aliasIssues(fields.aliases));
    aliases = fields.aliases.map(clean);
    if (action === 'alias' && fields.aliases.length === 0)
      issues.push(issue('alias_required', 'aliases'));
  }
  if (action === 'merge') {
    if (fields.survivorId === '')
      issues.push(issue('survivor_required', 'survivorId'));
    else if (!isCmsUuid(fields.survivorId))
      issues.push(issue('survivor_invalid', 'survivorId'));
    else if (fields.survivorId === target?.termId)
      issues.push(issue('survivor_same', 'survivorId'));
    else survivorId = fields.survivorId;
  }
  if (issues.length > 0) return { ok: false, issues };
  const value: TaxonomyTermActionRequest = {
    taxonomyId: context.taxonomyId,
    action,
    termKey,
    parentId,
    survivorId,
    labels,
    aliases,
    expectedVersion: context.activeVersion,
  };
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES)
    return { ok: false, issues: [issue('request_too_large', 'form')] };
  return { ok: true, value, body };
};
