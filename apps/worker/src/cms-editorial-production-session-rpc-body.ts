import {
  EntryDraftDetailQuerySchema,
  RevisionHistoryQuerySchema,
} from '@wejammin/contracts';

import { errorResult } from './cms-editorial-production-errors';
import {
  BARE_VERSION_PATTERN,
  CMS_EDITORIAL_FORBIDDEN_AUTHORITY_KEYS,
  UUID_PATTERN,
  type CmsEditorialProductionOperationId,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import {
  cmsEditorialContextFor,
  type CmsEditorialPortInput,
} from './cms-editorial-production-session';

/**
 * Reject caller-supplied authority before the body reaches the RPC. BE03b
 * (line 1030 / AC005) requires a rejection with no mutation: silently stripping
 * an owner, assignee, capability, or authority key would let a browser believe
 * it influenced server-derived authority. The violation is reported by key name
 * only, never by echoed value.
 */
export const authorityRejection = (keys: readonly string[]) => {
  const violations = keys.map((key) => `body.${key}`);
  return errorResult(
    422,
    'VALIDATION_FAILED',
    'The CMS editorial request failed validation.',
    {
      reasonCode: 'caller_authority_rejected',
      violations,
      authorityKeys: keys,
    },
  );
};

/**
 * The body's `entryId` is bound from the path. A disagreement is a 422 rather
 * than a silent path-wins, so a caller cannot probe one entry while writing
 * another.
 */
const readEntryId = (body: object | undefined): string | undefined => {
  if (body === undefined) return undefined;
  const value = (body as Readonly<Record<string, unknown>>).entryId;
  return typeof value === 'string' ? value : undefined;
};

const entryIdMatches = (input: CmsEditorialPortInput): boolean => {
  const pathEntryId = input.path?.entryId;
  const bodyEntryId = readEntryId(input.body);
  if (pathEntryId === undefined || bodyEntryId === undefined) return true;
  return pathEntryId === bodyEntryId;
};

const conflictIdMatches = (input: CmsEditorialPortInput): boolean => {
  const pathConflictId = input.path?.conflictId;
  const bodyConflictId = (
    input.body as Readonly<Record<string, unknown>> | undefined
  )?.conflictId;
  return (
    typeof pathConflictId === 'string' &&
    typeof bodyConflictId === 'string' &&
    pathConflictId === bodyConflictId
  );
};

/**
 * Reject a port input whose declared operation or validator cannot be trusted
 * before any transport call is issued. Returns null when the input is valid.
 */
export const validateCmsEditorialPortInput = (
  input: CmsEditorialPortInput,
  expectedOperationId: CmsEditorialProductionOperationId,
): ReturnType<typeof authorityRejection> | null => {
  if (input.operationId !== expectedOperationId)
    return errorResult(
      400,
      'INVALID_REQUEST',
      'The CMS editorial request is invalid.',
      { reasonCode: 'operation_mismatch' },
    );
  if (
    expectedOperationId === 'CMS-03B-10' &&
    (input.path !== undefined || input.ifMatch !== undefined)
  )
    return errorResult(
      400,
      'INVALID_REQUEST',
      'Initial entry creation has no path or If-Match validator.',
      { reasonCode: 'create_precondition_invalid' },
    );
  if (expectedOperationId === 'CMS-03B-03') {
    const pathEntryId = input.path?.entryId;
    const query = RevisionHistoryQuerySchema.safeParse(input.query);
    if (
      typeof pathEntryId !== 'string' ||
      !UUID_PATTERN.test(pathEntryId) ||
      Object.keys(input.path ?? {}).length !== 1 ||
      !query.success ||
      query.data.entryId !== pathEntryId ||
      input.body !== undefined ||
      input.idempotencyKey !== undefined ||
      input.ifMatch !== undefined ||
      input.request.method !== 'GET' ||
      input.request.body !== null ||
      input.request.headers.has('idempotency-key') ||
      input.request.headers.has('if-match') ||
      new URL(input.request.url).pathname !==
        `/api/v1/cms/entries/${pathEntryId}/revisions`
    )
      return errorResult(
        400,
        'INVALID_REQUEST',
        'The CMS editorial read request is invalid.',
        { reasonCode: 'history_read_precondition_invalid' },
      );
  }
  if (expectedOperationId === 'CMS-03B-11') {
    const pathEntryId = input.path?.entryId;
    const query = EntryDraftDetailQuerySchema.safeParse(input.query);
    if (
      typeof pathEntryId !== 'string' ||
      !UUID_PATTERN.test(pathEntryId) ||
      Object.keys(input.path ?? {}).length !== 1 ||
      !query.success ||
      query.data.entryId !== pathEntryId ||
      input.body !== undefined ||
      input.idempotencyKey !== undefined ||
      input.ifMatch !== undefined ||
      input.request.method !== 'GET' ||
      input.request.body !== null
    )
      return errorResult(
        400,
        'INVALID_REQUEST',
        'The CMS editorial read request is invalid.',
        { reasonCode: 'draft_read_precondition_invalid' },
      );
  }
  if (input.ifMatch !== undefined && !BARE_VERSION_PATTERN.test(input.ifMatch))
    return errorResult(
      400,
      'INVALID_REQUEST',
      'The CMS editorial request is invalid.',
      { reasonCode: 'if_match_invalid', violations: ['header.if-match'] },
    );
  if (!entryIdMatches(input))
    return errorResult(
      422,
      'VALIDATION_FAILED',
      'The CMS editorial request failed validation.',
      { reasonCode: 'entry_id_mismatch', violations: ['body.entryId'] },
    );
  if (expectedOperationId === 'CMS-03B-02' && !conflictIdMatches(input))
    return errorResult(
      422,
      'VALIDATION_FAILED',
      'The CMS editorial request failed validation.',
      { reasonCode: 'conflict_id_mismatch', violations: ['body.conflictId'] },
    );
  return null;
};

const cmsEditorialRpcBodyUnchecked = (
  input: CmsEditorialPortInput,
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
  now: () => number,
  body: Readonly<Record<string, unknown>>,
  expectedVersion: string | undefined,
): Readonly<Record<string, unknown>> => ({
  ...body,
  ...(input.path ?? {}),
  ...(input.query ?? {}),
  ...(input.idempotencyKey === undefined
    ? {}
    : { idempotencyKey: input.idempotencyKey }),
  ...(expectedVersion === undefined
    ? {}
    : { expectedVersion, ifMatch: input.ifMatch }),
  context: cmsEditorialContextFor(input, contexts, now),
});

/**
 * Build the protected RPC body, or reject with the fail-closed error. Authority
 * projection, If-Match, entry-id agreement, and operation binding are all
 * checked here so no invalid input can reach the transport.
 */
export const cmsEditorialRpcBodyFor = (
  input: CmsEditorialPortInput,
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
  now: () => number,
  expectedOperationId: CmsEditorialProductionOperationId,
):
  | Readonly<{ ok: true; value: Readonly<Record<string, unknown>> }>
  | ReturnType<typeof authorityRejection> => {
  const guard = validateCmsEditorialPortInput(input, expectedOperationId);
  if (guard !== null) return guard;
  const projected = projectEditorialBody(input.body);
  if (!projected.ok) return projected;
  let expectedVersion: string | undefined;
  // The guard above proved an exact strong bare decimal, so the header value
  // is adopted verbatim and the body's own expectedVersion is overwritten.
  if (input.ifMatch !== undefined) expectedVersion = input.ifMatch;
  return {
    ok: true,
    value: cmsEditorialRpcBodyUnchecked(
      input,
      contexts,
      now,
      projected.value,
      expectedVersion,
    ),
  };
};

export const projectEditorialBody = (
  body: object | undefined,
):
  | Readonly<{ ok: true; value: Readonly<Record<string, unknown>> }>
  | ReturnType<typeof authorityRejection> => {
  if (body === undefined) return { ok: true, value: {} };
  const record = body as Readonly<Record<string, unknown>>;
  const forbidden = (
    CMS_EDITORIAL_FORBIDDEN_AUTHORITY_KEYS as readonly string[]
  ).filter((key) => Object.prototype.hasOwnProperty.call(record, key));
  if (forbidden.length > 0) return authorityRejection(forbidden);
  return { ok: true, value: { ...record } };
};
