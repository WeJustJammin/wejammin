import { correlationFor } from './cms-editorial-production-session';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
} from './cms-editorial-production-transport';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import { supabaseRpcHeaders } from './supabase-rpc-headers';
import { validHumanSession } from './cms-editorial/admission-identity';
import {
  committedRefusal,
  governedRpcError,
} from './cms-composition-production-governed-review-errors';
import { policyOf } from './cms-composition/governed-review-policy';
import {
  failure,
  GOVERNED_MAX_BYTES,
  governedGate,
  serializedBytesWithin,
  type GovernedPortInput,
  type GovernedResult,
} from './cms-composition/governed-review-ports';

export { governedRpcError };

export type GovernedContextVerifier = (
  input: GovernedPortInput,
  signal: AbortSignal,
) => Promise<GovernedResult<Readonly<Record<string, unknown>>>>;
export type GovernedTransport = Readonly<{
  configuration: CmsEditorialProductionConfiguration;
  verify: GovernedContextVerifier;
  deadlineMs: number;
}>;

/**
 * Authenticated transport. No retries; header and body share one timer, bounded by the
 * operation deadline (15,000ms commands, 8,000ms reads). `request` is the exact
 * `p_request` member set the SQL producer accepts; `idempotencyKey` is non-null exactly
 * on the commands (it also travels in `request`).
 */
export const callGovernedRpc = async (
  transport: GovernedTransport,
  input: GovernedPortInput,
  request: Readonly<Record<string, unknown>>,
  signal: AbortSignal,
  idempotencyKey: string | null,
): Promise<GovernedResult<unknown>> => {
  const { configuration, verify } = transport;
  const policy = policyOf(input.operationId);
  const deadlineMs = Math.min(transport.deadlineMs, policy.deadlineMs);
  if (
    input.session === null ||
    typeof input.session !== 'object' ||
    validHumanSession(input.session) !== null
  )
    return failure(401);
  const gate = governedGate(input.operationId, input.session);
  if (gate !== null) return gate;
  const limit = Math.min(GOVERNED_MAX_BYTES, configuration.maxResponseBytes);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Profile': 'platform_api',
    'Content-Profile': 'platform_api',
    'Content-Type': 'application/json',
    ...supabaseRpcHeaders(configuration.secret),
    'X-Operation-Id': input.operationId,
    'X-Request-Id': input.requestId,
    'X-Correlation-Id': correlationFor(input),
    ...(idempotencyKey === null ? {} : { 'X-Idempotency-Key': idempotencyKey }),
  };
  const deadline = createDeadline(signal, deadlineMs);
  let answer: Response | undefined;
  let removeVerifyListener = () => {};
  try {
    if (deadline.signal.aborted) return failure(504, {}, 15);
    const context = await new Promise<
      Awaited<ReturnType<GovernedContextVerifier>>
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
      ...request,
      context: context.value,
      correlationId: correlationFor(input),
    };
    if (!serializedBytesWithin({ p_request }, limit)) return failure(400);
    const fetched = await fetchWithDeadline(
      configuration,
      `${configuration.baseUrl}/rest/v1/rpc/${policy.rpc}`,
      { method: 'POST', headers, body: JSON.stringify({ p_request }) },
      deadline,
    );
    if (!fetched.ok) return fetched;
    answer = fetched.value;
    const parsed = await parseJsonResponse(answer, limit, deadline.signal);
    if (deadline.signal.aborted) return failure(504, {}, 15);
    if (!parsed.ok) return parsed;
    if (!answer.ok)
      return governedRpcError(input.operationId, answer.status, parsed.value);
    return committedRefusal(input.operationId, parsed.value) ?? parsed;
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
