import {
  PatternLatestApiRequestSchema,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { correlationFor } from './cms-editorial-production-session';
import {
  isRecord,
  mapCmsEditorialRpcFailure,
  codeFromRpcError,
} from './cms-editorial-production-errors';
import { SERIALIZATION_TOKENS } from './cms-editorial-production-error-tokens';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
} from './cms-editorial-production-transport';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import { supabaseRpcHeaders } from './supabase-rpc-headers';
import { validHumanSession } from './cms-editorial/admission-identity';
import { carriesProductToken } from './cms-composition/provider-fault-guard';
import {
  BLOCK_RULES_REASON,
  blockRulesDetails,
} from './cms-composition/block-rules-refusal';
import {
  failure,
  PATTERN_MAX_BYTES,
  serializedBytesWithin,
  validPatternDetail,
  type CmsPatternDefinitionDependencies,
  type PatternOperation,
  type PatternPortContext,
  type PatternResult,
} from './cms-composition/pattern-definition-ports';

export type PatternContextVerifier = (
  input: PatternPortContext & { operationId: PatternOperation },
  signal: AbortSignal,
) => Promise<PatternResult<Readonly<Record<string, unknown>>>>;
export type PatternTransport = Readonly<{
  configuration: CmsEditorialProductionConfiguration;
  verify: PatternContextVerifier;
  deadlineMs: number;
}>;

/** Named tokens only: prose and supplied details never select a refusal. */
const patternRpcError = (
  operation: PatternOperation,
  status: number,
  payload: unknown,
) => {
  if (
    isRecord(payload) &&
    payload.code === '40001' &&
    SERIALIZATION_TOKENS.has(codeFromRpcError(payload))
  )
    return mapCmsEditorialRpcFailure(status, payload);
  if (
    isRecord(payload) &&
    (payload.code === 'INTERNAL_ERROR' ||
      (payload.code === 'P0001' && payload.message === 'INTERNAL_ERROR'))
  )
    return failure(500);
  if (status >= 500) return failure(503, {}, 15);
  const reason = CmsSlice12ReasonCodeSchema.safeParse(
    isRecord(payload) && payload.code === 'P0001' ? payload.message : undefined,
  );
  if (reason.success) {
    if (
      !(
        CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]
      ).includes(reason.data)
    )
      return failure(500);
    // DEC-210: the one reason that relays its pointer, the offending node of the request `blockTree`.
    // A reason token is only parsed from a record whose `code` is P0001, so `payload` is a record here.
    if (reason.data === BLOCK_RULES_REASON)
      return failure(
        cmsSlice12ReasonStatus(reason.data),
        blockRulesDetails(
          (payload as Readonly<Record<string, unknown>>).details,
          'CMS-03C-12',
        ),
      );
    return failure(cmsSlice12ReasonStatus(reason.data), {
      reasonCode: reason.data,
    });
  }
  // A 4xx that carries no product token is a provider fault, not a refusal (BE03c 1298-1302).
  if (!carriesProductToken(payload)) return failure(500);
  const result = mapCmsEditorialRpcFailure(status, payload);
  // Reasons from another editorial domain cannot cross this operation boundary.
  if (result.details?.reasonCode !== undefined) return failure(500);
  return result;
};

/** Shared authenticated transport. No retries; header and body share one timer. */
export const callPatternRpc = async (
  transport: PatternTransport,
  input: PatternPortContext & { operationId: PatternOperation },
  payload: object,
  signal: AbortSignal,
  write?: { idempotencyKey: string; ifMatch: string | null },
): Promise<PatternResult<unknown>> => {
  const { configuration, verify, deadlineMs } = transport;
  if (
    input.session === null ||
    typeof input.session !== 'object' ||
    validHumanSession(input.session) !== null
  )
    return failure(401);
  if (
    input.session.actingPartyId === null ||
    !input.session.capabilities.includes('cms.template_designer')
  )
    return failure(403, { reasonCode: 'capability_missing' });
  const limit = Math.min(PATTERN_MAX_BYTES, configuration.maxResponseBytes);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Profile': 'platform_api',
    'Content-Profile': 'platform_api',
    'Content-Type': 'application/json',
    ...supabaseRpcHeaders(configuration.secret),
    'X-Operation-Id': input.operationId,
    'X-Request-Id': input.requestId,
    'X-Correlation-Id': correlationFor(input),
  };
  if (write !== undefined) {
    headers['X-Idempotency-Key'] = write.idempotencyKey;
    if (write.ifMatch !== null) headers['If-Match'] = `"${write.ifMatch}"`;
  }
  const rpc =
    input.operationId === 'CMS-03C-12'
      ? 'cms_create_pattern_version'
      : 'cms_pattern_latest';
  const deadline = createDeadline(signal, deadlineMs);
  let answer: Response | undefined;
  let removeVerifyListener = () => {};
  try {
    if (deadline.signal.aborted) return failure(504, {}, 15);
    const context = await new Promise<
      Awaited<ReturnType<PatternContextVerifier>>
    >((resolve) => {
      const abort = () => resolve(failure(504, {}, 15));
      deadline.signal.addEventListener('abort', abort, { once: true });
      removeVerifyListener = () =>
        deadline.signal.removeEventListener('abort', abort);
      void verify(input, deadline.signal).then(resolve, () =>
        resolve(failure(503, {}, 15)),
      );
    });
    removeVerifyListener();
    if (!context.ok) return context;
    if (deadline.signal.aborted) return failure(504, {}, 15);
    const p_request = {
      ...payload,
      context: context.value,
      ...(write === undefined
        ? {}
        : {
            idempotencyKey: write.idempotencyKey,
            ...(write.ifMatch === null ? {} : { ifMatch: write.ifMatch }),
            correlationId: correlationFor(input),
          }),
    };
    if (!serializedBytesWithin({ p_request }, limit)) return failure(400);
    const fetched = await fetchWithDeadline(
      configuration,
      `${configuration.baseUrl}/rest/v1/rpc/${rpc}`,
      { method: 'POST', headers, body: JSON.stringify({ p_request }) },
      deadline,
    );
    if (!fetched.ok) return fetched;
    answer = fetched.value;
    const parsed = await parseJsonResponse(answer, limit, deadline.signal);
    if (deadline.signal.aborted) return failure(504, {}, 15);
    if (!parsed.ok) return parsed;
    if (!answer.ok)
      return patternRpcError(input.operationId, answer.status, parsed.value);
    return parsed;
  } catch {
    return deadline.signal.aborted
      ? failure(504, {}, 15)
      : failure(503, {}, 15);
  } finally {
    removeVerifyListener();
    // Early media/declared-size refusal must release an unread body too.
    if (
      answer?.body !== null &&
      answer?.body !== undefined &&
      !answer.body.locked
    )
      void answer.body.cancel().catch(() => undefined);
    deadline.dispose();
  }
};

export const createPatternLatestReader =
  (
    transport: PatternTransport,
  ): CmsPatternDefinitionDependencies['readLatest'] =>
  async (input, signal) => {
    if (
      input.operationId !== 'cmsPatternLatestRead' ||
      !PatternLatestApiRequestSchema.safeParse({ patternKey: input.patternKey })
        .success
    )
      return failure(400);
    const result = await callPatternRpc(
      transport,
      input,
      { patternKey: input.patternKey },
      signal,
    );
    if (!result.ok) return result;
    return validPatternDetail(result.value, input.patternKey)
      ? { ok: true, value: result.value }
      : failure(502);
  };
