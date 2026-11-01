import type { CmsSlice11ReasonCode } from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import { classifyStepUpResponse } from '../content-schema-registry/content-schema-registry-step-up-classify';
import type {
  WorkflowCommandInput,
  WorkflowCommandResult,
  WorkflowConflictKind,
  WorkflowRefusal,
  WorkflowTransportEnvironment,
} from '../cms-editorial-workflow/cms-workflow-command-transport';
import {
  governedCommandPath,
  type GovernedCommandIds,
  type GovernedCommandSpec,
} from './governed-review-command-specs';
import {
  GOVERNED_CANONICAL_DOMAINS,
  GOVERNED_REASONS,
  governedReasonStatus,
} from './governed-review-reasons';

/**
 * The browser side of the three governed commands (CMS-03C-06, -07, -08). It
 * sends exactly the strict body with the session CSRF token, the caller's
 * `Idempotency-Key` and, for the versioned commands, the strong `If-Match`, then
 * reduces the answer to one closed result: a verified commit, a step-up
 * shortfall, a sign-out, an unknown outcome (the key is kept and the identical
 * request replayed after reconciliation), a definite refusal (the key is
 * rotated) or a request that was never sent. Nothing the server wrote is
 * rendered: only the registered reason tokens and the closed domain cross this
 * boundary.
 */

/** A refusal in the shape the shared command controller reads, plus the governed members. */
export interface GovernedRefusal extends WorkflowRefusal {
  /** The registered governed reason (any of the operation's tokens) and its canonical domain. */
  readonly governed: Readonly<{
    reason: string | null;
    domain: string | null;
  }>;
}

export type GovernedCommandResult<TResource> =
  | Exclude<WorkflowCommandResult<TResource>, { kind: 'refused' }>
  | { readonly kind: 'refused'; readonly refusal: GovernedRefusal };

export type GovernedCommandInput<TBody> = WorkflowCommandInput<
  GovernedCommandIds,
  TBody
>;

const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const KEY_SHAPE = /^[\x21-\x7E](?:[\x20-\x7E]{6,126}[\x21-\x7E])$/u;
const QUOTED_VERSION = /^"([1-9]\d{0,18})"$/u;
const STRONG_ETAG = /^"[\x21\x23-\x7e]{1,256}"$/u;
const CONFLICT_KINDS: ReadonlySet<string> = new Set([
  'VERSION_MISMATCH',
  'IDEMPOTENCY_MISMATCH',
  'INVALID_TRANSITION',
]);
/** The governed tokens the shared Slice 11 refusal table already speaks (it is keyed by this string). */
const SHARED_TOKENS = [
  'capability_missing',
  'separation_of_duties',
  'review_not_open',
  'duplicate_decision',
  'specialist_slot_unsatisfiable',
  'dependency_changed',
  'reviewer_not_eligible',
  'assignment_exists',
  'assignment_limit',
  'expiry_out_of_bounds',
] as const satisfies readonly CmsSlice11ReasonCode[];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const csrfTokenOf = (
  documentRef: Readonly<{ cookie: string }>,
): string | null => {
  const entry = documentRef.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('wj_csrf='));
  const value = entry?.slice('wj_csrf='.length);
  return value === undefined || value === '' ? null : value;
};

const requestIdOf = (value: unknown): string | null =>
  typeof value === 'string' && REQUEST_ID.test(value) ? value : null;

const retryAfterOf = (value: unknown): number | null =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 1 &&
  value <= 3_600
    ? value
    : null;

const violationsOf = (value: unknown): WorkflowRefusal['violations'] =>
  Array.isArray(value)
    ? value.flatMap((entry: unknown) => {
        if (!isRecord(entry)) return [];
        const { path, code } = entry;
        return typeof path === 'string' && typeof code === 'string'
          ? [{ path, code }]
          : [];
      })
    : [];

const refusalOf = (
  operation: keyof typeof GOVERNED_REASONS,
  response: Response,
  body: unknown,
): GovernedRefusal => {
  const envelope = isRecord(body) ? body : {};
  const details = isRecord(envelope.details) ? envelope.details : {};
  const candidate = details.reasonCode;
  const registered =
    typeof candidate === 'string' &&
    GOVERNED_REASONS[operation].includes(candidate) &&
    governedReasonStatus(candidate) === response.status
      ? candidate
      : null;
  const shared =
    registered !== null &&
    (SHARED_TOKENS as readonly string[]).includes(registered)
      ? (registered as CmsSlice11ReasonCode)
      : null;
  const domain =
    registered === 'canonical_source_unavailable' &&
    typeof details.domain === 'string' &&
    GOVERNED_CANONICAL_DOMAINS.includes(details.domain)
      ? details.domain
      : null;
  const header = response.headers.get('retry-after');
  const conflict =
    typeof details.conflict === 'string' && CONFLICT_KINDS.has(details.conflict)
      ? (details.conflict as WorkflowConflictKind)
      : null;
  return {
    status: response.status,
    code: typeof envelope.code === 'string' ? envelope.code : null,
    reason: shared,
    details: null,
    conflict,
    violations: violationsOf(details.violations),
    retryAfterSeconds:
      retryAfterOf(details.retryAfterSeconds) ??
      (header !== null && /^\d{1,5}$/u.test(header)
        ? retryAfterOf(Number(header))
        : null),
    preflightUnavailable: false,
    requestId:
      requestIdOf(envelope.requestId) ??
      requestIdOf(response.headers.get('x-request-id')),
    governed: { reason: registered, domain },
  };
};

const parsedJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

/**
 * Send one governed command. A result of kind `unknown` means the command may
 * have committed: the caller keeps its key, reconciles with a canonical read and
 * only then replays the byte-identical request.
 */
export const sendGovernedCommand = async <
  TBody extends object,
  TResource extends { readonly version: string },
>(
  spec: GovernedCommandSpec<TBody, TResource>,
  input: GovernedCommandInput<TBody>,
  environment: WorkflowTransportEnvironment = {},
): Promise<GovernedCommandResult<TResource>> => {
  const documentRef = environment.documentRef ?? document;
  const csrfToken = csrfTokenOf(documentRef);
  if (csrfToken === null) return { kind: 'local', reason: 'csrf_missing' };

  const expected = (input.body as { expectedVersion?: string }).expectedVersion;
  const operand = QUOTED_VERSION.exec(input.ifMatch)?.[1];
  const versionOk = spec.hasIfMatch
    ? operand !== undefined && operand === expected
    : true;
  if (
    !spec.requestValid(input.body) ||
    !KEY_SHAPE.test(input.idempotencyKey) ||
    !versionOk
  )
    return { kind: 'local', reason: 'request_invalid' };

  const base = environment.fetcher ?? fetch;
  const path = governedCommandPath(spec.operationId, input.ids);
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-csrf-token': csrfToken,
    'idempotency-key': input.idempotencyKey,
  };
  if (spec.hasIfMatch) headers['if-match'] = input.ifMatch;
  let response: Response;
  try {
    response = await base(
      path,
      await addClientBindingIdHeader(path, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'manual',
        headers,
        body: JSON.stringify(input.body),
      }),
    );
  } catch {
    return { kind: 'unknown', requestId: null };
  }

  const answer = await parsedJson(response);
  const requestId =
    requestIdOf(isRecord(answer) ? answer.requestId : undefined) ??
    requestIdOf(response.headers.get('x-request-id'));

  if (response.ok) {
    const etag = response.headers.get('etag');
    const resource =
      response.status === spec.successStatus(input.body) &&
      etag !== null &&
      STRONG_ETAG.test(etag)
        ? spec.bound(input.ids, input.body, answer)
        : null;
    if (resource === null) return { kind: 'unknown', requestId: null };
    const location = spec.location(input.ids, input.body, resource);
    if (
      etag !== `"${resource.version}"` ||
      response.headers.get('location') !== location
    )
      return { kind: 'unknown', requestId: null };
    return { kind: 'committed', resource, status: response.status };
  }
  if (response.status === 401) {
    const recovery = await classifyStepUpResponse(response);
    return recovery === null
      ? { kind: 'signed-out', requestId }
      : { kind: 'step-up', recovery };
  }
  // A redirect (or an opaque one) is not an answer to the command: the effect is
  // unknown exactly like a 5xx or a marked refusal.
  if (
    response.status >= 500 ||
    response.status < 200 ||
    (response.status >= 300 && response.status < 400) ||
    response.headers.get(UNKNOWN_OUTCOME_HEADER) === 'unknown'
  )
    return { kind: 'unknown', requestId };
  return {
    kind: 'refused',
    refusal: refusalOf(spec.operationId, response, answer),
  };
};
