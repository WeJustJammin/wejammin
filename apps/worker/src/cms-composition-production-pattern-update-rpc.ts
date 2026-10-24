import { patternUpdateRpcFailure } from './cms-composition-production-pattern-update-failure';
import { createFreshContextVerifier } from './cms-editorial-production-fresh-context';
import {
  correlationFor,
  type createCmsEditorialSessionResolver,
} from './cms-editorial-production-session';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import {
  PATTERN_UPDATE_OPERATIONS,
  type PatternUpdateOperation,
} from './cms-composition/pattern-update-operations';
import {
  failure,
  validEnvelope,
  type PatternUpdateContext,
  type PatternUpdateError,
  type PatternUpdateResult,
} from './cms-composition/pattern-update-ports';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

export type PatternUpdateRpcInput = PatternUpdateContext &
  Readonly<{ operationId: PatternUpdateOperation }>;
/** The parsed answer and the response `ETag` text (null when the producer set none). */
export type PatternUpdateRpcAnswer = Readonly<{
  value: unknown;
  etag: string | null;
}>;
export type PatternUpdateContextVerifier = (
  input: PatternUpdateRpcInput,
  signal: AbortSignal,
) => Promise<PatternUpdateResult<Readonly<Record<string, unknown>>>>;
export type PatternUpdateRpc = (
  input: PatternUpdateRpcInput,
  payload: Readonly<Record<string, unknown>>,
  signal: AbortSignal,
  write?: Readonly<{ idempotencyKey: string; ifMatch: string }>,
) => Promise<PatternUpdateResult<PatternUpdateRpcAnswer>>;

const RETRY_SECONDS = 15;

/**
 * Request-bound server authority of every linked-update RPC. The RPC context is rebuilt from a FRESH resolution of the
 * very Request the route admitted: the same session, user and acting party must come back (a different one is a 401),
 * the author or editor capability is proved again (a revoked grant is a 403 before any network), and the public body
 * never names the actor, party or capability. The database re-proves all of it under its own locks regardless; this is
 * the transport convenience, not the authority.
 */
export const createPatternUpdateContextVerifier = (
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
  resolveSession: ReturnType<typeof createCmsEditorialSessionResolver>,
  configuration: CmsEditorialProductionConfiguration,
): PatternUpdateContextVerifier =>
  createFreshContextVerifier<PatternUpdateRpcInput, PatternUpdateError>({
    contexts,
    resolveSession,
    configuration,
    failure,
    validEnvelope,
    authorize: (session) =>
      session.actingPartyId === null ||
      !session.capabilities.some(
        (capability) =>
          capability === 'cms.author' || capability === 'cms.editor',
      )
        ? failure(403, { reasonCode: 'capability_missing' })
        : null,
  });

/**
 * The named-RPC caller: ONE call, no retry, one deadline over the headers and the body. The registry deadline of the
 * operation narrows the configured one; the answer text is read under the operation's byte ceiling. A failing answer is
 * mapped by token (`patternUpdateRpcFailure`); a malformed, oversized or non-JSON success is a local 502.
 */
export const createPatternUpdateRpc =
  (
    configuration: CmsEditorialProductionConfiguration,
    verify: PatternUpdateContextVerifier,
    deadlineMs: number,
  ): PatternUpdateRpc =>
  async (input, payload, signal, write) => {
    const spec = PATTERN_UPDATE_OPERATIONS[input.operationId];
    const limit = Math.min(spec.wireBytes, configuration.maxResponseBytes);
    const deadline = createDeadline(
      signal,
      Math.min(deadlineMs, spec.deadlineMs),
    );
    let response: Response | undefined;
    let removeVerifyListener = (): void => undefined;
    try {
      if (deadline.signal.aborted) return failure(504, {}, RETRY_SECONDS);
      const context = await new Promise<
        Awaited<ReturnType<PatternUpdateContextVerifier>>
      >((resolve) => {
        const abort = (): void => resolve(failure(504, {}, RETRY_SECONDS));
        deadline.signal.addEventListener('abort', abort, { once: true });
        removeVerifyListener = (): void =>
          deadline.signal.removeEventListener('abort', abort);
        void verify(input, deadline.signal).then(resolve, () =>
          resolve(failure(503, {}, RETRY_SECONDS)),
        );
      });
      removeVerifyListener();
      if (!context.ok) return context;
      if (deadline.signal.aborted) return failure(504, {}, RETRY_SECONDS);
      const correlationId = correlationFor(input);
      const headers = new Headers({
        Accept: 'application/json',
        'Accept-Profile': 'platform_api',
        ...supabaseRpcHeaders(configuration.secret),
        'Content-Profile': 'platform_api',
        'Content-Type': 'application/json',
        'X-Operation-Id': input.operationId,
        'X-Request-Id': input.requestId,
        'X-Correlation-Id': correlationId,
      });
      if (write !== undefined) {
        headers.set('X-Idempotency-Key', write.idempotencyKey);
        headers.set('If-Match', `"${write.ifMatch}"`);
      }
      const transport = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/${spec.rpc}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            p_request: {
              ...payload,
              ...(write === undefined
                ? {}
                : {
                    idempotencyKey: write.idempotencyKey,
                    ifMatch: write.ifMatch,
                  }),
              context: context.value,
              correlationId,
            },
          }),
        },
        deadline,
      );
      if (!transport.ok) return failure(transport.status, {}, RETRY_SECONDS);
      response = transport.value;
      if (!response.ok) {
        const payloadError = await readRpcError(
          response,
          limit,
          deadline.signal,
        );
        return deadline.signal.aborted
          ? failure(504, {}, RETRY_SECONDS)
          : patternUpdateRpcFailure(
              input.operationId,
              response.status,
              payloadError,
            );
      }
      const parsed = await parseJsonResponse(response, limit, deadline.signal);
      if (deadline.signal.aborted) return failure(504, {}, RETRY_SECONDS);
      if (!parsed.ok) return failure(502);
      return {
        ok: true,
        value: { value: parsed.value, etag: response.headers.get('etag') },
      };
    } catch {
      return deadline.signal.aborted
        ? failure(504, {}, RETRY_SECONDS)
        : failure(503, {}, RETRY_SECONDS);
    } finally {
      removeVerifyListener();
      if (
        response?.body !== null &&
        response?.body !== undefined &&
        !response.bodyUsed
      )
        void response.body.cancel().catch(() => undefined);
      deadline.dispose();
    }
  };
