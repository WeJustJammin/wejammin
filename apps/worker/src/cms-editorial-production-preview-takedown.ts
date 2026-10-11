import { z } from 'zod';
import type { Logger } from '@wejammin/observability/logging';

import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
} from './cms-editorial-production-transport';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

/**
 * The preview-token takedown port and adapter (BE03b "Preview token and verification (CMS-03B-08,
 * CMS-03B-19)": a token is revoked "by the service-role takedown RPC"; DEC-156; tracker P2-S11-AC-118).
 *
 * PRINCIPAL: this module is the registered takedown principal's only way to reach
 * `platform_api.cms_takedown_preview_tokens`, which is granted to the Worker service credential alone and is
 * never a browser route. BE03b hands the privacy / security / takedown caller to Shard 16, so nothing else in
 * the Worker may import this module today; the architecture test (`cms-editorial-principals.test.ts`) pins the
 * importers (none) and the RPC name (this file only).
 *
 * The RPC CAS-revokes the unexpired active tokens of an entry and/or a minting person (state `revoked`,
 * `revoked_at`, `version + 1`) and is idempotent, so a repeat after a failure is safe. A takedown must never be
 * assumed: unlike the verifier, which fails closed to a denial, every failure here is a typed
 * `PreviewTakedownError` and the caller keeps the takedown open until a call answers `{ revokedTokens }`.
 */

export const PREVIEW_TAKEDOWN_RPC = 'cms_takedown_preview_tokens' as const;

/** The protected-command deadline (BE00) bounds the whole exchange. */
export const PREVIEW_TAKEDOWN_DEADLINE_MS = 15_000 as const;
/** The answer is one small object. */
const MAX_TAKEDOWN_RESPONSE_BYTES = 4 * 1024;

/** Lowercase RFC 9562 UUID, the only form the database request grammar accepts. */
const IdentifierSchema = z
  .uuid()
  .regex(/^[0-9a-f-]{36}$/u, 'identifier_not_lowercase');

/**
 * The closed database request: the one reason this entry point serves, the correlation id of the cause, and at
 * least one target (an entry, a minting person, or both: both narrow).
 */
export const PreviewTakedownRequestSchema = z
  .strictObject({
    reasonCode: z.literal('takedown'),
    correlationId: IdentifierSchema,
    entryId: IdentifierSchema.optional(),
    personId: IdentifierSchema.optional(),
  })
  .refine(
    (request) =>
      request.entryId !== undefined || request.personId !== undefined,
    { message: 'takedown_target_required' },
  )
  .readonly();

export const PreviewTakedownResultSchema = z
  .strictObject({ revokedTokens: z.number().int().nonnegative() })
  .readonly();

export type PreviewTakedownInput = Readonly<{
  correlationId: string;
  entryId?: string;
  personId?: string;
}>;
export type PreviewTakedownResult = z.infer<typeof PreviewTakedownResultSchema>;

export type PreviewTakedown = (
  input: PreviewTakedownInput,
  signal?: AbortSignal,
) => Promise<PreviewTakedownResult>;

export type PreviewTakedownFailure =
  'invalid_request' | 'not_permitted' | 'unavailable' | 'invalid_response';

/** A takedown that did not provably complete. It carries no payload, identifier or database text. */
export class PreviewTakedownError extends Error {
  readonly code: PreviewTakedownFailure;
  /** True only when the failure is a dependency fault the idempotent call may simply repeat. */
  readonly retryable: boolean;

  constructor(code: PreviewTakedownFailure) {
    super(`The preview takedown did not complete: ${code}.`);
    this.name = 'PreviewTakedownError';
    this.code = code;
    this.retryable = code === 'unavailable';
  }
}

export type PreviewTakedownOptions = Readonly<{
  environment: Readonly<{ SUPABASE_URL: string; SUPABASE_SECRET_KEY: string }>;
  fetchImpl?: typeof fetch;
  /** Milliseconds since the epoch. */
  now?: () => number;
  deadlineMs?: number;
  logger?: Logger;
}>;

const statusFailure = (status: number): PreviewTakedownFailure => {
  if (status === 401 || status === 403) return 'not_permitted';
  if (status >= 400 && status < 500 && status !== 408 && status !== 409)
    return 'invalid_request';
  return 'unavailable';
};

/** Compose the takedown over the service RPC transport. */
export const createPreviewTakedown = (
  options: PreviewTakedownOptions,
): PreviewTakedown => {
  const configuration = {
    baseUrl: options.environment.SUPABASE_URL.replace(/\/+$/u, ''),
    secret: options.environment.SUPABASE_SECRET_KEY,
    fetchImpl:
      options.fetchImpl ?? ((url, init) => globalThis.fetch(url, init)),
    maxResponseBytes: MAX_TAKEDOWN_RESPONSE_BYTES,
    now: options.now ?? Date.now,
  };
  const deadlineMs = options.deadlineMs ?? PREVIEW_TAKEDOWN_DEADLINE_MS;

  const record = (
    outcome: 'success' | 'failure',
    correlationId: string | undefined,
    detail: Readonly<{ revokedTokens?: number; code?: PreviewTakedownFailure }>,
  ): void => {
    options.logger?.[outcome === 'success' ? 'info' : 'warn'](
      {
        eventName:
          outcome === 'success'
            ? 'cms.preview.takedown'
            : 'cms.preview.takedown.failed',
        operation: 'cms.preview.takedown',
        outcome,
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(detail.code === undefined
          ? {}
          : {
              errorCode: detail.code,
              retryable: detail.code === 'unavailable',
            }),
        ...(detail.revokedTokens === undefined
          ? {}
          : { attributes: { revokedTokens: detail.revokedTokens } }),
      },
      { samplingClass: 'always', highRisk: outcome === 'failure' },
    );
  };

  const call = async (
    request: z.infer<typeof PreviewTakedownRequestSchema>,
    signal: AbortSignal | undefined,
  ): Promise<PreviewTakedownResult> => {
    const deadline = createDeadline(
      signal ?? new AbortController().signal,
      deadlineMs,
    );
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/${PREVIEW_TAKEDOWN_RPC}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_request: request }),
        },
        deadline,
      );
      if (!response.ok) throw new PreviewTakedownError('unavailable');
      if (!response.value.ok)
        throw new PreviewTakedownError(statusFailure(response.value.status));
      const body = await parseJsonResponse(
        response.value,
        configuration.maxResponseBytes,
        deadline.signal,
      );
      if (!body.ok) throw new PreviewTakedownError('invalid_response');
      const parsed = PreviewTakedownResultSchema.safeParse(body.value);
      if (!parsed.success) throw new PreviewTakedownError('invalid_response');
      return parsed.data;
    } finally {
      deadline.dispose();
    }
  };

  return async (input, signal) => {
    const request = PreviewTakedownRequestSchema.safeParse({
      reasonCode: 'takedown',
      ...input,
    });
    // A malformed takedown never reaches the transport.
    if (!request.success) {
      const failure = new PreviewTakedownError('invalid_request');
      // The malformed input is never echoed: not even its correlation id reaches the log.
      record('failure', undefined, { code: failure.code });
      throw failure;
    }
    try {
      const result = await call(request.data, signal);
      record('success', request.data.correlationId, {
        revokedTokens: result.revokedTokens,
      });
      return result;
    } catch (error) {
      const failure =
        error instanceof PreviewTakedownError
          ? error
          : new PreviewTakedownError('unavailable');
      record('failure', request.data.correlationId, { code: failure.code });
      throw failure;
    }
  };
};
