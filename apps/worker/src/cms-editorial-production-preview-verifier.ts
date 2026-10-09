import {
  CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS,
  CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS,
  CMS_PREVIEW_VERIFIER_TIMEOUT_MS,
  CmsPreviewTokenSchema,
  PreviewVerificationRequestSchema,
  PreviewVerificationResultSchema,
  previewVerificationDenial,
  type PreviewVerificationResult,
} from '@wejammin/contracts';
import type { Logger } from '@wejammin/observability/logging';

import { metricKey } from './content-schema-registry/route-metric-key';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
} from './cms-editorial-production-transport';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

/**
 * CMS-03B-19, the preview-token verifier port and adapter (BE03b "Internal
 * service operations", BE04c "Transport and external seams").
 *
 * PRINCIPAL: this module is the registered Shard 04 delivery principal's only
 * way to reach `platform_api.cms_verify_preview_token`. Nothing else in the
 * Worker may import it; the architecture test pins the importers (today none:
 * Slice 15 adds the delivery adapter).
 *
 * The presented token never leaves this module: the RPC receives only the
 * lowercase SHA-256 of its UTF-8 bytes. Every unknown, ambiguous, malformed,
 * timed-out or failed outcome is the one byte-identical denial, so the verifier
 * is no existence oracle; only the bound actor's own `revoked` flag is passed
 * through from the database.
 */

export const PREVIEW_VERIFIER_RPC = 'cms_verify_preview_token' as const;

/** A verification answer is a small envelope. */
const MAX_VERIFIER_RESPONSE_BYTES = 16 * 1024;

export type PreviewVerificationInput = Readonly<{
  /** The presented plaintext token; hashed here and never sent. */
  token: string;
  actorPersonId: string;
  actingContextVersion: string;
  route: string;
  locale: string;
  audience: string;
}>;

export type PreviewTokenVerifier = (
  input: PreviewVerificationInput,
  signal?: AbortSignal,
) => Promise<PreviewVerificationResult>;

export type PreviewVerifierOptions = Readonly<{
  environment: Readonly<{ SUPABASE_URL: string; SUPABASE_SECRET_KEY: string }>;
  fetchImpl?: typeof fetch;
  /** Milliseconds since the epoch; drives the circuit window. */
  now?: () => number;
  /** Pause between attempts; injectable so tests need no real time. */
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: Logger;
}>;

const sha256Hex = async (text: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Compose the verifier over the service RPC transport. */
export const createPreviewTokenVerifier = (
  options: PreviewVerifierOptions,
): PreviewTokenVerifier => {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const configuration = {
    baseUrl: options.environment.SUPABASE_URL.replace(/\/+$/u, ''),
    secret: options.environment.SUPABASE_SECRET_KEY,
    fetchImpl:
      options.fetchImpl ?? ((url, init) => globalThis.fetch(url, init)),
    maxResponseBytes: MAX_VERIFIER_RESPONSE_BYTES,
    now,
  };
  let openUntil = 0;

  const count = (valid: boolean): void => {
    options.logger?.info(
      {
        eventName: 'cms.preview.verify',
        operation: 'cms.preview.verify',
        outcome: 'success',
        metrics: {
          [metricKey('cms_preview_verify_total', { valid: String(valid) })]: 1,
        },
      },
      { samplingClass: 'always' },
    );
  };

  /** One bounded RPC attempt: the typed result, or null for any failure. */
  const attempt = async (
    request: unknown,
    signal: AbortSignal | undefined,
  ): Promise<PreviewVerificationResult | null> => {
    const deadline = createDeadline(
      signal ?? new AbortController().signal,
      CMS_PREVIEW_VERIFIER_TIMEOUT_MS,
    );
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/${PREVIEW_VERIFIER_RPC}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'CMS-03B-19',
          },
          body: JSON.stringify({ p_request: request }),
        },
        deadline,
      );
      if (!response.ok || !response.value.ok) return null;
      const body = await parseJsonResponse(
        response.value,
        configuration.maxResponseBytes,
        deadline.signal,
      );
      if (!body.ok) return null;
      const parsed = PreviewVerificationResultSchema.safeParse(body.value);
      return parsed.success ? parsed.data : null;
    } finally {
      deadline.dispose();
    }
  };

  const verify = async (
    input: PreviewVerificationInput,
    signal?: AbortSignal,
  ): Promise<PreviewVerificationResult> => {
    const token = CmsPreviewTokenSchema.safeParse(input.token);
    const request = token.success
      ? PreviewVerificationRequestSchema.safeParse({
          tokenHash: await sha256Hex(token.data),
          actorPersonId: input.actorPersonId,
          actingContextVersion: input.actingContextVersion,
          route: input.route,
          locale: input.locale,
          audience: input.audience,
        })
      : null;
    if (request === null || !request.success)
      return previewVerificationDenial();
    if (now() < openUntil) return previewVerificationDenial();
    const pauses = [...CMS_PREVIEW_VERIFIER_RETRY_DELAYS_MS, null] as const;
    for (const pause of pauses) {
      const result = await attempt(request.data, signal);
      if (result !== null) {
        openUntil = 0;
        return result;
      }
      // A caller that gave up is not a dependency failure: no circuit.
      if (signal?.aborted === true) return previewVerificationDenial();
      if (pause === null) break;
      await sleep(pause);
    }
    // Three failed attempts: stop calling the dependency for the circuit window.
    openUntil = now() + CMS_PREVIEW_VERIFIER_CIRCUIT_OPEN_SECONDS * 1_000;
    options.logger?.warn(
      {
        eventName: 'cms.preview.verify.circuit_open',
        operation: 'cms.preview.verify',
        outcome: 'failure',
        retryable: true,
        dependency: 'preview_verifier',
      },
      { samplingClass: 'always', highRisk: true },
    );
    return previewVerificationDenial();
  };

  return async (input, signal) => {
    const result = await verify(input, signal);
    count(result.valid);
    return result;
  };
};
