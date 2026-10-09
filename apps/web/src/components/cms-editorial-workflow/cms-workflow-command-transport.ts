import {
  ApiErrorSchema,
  CmsEditorialRefusalDetailsSchema,
  CmsPreflightUnavailableDetailsSchema,
  CmsSlice11ReasonCodeSchema,
  cmsEditorialRoutePolicies,
  type CmsEditorialRefusalDetails,
  type CmsSlice11ReasonCode,
} from '@wejammin/contracts';

import { addClientBindingIdHeader } from '../../lib/client-binding';
import { classifyStepUpResponse } from '../content-schema-registry/content-schema-registry-step-up-classify';
import {
  verifyCommandSuccess,
  type CmsWorkflowCommandOperationId,
  type CommandSpec,
} from './cms-workflow-command-specs';

/**
 * The browser side of the six Slice 11 commands. It sends exactly the strict
 * generated body with the session CSRF token, the caller's `Idempotency-Key`
 * and the strong `If-Match`, then reduces the answer to one closed result:
 * a verified commit, a step-up shortfall, a sign-out, an unknown outcome (the
 * key is kept and the identical request replayed after reconciliation), a
 * definite refusal (the key is rotated) or a request that was never sent.
 * Nothing the server wrote is rendered: only the verified reason tokens and
 * structured members cross this boundary.
 */

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface WorkflowTransportEnvironment {
  readonly fetcher?: Fetcher;
  readonly documentRef?: Readonly<{ cookie: string }>;
}

export interface WorkflowCommandInput<TPath, TBody> {
  readonly ids: TPath;
  readonly body: TBody;
  /** The quoted strong `If-Match` operand. */
  readonly ifMatch: string;
  readonly idempotencyKey: string;
}

export type WorkflowConflictKind =
  'VERSION_MISMATCH' | 'IDEMPOTENCY_MISMATCH' | 'INVALID_TRANSITION';

export interface WorkflowRefusal {
  readonly status: number;
  readonly code: string | null;
  /** The verified Slice 11 reason token, or null for a plain status. */
  readonly reason: CmsSlice11ReasonCode | null;
  /** The strict structured members of that token (preflight list, alternatives, ...). */
  readonly details: CmsEditorialRefusalDetails | null;
  readonly conflict: WorkflowConflictKind | null;
  readonly violations: readonly {
    readonly path: string;
    readonly code: string;
  }[];
  readonly retryAfterSeconds: number | null;
  /** A retryable 503 from an unavailable preflight provider: nothing committed. */
  readonly preflightUnavailable: boolean;
  readonly requestId: string | null;
}

export type StepUpRecovery =
  | { readonly kind: 'navigate' }
  | { readonly kind: 'no-method'; readonly requestId: string | null }
  | { readonly kind: 'malformed'; readonly requestId: string | null };

export type WorkflowCommandResult<TResource> =
  | {
      readonly kind: 'committed';
      readonly resource: TResource;
      readonly status: number;
    }
  | { readonly kind: 'step-up'; readonly recovery: StepUpRecovery }
  | { readonly kind: 'signed-out'; readonly requestId: string | null }
  | { readonly kind: 'unknown'; readonly requestId: string | null }
  | { readonly kind: 'refused'; readonly refusal: WorkflowRefusal }
  | {
      readonly kind: 'local';
      readonly reason: 'csrf_missing' | 'request_invalid';
    };

const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';
const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CONFLICT_KINDS: ReadonlySet<string> = new Set([
  'VERSION_MISMATCH',
  'IDEMPOTENCY_MISMATCH',
  'INVALID_TRANSITION',
]);

const COMMAND_PATHS: Readonly<Record<string, string>> = Object.fromEntries(
  cmsEditorialRoutePolicies.map((row) => [row.operationId, row.path]),
);

/** The browser path of a command, from the generated registry row. */
export const workflowCommandPath = (
  operationId: CmsWorkflowCommandOperationId,
  ids: Readonly<{
    entryId?: string | undefined;
    reviewId?: string | undefined;
  }>,
): string =>
  (COMMAND_PATHS[operationId] as string).replace(
    /\{(\w+)\}/gu,
    (_, name: string) =>
      encodeURIComponent(
        (ids as Readonly<Record<string, string>>)[name] as string,
      ),
  );

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
        if (typeof entry !== 'object' || entry === null) return [];
        const { path, code } = entry as Record<string, unknown>;
        return typeof path === 'string' && typeof code === 'string'
          ? [{ path, code }]
          : [];
      })
    : [];

const refusalOf = (
  response: Response,
  error: ReturnType<typeof ApiErrorSchema.safeParse>,
): WorkflowRefusal => {
  const details: Readonly<Record<string, unknown>> = error.success
    ? error.data.details
    : {};
  const reason = CmsSlice11ReasonCodeSchema.safeParse(details.reasonCode);
  const typed = CmsEditorialRefusalDetailsSchema.safeParse(details);
  const conflict =
    typeof details.conflict === 'string' && CONFLICT_KINDS.has(details.conflict)
      ? (details.conflict as WorkflowConflictKind)
      : null;
  const header = response.headers.get('retry-after');
  return {
    status: response.status,
    code: error.success ? error.data.code : null,
    reason: reason.success && typed.success ? reason.data : null,
    details: typed.success ? typed.data : null,
    conflict,
    violations: violationsOf(details.violations),
    retryAfterSeconds:
      retryAfterOf(details.retryAfterSeconds) ??
      (header !== null && /^\d{1,5}$/u.test(header)
        ? retryAfterOf(Number(header))
        : null),
    preflightUnavailable:
      response.status === 503 &&
      CmsPreflightUnavailableDetailsSchema.safeParse(details).success,
    requestId: error.success
      ? error.data.requestId
      : requestIdOf(response.headers.get('x-request-id')),
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
 * Send one Slice 11 command. A result of kind `unknown` means the command may
 * have committed: the caller keeps its key, reconciles with a canonical read and
 * only then replays the byte-identical request.
 */
export const sendWorkflowCommand = async <TPath, TBody, TResource>(
  spec: CommandSpec<TPath, TBody, TResource>,
  input: WorkflowCommandInput<TPath, TBody>,
  environment: WorkflowTransportEnvironment = {},
): Promise<WorkflowCommandResult<TResource>> => {
  const documentRef = environment.documentRef ?? document;
  const csrfToken = csrfTokenOf(documentRef);
  if (csrfToken === null) return { kind: 'local', reason: 'csrf_missing' };
  const body = spec.requestSchema.safeParse(input.body);
  const headers = spec.headersSchema.safeParse({
    contentType: 'application/json',
    idempotencyKey: input.idempotencyKey,
    ifMatch: input.ifMatch,
  });
  if (!body.success || !headers.success)
    return { kind: 'local', reason: 'request_invalid' };

  const base = environment.fetcher ?? fetch;
  const path = workflowCommandPath(spec.operationId, input.ids as never);
  let response: Response;
  try {
    response = await base(
      path,
      await addClientBindingIdHeader(path, {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'idempotency-key': headers.data.idempotencyKey,
          'if-match': headers.data.ifMatch,
        },
        body: JSON.stringify(body.data),
      }),
    );
  } catch {
    return { kind: 'unknown', requestId: null };
  }

  const answer = await parsedJson(response);
  const error = ApiErrorSchema.safeParse(answer);
  const requestId = error.success
    ? error.data.requestId
    : requestIdOf(response.headers.get('x-request-id'));

  if (response.ok) {
    const resource = verifyCommandSuccess(spec, input.ids, body.data, {
      status: response.status,
      json: answer,
      etag: response.headers.get('etag'),
      location: response.headers.get('location'),
    });
    return resource === null
      ? { kind: 'unknown', requestId: null }
      : { kind: 'committed', resource, status: response.status };
  }
  if (response.status === 401) {
    const recovery = await classifyStepUpResponse(response);
    return recovery === null
      ? { kind: 'signed-out', requestId }
      : { kind: 'step-up', recovery };
  }
  const refusal = refusalOf(response, error);
  if (refusal.preflightUnavailable) return { kind: 'refused', refusal };
  // A redirect (or an opaque one) is not an answer to the command: the effect
  // is unknown exactly like a 5xx or a marked refusal.
  if (
    response.status >= 500 ||
    response.status < 200 ||
    (response.status >= 300 && response.status < 400) ||
    response.headers.get(UNKNOWN_OUTCOME_HEADER) === 'unknown'
  )
    return { kind: 'unknown', requestId };
  return { kind: 'refused', refusal };
};
