import {
  CMS_SLICE_12_OPERATION_REASONS,
  CanonicalDomainSchema,
  CmsSlice12ReasonCodeSchema,
  CmsUuidSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';

import {
  compositionDependencyDetails,
  isCompositionDependencyStatus,
} from './cms-composition-platform-dependency';
import { relayedResetAt } from './rate-limit-reset-at';

/**
 * The published `details` of a vocabulary error (CMS-03C-16, CMS-03C-03, CMS-03C-17,
 * `cmsTaxonomyVersionsRead`, `cmsTaxonomyTermsRead`; BE03c "Normative application error
 * catalog" and "Slice 12 typed refusals"). Nothing the upstream wrote is published
 * verbatim: every detail is rebuilt from the closed vocabularies (the operation's reason
 * tokens and the members a token names, its request pointers, the rate hints) and a
 * detail that does not verify is dropped, never repaired.
 */
export type TaxonomyProxyOperation =
  | 'CMS-03C-16'
  | 'CMS-03C-03'
  | 'CMS-03C-17'
  | 'cmsTaxonomyVersionsRead'
  | 'cmsTaxonomyTermsRead';
export type Details = Record<string, unknown>;

const WRITE_STATUSES: readonly number[] = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];
const common = [400, 401, 403, 404, 415, 429, 500, 502, 503, 504];

/**
 * The statuses each operation documents (FE03 :1847, BE03c 1290 and 1295); any other is
 * a 502. A read answers 409 only for a signed cursor that no longer matches; the terms
 * read has no 422 (BE03c 407), the selector names its query members with one.
 */
export const TAXONOMY_DECLARED_STATUSES: Readonly<
  Record<TaxonomyProxyOperation, ReadonlySet<number>>
> = {
  'CMS-03C-16': new Set(WRITE_STATUSES),
  'CMS-03C-03': new Set(WRITE_STATUSES),
  cmsTaxonomyVersionsRead: new Set(common),
  cmsTaxonomyTermsRead: new Set([...common, 409]),
  'CMS-03C-17': new Set([...common, 409, 422]),
};

/** The request pointers a validation failure may name, in the order they are published. */
const POINTERS: Readonly<Record<TaxonomyProxyOperation, readonly string[]>> = {
  'CMS-03C-16': [
    '/taxonomyKey',
    '/shape',
    '/allowedTypeKeys',
    '/allowedFieldKeys',
    '/canonicalOverlapDomains',
    '/expectedVersion',
  ],
  'CMS-03C-03': [
    '/taxonomyId',
    '/action',
    '/termKey',
    '/parentId',
    '/survivorId',
    '/labels',
    '/aliases',
    '/expectedVersion',
  ],
  cmsTaxonomyVersionsRead: ['/taxonomyId'],
  cmsTaxonomyTermsRead: ['/taxonomyId', '/lifecycle', '/cursor', '/limit'],
  'CMS-03C-17': ['/typeKey', '/fieldKey', '/locale', '/cursor', '/limit'],
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const taxonomyViolation = (path: string, code = 'invalid') => ({
  path,
  code,
  message: 'The value is invalid.',
});

/** The bounded violation list for the pointers `named` (attacker member names fall to `/`). */
const pointerViolations = (
  operation: TaxonomyProxyOperation,
  named: readonly string[],
): ReturnType<typeof taxonomyViolation>[] => {
  const known = POINTERS[operation];
  const present = new Set(
    named.map((path) => (known.includes(path) ? path : '/')),
  );
  return [
    ...known.filter((path) => present.has(path)),
    ...(present.has('/') ? ['/'] : []),
  ]
    .slice(0, 50)
    .map((path) => taxonomyViolation(path));
};

/**
 * The pointer-only violations of a body or query the contract refused: the first path
 * segment when it is a request member, else `/`. No submitted value is echoed.
 */
export const taxonomyViolationsOf = (
  operation: TaxonomyProxyOperation,
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): ReturnType<typeof taxonomyViolation>[] =>
  pointerViolations(
    operation,
    issues.slice(0, 50).map((issue) => {
      const first = issue.path[0];
      return first === undefined ? '/' : `/${String(first)}`;
    }),
  );

/**
 * BE03c 1304: the one token of this operation that `upstream` names on `status`, plus
 * only the members the token names (`canonical_overlap`: the domain and the canonical id
 * to reference; `canonical_source_unavailable`: the unbuilt domain). A token on another
 * status, one the operation does not publish, or one whose mandatory member is missing
 * is dropped, never repaired.
 */
const typedRefusal = (
  operation: TaxonomyProxyOperation,
  status: number,
  upstream: unknown,
): Details | null => {
  if (!isRecord(upstream)) return null;
  const reason = CmsSlice12ReasonCodeSchema.safeParse(upstream.reasonCode);
  if (
    !reason.success ||
    cmsSlice12ReasonStatus(reason.data) !== status ||
    !(CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).includes(
      reason.data,
    )
  )
    return null;
  if (
    reason.data === 'canonical_source_unavailable' ||
    reason.data === 'canonical_overlap'
  ) {
    const domain = CanonicalDomainSchema.safeParse(upstream.domain);
    if (!domain.success) return null;
    if (reason.data === 'canonical_source_unavailable')
      return { reasonCode: reason.data, domain: domain.data };
    const canonicalId = CmsUuidSchema.safeParse(upstream.canonicalId);
    return canonicalId.success
      ? {
          reasonCode: reason.data,
          domain: domain.data,
          canonicalId: canonicalId.data,
        }
      : null;
  }
  return { reasonCode: reason.data };
};

const rateHints = (upstream: unknown): Details => {
  if (!isRecord(upstream)) return {};
  const output: Details = {};
  for (const key of ['retryAfterSeconds', 'limit'] as const) {
    const value = upstream[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      output[key] = value;
  }
  const resetAt = relayedResetAt(upstream.resetAt, 'epoch-string');
  if (resetAt !== null) output.resetAt = resetAt;
  return output;
};

const versionHints = (upstream: unknown): Details => {
  if (!isRecord(upstream)) return {};
  const output: Details = {};
  for (const key of ['expectedVersion', 'currentVersion'] as const) {
    const value = upstream[key];
    if (typeof value === 'string' && isCmsVersion(value)) output[key] = value;
  }
  return output;
};

const WRITES: ReadonlySet<TaxonomyProxyOperation> = new Set([
  'CMS-03C-16',
  'CMS-03C-03',
]);

/** The published `details` of one vocabulary error; a detail that does not verify is dropped. */
export const projectTaxonomyErrorDetails = (
  operation: TaxonomyProxyOperation,
  status: number,
  upstream: unknown,
): Details => {
  if (status === 401)
    return isRecord(upstream) && upstream.recoveryAction === 'reauthenticate'
      ? { recoveryAction: 'reauthenticate' }
      : {};
  if (status === 415) return { allowedMediaTypes: ['application/json'] };
  if (isCompositionDependencyStatus(status))
    return { ...compositionDependencyDetails() };
  if (status === 429) return rateHints(upstream);
  if (status === 403) return typedRefusal(operation, status, upstream) ?? {};
  if (status === 409)
    return (
      typedRefusal(operation, status, upstream) ??
      (WRITES.has(operation) ? versionHints(upstream) : {})
    );
  if (status === 400 || status === 422) {
    const typed =
      status === 422 ? typedRefusal(operation, status, upstream) : null;
    if (typed !== null) return typed;
    const violations =
      isRecord(upstream) && Array.isArray(upstream.violations)
        ? pointerViolations(
            operation,
            (upstream.violations as unknown[])
              .slice(0, 50)
              .map((entry) =>
                isRecord(entry) && typeof entry.path === 'string'
                  ? entry.path
                  : '/',
              ),
          )
        : [];
    return violations.length > 0 ? { violations } : {};
  }
  return {};
};
