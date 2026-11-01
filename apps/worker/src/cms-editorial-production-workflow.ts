import {
  CMS_SLICE_11_CONFLICT_REASONS,
  CMS_SLICE_11_FORBIDDEN_REASONS,
  CMS_SLICE_11_VALIDATION_REASONS,
  EntryWorkflowQuerySchema,
  PreflightEvidenceSchema,
  ReviewQueueQuerySchema,
} from '@wejammin/contracts';

import {
  errorResult,
  invalidResponse,
  isRecord,
  structuredMembers,
} from './cms-editorial-production-errors';
import { failureForToken } from './cms-editorial-production-error-tokens';
import type { CmsEditorialPortInput } from './cms-editorial-production-session';
import {
  UUID_PATTERN,
  type CmsEditorialProductionOperationId,
  type CmsEditorialProductionResult,
} from './cms-editorial-production-types';

/**
 * The Slice 11 port boundary (BE03b CMS-03B-05..09 and 15..18): the structural
 * preconditions an adapter input must satisfy before any RPC is issued, and the
 * closed refusal disposition a command RPC returns when its refusal must
 * commit state. Authority is never read here: the browser supplies none, and
 * the database re-derives scope, separation of duties and step-up.
 */

type WorkflowShape = Readonly<{
  method: 'GET' | 'POST';
  pathKeys: readonly ('entryId' | 'reviewId')[];
  /** A command carries a body, an Idempotency-Key and a strong If-Match. */
  command: boolean;
  /** The server-built accessibility proof rides on this operation's input. */
  evidence: boolean;
}>;

const SHAPES: Readonly<Record<string, WorkflowShape>> = {
  'CMS-03B-05': {
    method: 'POST',
    pathKeys: ['entryId'],
    command: true,
    evidence: true,
  },
  'CMS-03B-06': {
    method: 'POST',
    pathKeys: ['reviewId'],
    command: true,
    evidence: false,
  },
  'CMS-03B-07': { method: 'POST', pathKeys: [], command: true, evidence: true },
  'CMS-03B-08': {
    method: 'POST',
    pathKeys: [],
    command: true,
    evidence: false,
  },
  'CMS-03B-09': { method: 'POST', pathKeys: [], command: true, evidence: true },
  'CMS-03B-15': {
    method: 'GET',
    pathKeys: ['entryId'],
    command: false,
    evidence: true,
  },
  'CMS-03B-16': {
    method: 'GET',
    pathKeys: ['reviewId'],
    command: false,
    evidence: false,
  },
  'CMS-03B-17': {
    method: 'GET',
    pathKeys: [],
    command: false,
    evidence: false,
  },
  'CMS-03B-18': {
    method: 'POST',
    pathKeys: ['reviewId'],
    command: true,
    evidence: false,
  },
};

/** The Slice 11 operations that mutate (the others are safe reads). */
export const isWorkflowCommand = (
  operationId: CmsEditorialProductionOperationId,
): boolean => SHAPES[operationId]?.command === true;

const precondition = () =>
  errorResult(400, 'INVALID_REQUEST', 'The CMS editorial request is invalid.', {
    reasonCode: 'workflow_precondition_invalid',
  });

const pathValid = (
  input: CmsEditorialPortInput,
  shape: WorkflowShape,
): boolean => {
  const path = (input.path ?? {}) as Readonly<Record<string, unknown>>;
  const keys = Object.keys(path);
  return (
    keys.length === shape.pathKeys.length &&
    shape.pathKeys.every((key) => {
      const value = path[key];
      return typeof value === 'string' && UUID_PATTERN.test(value);
    })
  );
};

const evidenceValid = (
  input: CmsEditorialPortInput,
  shape: WorkflowShape,
): boolean =>
  shape.evidence
    ? input.evidence !== undefined &&
      (input.evidence === null ||
        PreflightEvidenceSchema.safeParse(input.evidence).success)
    : input.evidence === undefined;

const transportValid = (
  input: CmsEditorialPortInput,
  shape: WorkflowShape,
): boolean =>
  input.request.method === shape.method &&
  (shape.command
    ? isRecord(input.body) &&
      input.query === undefined &&
      input.idempotencyKey !== undefined &&
      input.ifMatch !== undefined
    : input.body === undefined &&
      input.idempotencyKey === undefined &&
      input.ifMatch === undefined &&
      input.request.body === null);

const queryValid = (
  input: CmsEditorialPortInput,
  operationId: CmsEditorialProductionOperationId,
): boolean => {
  if (operationId === 'CMS-03B-15') {
    const parsed = EntryWorkflowQuerySchema.safeParse(input.query);
    return parsed.success && parsed.data.entryId === input.path?.entryId;
  }
  if (operationId === 'CMS-03B-17')
    return ReviewQueueQuerySchema.safeParse(input.query ?? {}).success;
  return input.query === undefined;
};

/**
 * Reject an adapter input whose transport shape cannot be trusted, before any
 * RPC. Returns null when it is valid (or the operation is not a Slice 11 one).
 */
export const validateWorkflowPortInput = (
  input: CmsEditorialPortInput,
  operationId: CmsEditorialProductionOperationId,
): ReturnType<typeof precondition> | ReturnType<typeof errorResult> | null => {
  const shape = SHAPES[operationId];
  if (shape === undefined) return null;
  if (
    !pathValid(input, shape) ||
    !transportValid(input, shape) ||
    !evidenceValid(input, shape) ||
    !queryValid(input, operationId)
  )
    return precondition();
  // CMS-03B-06 names the review twice: the path and the body must agree.
  if (
    operationId === 'CMS-03B-06' &&
    (input.body as Readonly<Record<string, unknown>>).reviewId !==
      input.path?.reviewId
  )
    return errorResult(
      422,
      'VALIDATION_FAILED',
      'The CMS editorial request failed validation.',
      {
        reasonCode: 'review_id_mismatch',
        violations: [
          {
            path: '/reviewId',
            code: 'mismatch',
            message: 'The value is invalid.',
          },
        ],
      },
    );
  return null;
};

const REFUSAL_KEYS: ReadonlySet<string> = new Set([
  'kind',
  'reasonCode',
  'details',
]);

const TYPED_REFUSALS: ReadonlySet<string> = new Set([
  ...CMS_SLICE_11_FORBIDDEN_REASONS,
  ...CMS_SLICE_11_CONFLICT_REASONS,
  ...CMS_SLICE_11_VALIDATION_REASONS,
]);

/**
 * A refusal that must commit state (a decision, schedule or publication refused
 * as `dependency_changed` commits the review invalidation) cannot be raised:
 * an exception would roll the invalidation back. The command RPC returns this
 * closed disposition on HTTP 200 instead, and only the typed Slice 11 tokens
 * qualify. The status, code and message come from the token table, never from
 * the payload. A payload that is not exactly that shape is a 502.
 */
export const committedRefusal = (
  value: unknown,
): CmsEditorialProductionResult<never> | null => {
  if (!isRecord(value) || value.kind !== 'refusal') return null;
  const token = value.reasonCode;
  const mapped =
    typeof token === 'string' && TYPED_REFUSALS.has(token)
      ? failureForToken(token)
      : null;
  if (
    mapped === null ||
    !Object.keys(value).every((key) => REFUSAL_KEYS.has(key)) ||
    (value.details !== undefined && !isRecord(value.details))
  )
    return invalidResponse();
  return errorResult(mapped.status, mapped.code, mapped.message, {
    ...structuredMembers(value.details),
    ...mapped.details,
  });
};
