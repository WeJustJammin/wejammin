import {
  CompositionInstancesReadApiRequestSchema,
  CompositionUpdateApiRequestSchema,
  CompositionUpdateDiffApiRequestSchema,
  PatternSelectorQuerySchema,
} from '@wejammin/contracts';

import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import {
  createPatternUpdateContextVerifier,
  createPatternUpdateRpc,
} from './cms-composition-production-pattern-update-rpc';
import { validInstancesPage } from './cms-composition/composition-instances-answers';
import {
  validSelectorPage,
  validUpdateDiff,
  validUpdateResource,
} from './cms-composition/pattern-update-answers';
import {
  failure,
  type CmsPatternUpdateDependencies,
} from './cms-composition/pattern-update-ports';
import { createRateLimiter } from './cms-editorial-production-rate';
import {
  configuredOriginList,
  createCmsEditorialSessionResolver,
  validateOriginList,
} from './cms-editorial-production-session';
import { compositionRequestLog } from './cms-composition/observability-observation';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialProductionOptions,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';

/** The widest answer any operation reads (the diff); a smaller deployment option lowers every ceiling. */
const MAX_RESPONSE_BYTES = 524_288;
const MAX_DEADLINE_MS = 15_000;
const OPERATION_NAMES = {
  'CMS-03C-13': 'cms.composition.pattern.select',
  'CMS-03C-14': 'cms.composition.pattern.update_diff',
  cmsCompositionInstancesRead: 'cms.composition.instances.list',
  'CMS-03C-15': 'cms.composition.pattern.update',
} as const;

/**
 * The production CMS-03C-13/14/15 and cmsCompositionInstancesRead dependencies over `platform_api.cms_list_pattern_selector`,
 * `cms_get_instance_update_diff`, `cms_apply_pattern_update` and `cms_list_composition_instances`. Private RPC transport: a caller cannot supply the actor,
 * the owner party, the capability or the RPC name, and nothing here retries (a command least of all; the same
 * Idempotency-Key is the caller's retry). Every answer must honour the request that asked for it.
 */
export const createProductionCmsPatternUpdateDependencies = (
  options: CmsEditorialProductionOptions,
): CmsPatternUpdateDependencies => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  const deadlineMs = options.deadlineMs ?? MAX_DEADLINE_MS;
  const requestedBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    !Number.isSafeInteger(requestedBytes) ||
    requestedBytes < 1
  )
    throw new Error('Invalid CMS pattern update production configuration.');
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes: Math.min(requestedBytes, MAX_RESPONSE_BYTES),
    now: options.now ?? Date.now,
  };
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const resolveSession = createCmsEditorialSessionResolver(
    options,
    configuration,
    contexts,
  );
  const rpc = createPatternUpdateRpc(
    configuration,
    createPatternUpdateContextVerifier(contexts, resolveSession, configuration),
    Math.min(deadlineMs, MAX_DEADLINE_MS),
  );
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);
  return {
    humanOrigins: validateOriginList(
      options.humanOrigins ??
        configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
      Error,
    ),
    now: configuration.now,
    resolveSession,
    rateLimit: createRateLimiter(options),
    readSelector: async (input, signal) => {
      const query = PatternSelectorQuerySchema.safeParse(input.query);
      if (input.operationId !== 'CMS-03C-13' || !query.success)
        return failure(400);
      const { contentTypeId, cursor, limit } = query.data;
      const answer = await rpc(
        input,
        {
          contentTypeId,
          limit,
          ...(cursor == null ? {} : { cursor }),
        },
        signal,
      );
      if (!answer.ok) return answer;
      return validSelectorPage(answer.value.value, query.data)
        ? { ok: true, value: answer.value.value }
        : failure(502);
    },
    readUpdateDiff: async (input, signal) => {
      const path = CompositionUpdateDiffApiRequestSchema.safeParse({
        instanceId: input.instanceId,
        query: {},
      });
      if (input.operationId !== 'CMS-03C-14' || !path.success)
        return failure(400);
      const answer = await rpc(
        input,
        { instanceId: path.data.instanceId },
        signal,
      );
      if (!answer.ok) return answer;
      return validUpdateDiff(answer.value.value, path.data.instanceId)
        ? { ok: true, value: answer.value.value }
        : failure(502);
    },
    readInstances: async (input, signal) => {
      const path = CompositionInstancesReadApiRequestSchema.safeParse({
        entryId: input.entryId,
        query: {
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
          limit: input.limit,
        },
      });
      if (input.operationId !== 'cmsCompositionInstancesRead' || !path.success)
        return failure(400);
      const answer = await rpc(
        input,
        {
          entryId: path.data.entryId,
          ...(path.data.query.cursor == null
            ? {}
            : { cursor: path.data.query.cursor }),
          limit: path.data.query.limit,
        },
        signal,
      );
      if (!answer.ok) return answer;
      return validInstancesPage(answer.value.value, path.data.query)
        ? { ok: true, value: answer.value.value }
        : failure(502);
    },
    applyUpdate: async (input, signal) => {
      const request = CompositionUpdateApiRequestSchema.safeParse({
        headers: {
          contentType: 'application/json',
          idempotencyKey: input.idempotencyKey,
          ifMatch: `"${input.ifMatch}"`,
        },
        body: input.body,
      });
      if (input.operationId !== 'CMS-03C-15' || !request.success)
        return failure(400);
      const answer = await rpc(input, request.data.body, signal, {
        idempotencyKey: request.data.headers.idempotencyKey,
        ifMatch: input.ifMatch,
      });
      if (!answer.ok) return answer;
      const { value, etag } = answer.value;
      return etag !== null &&
        validUpdateResource(value, etag, request.data.body)
        ? { ok: true, value, etag }
        : failure(502);
    },
    telemetry: (event) => {
      logger.info(
        compositionRequestLog(event, {
          eventName: 'cms.composition.pattern.request',
          operation: OPERATION_NAMES[event.operationId],
        }),
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
