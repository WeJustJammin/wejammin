import {
  CompositionInstanceResourceSchema,
  PatternInstanceHeadersSchema,
  PatternInstanceRequestSchema,
} from '@wejammin/contracts';

import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import {
  cmsEditorialContextFor,
  configuredOriginList,
  correlationFor,
  createCmsEditorialSessionResolver,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import {
  invalidResponse,
  isRecord,
  mapCmsEditorialRpcFailure,
  unavailable,
} from './cms-editorial-production-errors';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import {
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  type CmsEditorialProductionConfiguration,
  type CmsEditorialProductionOptions,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import type {
  CmsPatternInstanceDependencies,
  CmsPatternInstancePortInput,
  CmsPatternInstanceResult,
} from './cms-composition/pattern-instance-routes';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

const rejected = (
  status: 400 | 401 | 403 | 422,
): CmsPatternInstanceResult<never> => ({
  ok: false,
  status,
  code:
    status === 403
      ? 'COMPOSITION_FORBIDDEN'
      : status === 422
        ? 'COMPOSITION_VALIDATION_FAILED'
        : status === 401
          ? 'UNAUTHENTICATED'
          : 'INVALID_REQUEST',
  message: 'Composition request rejected.',
});

const COMPOSITION_CATALOG: Readonly<Record<number, string>> = {
  403: 'COMPOSITION_FORBIDDEN',
  404: 'COMPOSITION_NOT_FOUND',
  409: 'COMPOSITION_VERSION_CONFLICT',
  422: 'COMPOSITION_VALIDATION_FAILED',
};

/** Private RPC transport; callers cannot supply actor, owner or RPC name. */
export const createProductionCmsPatternInstanceDependencies = (
  options: CmsEditorialProductionOptions,
): CmsPatternInstanceDependencies => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? MAX_DEFAULT_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > DEFAULT_DEADLINE_MS ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1
  )
    throw new Error('Invalid CMS composition production configuration.');
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes,
    now: options.now ?? Date.now,
  };
  const humanOrigins = validateOriginList(
    options.humanOrigins ??
      configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
    Error,
  );
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const resolveSession = createCmsEditorialSessionResolver(
    options,
    configuration,
    contexts,
  );
  const rateLimit = createRateLimiter(options);
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);

  const insertPattern = async (
    input: CmsPatternInstancePortInput,
    signal: AbortSignal,
  ): Promise<
    CmsPatternInstanceResult<
      import('@wejammin/contracts').CompositionInstanceResource
    >
  > => {
    if (input.operationId !== 'CMS-03C-02') return rejected(400);
    const body = PatternInstanceRequestSchema.safeParse(input.body);
    const headers = PatternInstanceHeadersSchema.safeParse({
      contentType: 'application/json',
      idempotencyKey: input.idempotencyKey,
      ifMatch: `"${input.ifMatch}"`,
    });
    if (!headers.success) return rejected(400);
    if (!body.success) return rejected(422);
    if (body.data.expectedVersion !== input.ifMatch) return rejected(400);
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.some(
        (value) => value === 'cms.author' || value === 'cms.editor',
      )
    )
      return rejected(403);
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return rejected(401);
    const deadline = createDeadline(signal, deadlineMs);
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/cms_insert_pattern_instance`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'CMS-03C-02',
            'X-Request-Id': input.requestId,
            'X-Correlation-Id': correlationFor(input),
            'X-Idempotency-Key': input.idempotencyKey,
            'If-Match': `"${input.ifMatch}"`,
          },
          body: JSON.stringify({
            p_request: {
              ...body.data,
              idempotencyKey: input.idempotencyKey,
              ifMatch: input.ifMatch,
              context,
              correlationId: correlationFor(input),
            },
          }),
        },
        deadline,
      );
      if (!response.ok) return response;
      if (!response.value.ok) {
        const rpcError = await readRpcError(
          response.value,
          maxResponseBytes,
          deadline.signal,
        );
        if (
          response.value.status === 404 &&
          isRecord(rpcError) &&
          rpcError.code === 'PGRST202'
        )
          return unavailable('cms_composition');
        const failure = mapCmsEditorialRpcFailure(
          response.value.status,
          rpcError,
        );
        const code = COMPOSITION_CATALOG[failure.status];
        const error = code === undefined ? failure : { ...failure, code };
        return deadline.expired()
          ? {
              ok: false,
              status: 504,
              code: 'DEADLINE',
              message: 'Deadline exceeded.',
            }
          : error;
      }
      const parsed = await parseJsonResponse(
        response.value,
        maxResponseBytes,
        deadline.signal,
      );
      if (deadline.expired())
        return {
          ok: false,
          status: 504,
          code: 'DEADLINE',
          message: 'Deadline exceeded.',
        };
      if (!parsed.ok) return parsed;
      const resource = CompositionInstanceResourceSchema.safeParse(
        parsed.value,
      );
      return resource.success
        ? { ok: true, value: resource.data }
        : invalidResponse();
    } catch {
      return unavailable('cms_composition');
    } finally {
      deadline.dispose();
    }
  };

  return {
    humanOrigins,
    now: configuration.now,
    resolveSession,
    rateLimit,
    insertPattern,
    telemetry: (event) => {
      logger.info(
        {
          eventName: 'cms.composition.pattern.request',
          operation: 'cms.composition.pattern.insert',
          requestId: event.requestId,
          outcome: event.outcome,
          durationMs: event.durationMs,
          attributes: {
            actor_class: event.actorClass,
            status: event.status,
            runbook: 'cms-composition',
          },
        },
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
