import {
  LocaleVariantHeadersSchema,
  LocaleVariantPathSchema,
  LocaleVariantRequestSchema,
  LocaleVariantResourceSchema,
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
  CmsLocaleDependencies,
  CmsLocalePortInput,
  CmsLocaleResult,
} from './cms-composition/locale-routes';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

const rejected = (status: 400 | 401 | 403 | 422): CmsLocaleResult<never> => ({
  ok: false,
  status,
  code:
    status === 403
      ? 'LOCALE_FORBIDDEN'
      : status === 422
        ? 'LOCALE_VALIDATION_FAILED'
        : status === 401
          ? 'UNAUTHENTICATED'
          : 'INVALID_REQUEST',
  message: 'Locale request rejected.',
});

/** Only the Worker selects this private RPC; the browser never receives its key. */
/**
 * CMS-03C-04 owns the exact locked catalog (BE03c error registry / FE03 workbench):
 * LOCALE_FORBIDDEN, LOCALE_SOURCE_NOT_FOUND, LOCALE_VERSION_CONFLICT and
 * LOCALE_VALIDATION_FAILED. The shared editorial mapper resolves the generic
 * BE03b tokens that the author RPC raises, so this adapter remaps the same
 * statuses to the operation's own codes before the port boundary. Failure
 * statuses are unchanged and every non-catalog error stays as mapped.
 */
const LOCALE_CATALOG: Readonly<Record<number, string>> = {
  403: 'LOCALE_FORBIDDEN',
  404: 'LOCALE_SOURCE_NOT_FOUND',
  409: 'LOCALE_VERSION_CONFLICT',
  422: 'LOCALE_VALIDATION_FAILED',
};
const localeFailure = (
  failure: ReturnType<typeof mapCmsEditorialRpcFailure>,
): ReturnType<typeof mapCmsEditorialRpcFailure> => {
  const code = LOCALE_CATALOG[failure.status];
  return code === undefined ? failure : { ...failure, code };
};
export const createProductionCmsLocaleDependencies = (
  options: CmsEditorialProductionOptions,
): CmsLocaleDependencies => {
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
    throw new Error('Invalid CMS locale production configuration.');
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

  const authorLocale = async (
    input: CmsLocalePortInput,
    signal: AbortSignal,
  ): Promise<
    CmsLocaleResult<import('@wejammin/contracts').LocaleVariantResource>
  > => {
    if (input.operationId !== 'CMS-03C-04') return rejected(400);
    const path = LocaleVariantPathSchema.safeParse(input.path);
    const body = LocaleVariantRequestSchema.safeParse(input.body);
    const headers = LocaleVariantHeadersSchema.safeParse({
      contentType: 'application/json',
      idempotencyKey: input.idempotencyKey,
      ifMatch: `"${input.ifMatch}"`,
    });
    if (!path.success || !headers.success) return rejected(400);
    if (!body.success) return rejected(422);
    if (
      path.data.entryId !== body.data.entryId ||
      path.data.locale !== body.data.locale ||
      body.data.expectedVersion !== input.ifMatch
    )
      return rejected(400);
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
        `${configuration.baseUrl}/rest/v1/rpc/cms_author_locale_variant`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'CMS-03C-04',
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
        const failure = mapCmsEditorialRpcFailure(
          response.value.status,
          await readRpcError(response.value, maxResponseBytes, deadline.signal),
        );
        const error = localeFailure(failure);
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
      const resource = LocaleVariantResourceSchema.safeParse(parsed.value);
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
    authorLocale,
    telemetry: (event) => {
      logger.info(
        {
          eventName: 'cms.composition.locale.request',
          operation: 'cms.composition.locale.author',
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
