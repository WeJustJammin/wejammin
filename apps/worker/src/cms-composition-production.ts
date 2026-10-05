import {
  TemplateDesignerContextSchema,
  TemplateVersionHeadersSchema,
  TemplateVersionRequestSchema,
  TemplateVersionResourceSchema,
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
  CmsTemplateContextPortInput,
  CmsTemplateDependencies,
  CmsTemplatePortInput,
  CmsTemplateResult,
} from './cms-composition/template-routes';
import { createTemplateDetailReader } from './cms-composition-production-detail';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

const rejectedInput = (
  status: 400 | 401 | 403 | 422,
): CmsTemplateResult<never> => ({
  ok: false,
  status,
  code: 'REJECTED',
  message: 'Template request rejected.',
});

/** Server-side template RPC transport. The browser cannot select its RPC or context. */
export const createProductionCmsTemplateDependencies = (
  options: CmsEditorialProductionOptions,
): CmsTemplateDependencies => {
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

  const readContext = async (
    input: CmsTemplateContextPortInput,
    signal: AbortSignal,
  ): Promise<
    CmsTemplateResult<import('@wejammin/contracts').TemplateDesignerContext>
  > => {
    if (input.operationId !== 'cmsTemplateContextRead')
      return rejectedInput(400);
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.includes('cms.template_designer')
    )
      return rejectedInput(403);
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return rejectedInput(401);
    const deadline = createDeadline(signal, deadlineMs);
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/cms_template_context`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'cmsTemplateContextRead',
            'X-Request-Id': input.requestId,
            'X-Correlation-Id': correlationFor(input),
          },
          body: JSON.stringify({ p_request: { context } }),
        },
        deadline,
      );
      if (!response.ok) return response;
      if (!response.value.ok) {
        const error = mapCmsEditorialRpcFailure(
          response.value.status,
          await readRpcError(response.value, maxResponseBytes, deadline.signal),
        );
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
      const resource = TemplateDesignerContextSchema.safeParse(parsed.value);
      return resource.success
        ? { ok: true, value: resource.data }
        : invalidResponse();
    } catch {
      return unavailable('cms_composition');
    } finally {
      deadline.dispose();
    }
  };

  const defineTemplate = async (
    input: CmsTemplatePortInput,
    signal: AbortSignal,
  ): Promise<
    CmsTemplateResult<import('@wejammin/contracts').TemplateVersionResource>
  > => {
    if (input.operationId !== 'CMS-03C-01') return rejectedInput(400);
    const body = TemplateVersionRequestSchema.safeParse(input.body);
    if (!body.success) return rejectedInput(422);
    const headers = TemplateVersionHeadersSchema.safeParse({
      contentType: 'application/json',
      idempotencyKey: input.idempotencyKey,
      ...(input.ifMatch === null ? {} : { ifMatch: `"${input.ifMatch}"` }),
    });
    if (
      !headers.success ||
      (body.data.expectedVersion === null) !== (input.ifMatch === null) ||
      (input.ifMatch !== null && body.data.expectedVersion !== input.ifMatch)
    )
      return rejectedInput(400);
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.includes('cms.template_designer')
    )
      return rejectedInput(403);
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return rejectedInput(401);
    const deadline = createDeadline(signal, deadlineMs);
    try {
      const rpcHeaders: Record<string, string> = {
        Accept: 'application/json',
        'Accept-Profile': 'platform_api',
        ...supabaseRpcHeaders(configuration.secret),
        'Content-Profile': 'platform_api',
        'Content-Type': 'application/json',
        'X-Operation-Id': 'CMS-03C-01',
        'X-Request-Id': input.requestId,
        'X-Correlation-Id': correlationFor(input),
        'X-Idempotency-Key': input.idempotencyKey,
      };
      if (input.ifMatch !== null) rpcHeaders['If-Match'] = `"${input.ifMatch}"`;
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/cms_define_template`,
        {
          method: 'POST',
          headers: rpcHeaders,
          body: JSON.stringify({
            p_request: {
              ...body.data,
              idempotencyKey: input.idempotencyKey,
              ...(input.ifMatch === null ? {} : { ifMatch: input.ifMatch }),
              context,
              correlationId: correlationFor(input),
            },
          }),
        },
        deadline,
      );
      if (!response.ok) return response;
      if (!response.value.ok) {
        const error = mapCmsEditorialRpcFailure(
          response.value.status,
          await readRpcError(response.value, maxResponseBytes, deadline.signal),
        );
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
      const resource = TemplateVersionResourceSchema.safeParse(parsed.value);
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
    readContext,
    readLatest: createTemplateDetailReader(
      configuration,
      contexts,
      deadlineMs,
      maxResponseBytes,
    ),
    defineTemplate,
    telemetry: (event) => {
      logger.info(
        {
          eventName: 'cms.composition.template.request',
          operation: {
            'CMS-03C-01': 'cms.composition.template.define',
            cmsTemplateContextRead: 'cms.composition.template.context',
            cmsTemplateLatestRead: 'cms.composition.template.read_latest',
          }[event.operationId],
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
