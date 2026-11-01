import type { TaxonomyVersionRequest } from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';

import {
  DESIGNER_ISSUE_COPY,
  type DesignerIssueCode,
} from './taxonomy-designer-copy';
import { TAG_LIMIT, tagPattern, type TagKind } from './taxonomy-tags';
import {
  CANONICAL_DOMAINS,
  TAXONOMY_KEY_REGEX,
  TAXONOMY_SHAPES,
  isCanonicalDomain,
  type CanonicalDomain,
  type TaxonomyShape,
} from './taxonomy-vocabulary';

export interface TaxonomyDesignerFields {
  readonly taxonomyKey: string;
  /** Empty until the person chooses. */
  readonly shape: TaxonomyShape | '';
  readonly typeKeys: readonly string[];
  readonly fieldKeys: readonly string[];
  readonly domains: readonly CanonicalDomain[];
  /** `null` for a first version; the read version for a successor. */
  readonly expectedVersion: string | null;
}

export type IssueField =
  | 'taxonomyKey'
  | 'shape'
  | 'allowedTypeKeys'
  | 'allowedFieldKeys'
  | 'canonicalOverlapDomains'
  | 'form';

export interface DesignerIssue {
  readonly code: DesignerIssueCode;
  readonly field: IssueField;
  readonly message: string;
}

export type TaxonomyBuildResult =
  | {
      readonly ok: true;
      readonly value: TaxonomyVersionRequest;
      /** The serialized request: the identity of a logical attempt. */
      readonly body: string;
    }
  | { readonly ok: false; readonly issues: DesignerIssue[] };

const MAX_BODY_BYTES = 262_144;

const issue = (code: DesignerIssueCode, field: IssueField): DesignerIssue => ({
  code,
  field,
  message: DESIGNER_ISSUE_COPY[code],
});

/** The issue of one allowlist, or null: required, over the limit, duplicate, then grammar. */
const allowlistIssue = (
  keys: readonly string[],
  kind: TagKind,
): DesignerIssueCode | null => {
  const prefix = kind === 'type' ? 'type_keys' : 'field_keys';
  if (keys.length === 0) return `${prefix}_required`;
  if (keys.length > TAG_LIMIT) return `${prefix}_exceeded`;
  if (new Set(keys).size !== keys.length) return `${prefix}_duplicate`;
  return keys.every((key) => tagPattern(kind).test(key))
    ? null
    : `${prefix}_invalid`;
};

/**
 * Client-side preparation of a `TaxonomyVersionRequest` from the form (FE03 :886). It only
 * lets the form name what is wrong before a send: the proxy, the Worker and the database
 * recheck every rule and own capability, uniqueness per owner and the declared-domain
 * checks at submission and activation.
 */
export const buildTaxonomyVersionRequest = (
  fields: TaxonomyDesignerFields,
): TaxonomyBuildResult => {
  const issues: DesignerIssue[] = [];
  const taxonomyKey = fields.taxonomyKey.trim();
  if (!TAXONOMY_KEY_REGEX.test(taxonomyKey))
    issues.push(issue('taxonomy_key_invalid', 'taxonomyKey'));
  if (fields.shape === '' || !TAXONOMY_SHAPES.includes(fields.shape))
    issues.push(issue('shape_required', 'shape'));
  const typeIssue = allowlistIssue(fields.typeKeys, 'type');
  if (typeIssue !== null) issues.push(issue(typeIssue, 'allowedTypeKeys'));
  const fieldIssue = allowlistIssue(fields.fieldKeys, 'field');
  if (fieldIssue !== null) issues.push(issue(fieldIssue, 'allowedFieldKeys'));
  if (!fields.domains.every(isCanonicalDomain))
    issues.push(issue('domain_unknown', 'canonicalOverlapDomains'));
  else if (new Set(fields.domains).size !== fields.domains.length)
    issues.push(issue('domain_duplicate', 'canonicalOverlapDomains'));
  if (fields.expectedVersion !== null && !isCmsVersion(fields.expectedVersion))
    issues.push(issue('version_invalid', 'form'));
  if (issues.length > 0 || fields.shape === '') return { ok: false, issues };
  const value: TaxonomyVersionRequest = {
    taxonomyKey,
    shape: fields.shape,
    allowedTypeKeys: [...fields.typeKeys],
    allowedFieldKeys: [...fields.fieldKeys],
    canonicalOverlapDomains: CANONICAL_DOMAINS.filter((domain) =>
      fields.domains.includes(domain),
    ),
    expectedVersion: fields.expectedVersion,
  };
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES)
    return { ok: false, issues: [issue('request_too_large', 'form')] };
  return { ok: true, value, body };
};
