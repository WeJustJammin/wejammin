import {
  CanonicalDomainSchema,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  CmsStepUpRequiredDetailsSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

/**
 * The published `details` of a governed-review error (CMS-03C-06 to -11; BE03c "Normative application error catalog"). Nothing the upstream
 * wrote is published verbatim: every detail is rebuilt from the closed
 * vocabularies (the operation's reason tokens, its request pointers, the rate
 * hints) and a detail that does not verify is dropped, never repaired.
 */
export type GovernedProxyOperation =
  | 'CMS-03C-06'
  | 'CMS-03C-07'
  | 'CMS-03C-08'
  | 'CMS-03C-09'
  | 'CMS-03C-10'
  | 'CMS-03C-11';

export type Details = Record<string, unknown>;
type StatusSet = ReadonlySet<number>;

const ALL: readonly number[] = [
  400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
];

/** BE03c rows 168-173: the statuses each operation documents (any other is a 502). */
export const GOVERNED_DECLARED_STATUSES: Readonly<
  Record<GovernedProxyOperation, StatusSet>
> = {
  'CMS-03C-06': new Set(ALL),
  'CMS-03C-07': new Set(ALL),
  'CMS-03C-08': new Set(ALL),
  'CMS-03C-09': new Set(ALL),
  'CMS-03C-10': new Set([400, 401, 403, 404, 415, 429, 500, 502, 503, 504]),
  'CMS-03C-11': new Set([400, 401, 409, 415, 422, 429, 500, 502, 503, 504]),
};

/** BE03c 216, 170, 171: the three commands that require recent MFA answer 401 `STEP_UP_REQUIRED`. */
export const STEP_UP_OPERATIONS: ReadonlySet<GovernedProxyOperation> = new Set([
  'CMS-03C-07',
  'CMS-03C-08',
  'CMS-03C-09',
]);
export const STEP_UP_CODE = 'STEP_UP_REQUIRED';

/** True for the one answer that is a step-up shortfall: 401 with the registered code on a step-up command. */
export const isGovernedStepUp = (
  operation: GovernedProxyOperation,
  status: number,
  code: string,
): boolean =>
  status === 401 && code === STEP_UP_CODE && STEP_UP_OPERATIONS.has(operation);

/** The request pointers a validation failure may name; anything else is attacker text. */
const POINTERS: Readonly<Record<GovernedProxyOperation, ReadonlySet<string>>> =
  {
    'CMS-03C-06': new Set(['/subjectKind', '/subjectId', '/subjectHash']),
    'CMS-03C-07': new Set([
      '/reviewId',
      '/decision',
      '/reason',
      '/expectedVersion',
    ]),
    'CMS-03C-08': new Set([
      '/action',
      '/expectedVersion',
      '/reviewerPersonId',
      '/expiresAt',
      '/assignmentId',
      '/reason',
    ]),
    // The pointers a Time authority refusal names inside the nested `activateAt`.
    'CMS-03C-09': new Set([
      '/action',
      '/expectedVersion',
      '/activateAt',
      '/activateAt/localDateTime',
      '/activateAt/timezone',
      '/activateAt/resolvedUtc',
      '/activateAt/tzdbVersion',
      '/activateAt/disambiguation',
      '/reason',
    ]),
    'CMS-03C-10': new Set(),
    'CMS-03C-11': new Set([
      '/cursor',
      '/limit',
      '/scope',
      '/state',
      '/subjectKind',
    ]),
  };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const violation = (path: string, code = 'invalid') => ({
  path,
  code,
  message: 'The value is invalid.',
});

const safeViolations = (
  operation: GovernedProxyOperation,
  source: unknown,
): readonly ReturnType<typeof violation>[] => {
  if (!Array.isArray(source)) return [];
  const pointers = POINTERS[operation];
  const seen = new Set<string>();
  const output: ReturnType<typeof violation>[] = [];
  for (const item of source.slice(0, 50) as unknown[]) {
    const path =
      isRecord(item) && typeof item.path === 'string' && pointers.has(item.path)
        ? item.path
        : '/';
    if (path !== '/' && seen.has(path)) continue;
    seen.add(path);
    output.push(violation(path));
  }
  return output;
};

/**
 * The bounded pointer-only violations of a body the contract refused: the first
 * path segment when it is one of the operation's request members, else `/`
 * (attacker member names are never echoed).
 */
export const governedViolationsOf = (
  operation: GovernedProxyOperation,
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): readonly { path: string; code: string }[] => {
  const pointers = POINTERS[operation];
  const paths = new Set<string>();
  for (const issue of issues.slice(0, 50)) {
    const first = issue.path[0];
    const pointer = first === undefined ? '/' : `/${String(first)}`;
    paths.add(pointers.has(pointer) ? pointer : '/');
  }
  return [...paths].map((path) => ({ path, code: 'invalid' }));
};

/** A typed 403/409/422 refusal: one registered token of this operation at its one status. */
const typedRefusal = (
  operation: GovernedProxyOperation,
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
  const output: Details = { reasonCode: reason.data };
  if (reason.data === 'canonical_source_unavailable') {
    // The contract makes the unbuilt domain mandatory: a domain-less answer is invalid.
    const domain = CanonicalDomainSchema.safeParse(upstream.domain);
    if (!domain.success) return null;
    output.domain = domain.data;
  }
  if (status === 422) {
    const pointed = safeViolations(operation, upstream.violations).filter(
      (entry) => entry.path !== '/',
    );
    if (pointed.length > 0) output.violations = pointed;
  }
  return output;
};

const rateHints = (upstream: unknown): Details => {
  if (!isRecord(upstream)) return {};
  const output: Details = {};
  for (const key of ['retryAfterSeconds', 'limit'] as const) {
    const value = upstream[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
      output[key] = value;
  }
  const reset = upstream.resetAt;
  if (typeof reset === 'string' && /^\d{1,19}$/u.test(reset))
    output.resetAt = reset;
  return output;
};

/** The published `details` of one governed error; a detail that does not verify is dropped. */
export const projectGovernedErrorDetails = (
  operation: GovernedProxyOperation,
  status: number,
  code: string,
  upstream: unknown,
): Details => {
  if (status === 401) {
    if (isGovernedStepUp(operation, status, code)) {
      const parsed = CmsStepUpRequiredDetailsSchema.safeParse({
        recoveryAction: isRecord(upstream)
          ? upstream.recoveryAction
          : undefined,
        allowedMethods: isRecord(upstream)
          ? upstream.allowedMethods
          : undefined,
      });
      return parsed.success
        ? {
            recoveryAction: parsed.data.recoveryAction,
            allowedMethods: [...parsed.data.allowedMethods],
          }
        : {};
    }
    return isRecord(upstream) && upstream.recoveryAction === 'reauthenticate'
      ? { recoveryAction: 'reauthenticate' }
      : {};
  }
  if (status === 415) return { allowedMediaTypes: ['application/json'] };
  // BE00 172: the DEPENDENCY_UNAVAILABLE member is retryable on 502, 503 and 504.
  if (status >= 502 && status <= 504)
    return { dependencyClass: 'cms_composition', retryable: true };
  if (status === 403 || status === 409) {
    const refusal = typedRefusal(operation, status, upstream);
    return refusal === null ? {} : { reasonCode: refusal.reasonCode };
  }
  if (status === 429) return rateHints(upstream);
  if (status === 400 || status === 422) {
    const typed =
      status === 422 ? typedRefusal(operation, status, upstream) : null;
    if (typed !== null) return typed;
    const violations = isRecord(upstream)
      ? safeViolations(operation, upstream.violations)
      : [];
    return violations.length > 0 ? { violations } : {};
  }
  return {};
};
