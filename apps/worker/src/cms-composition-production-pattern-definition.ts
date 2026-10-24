import { PatternVersionApiRequestSchema } from '@wejammin/contracts';
import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import { compositionRequestLog } from './cms-composition/observability-observation';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import {
  configuredOriginList,
  createCmsEditorialSessionResolver,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialProductionOptions,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import { createFreshContextVerifier } from './cms-editorial-production-fresh-context';
import {
  callPatternRpc,
  createPatternLatestReader,
  type PatternContextVerifier,
} from './cms-composition-production-pattern-definition-latest';
import {
  failure,
  PATTERN_MAX_BYTES,
  PATTERN_DEADLINE_MS,
  validPatternDraft,
  validEnvelope,
  patternResponseLimit,
  type CmsPatternDefinitionDependencies,
  type PatternError,
} from './cms-composition/pattern-definition-ports';

/** Pattern definitions have no placement-response exception or automatic retry. */
export const createProductionCmsPatternDefinitionDependencies = (
  options: CmsEditorialProductionOptions,
): CmsPatternDefinitionDependencies => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  const deadlineMs = options.deadlineMs ?? PATTERN_DEADLINE_MS;
  const requestedLimit = options.maxResponseBytes ?? PATTERN_MAX_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > PATTERN_DEADLINE_MS ||
    !Number.isSafeInteger(requestedLimit) ||
    requestedLimit < 1
  )
    throw new Error('Invalid CMS pattern definition production configuration.');
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes: patternResponseLimit(requestedLimit),
    now: options.now ?? Date.now,
  };
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const resolveSession = createCmsEditorialSessionResolver(
    options,
    configuration,
    contexts,
  );
  const verify: PatternContextVerifier = createFreshContextVerifier<
    Parameters<PatternContextVerifier>[0],
    PatternError
  >({
    contexts,
    resolveSession,
    configuration,
    failure,
    validEnvelope,
    authorize: (session) =>
      session.actingPartyId === null ||
      !session.capabilities.includes('cms.template_designer')
        ? failure(403, { reasonCode: 'capability_missing' })
        : null,
  });
  const transport = { configuration, verify, deadlineMs };
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);
  return {
    humanOrigins: validateOriginList(
      options.humanOrigins ??
        configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
      Error,
    ),
    now: configuration.now,
    maxResponseBytes: configuration.maxResponseBytes,
    resolveSession,
    rateLimit: createRateLimiter(options),
    readLatest: createPatternLatestReader(transport),
    definePattern: async (input, signal) => {
      if (input.operationId !== 'CMS-03C-12') return failure(400);
      const parsed = PatternVersionApiRequestSchema.safeParse({
        body: input.body,
        headers: {
          contentType: 'application/json',
          idempotencyKey: input.idempotencyKey,
          ...(input.ifMatch === null ? {} : { ifMatch: `"${input.ifMatch}"` }),
        },
      });
      if (!parsed.success) return failure(400);
      const result = await callPatternRpc(
        transport,
        input,
        parsed.data.body,
        signal,
        {
          idempotencyKey: parsed.data.headers.idempotencyKey,
          ifMatch: input.ifMatch,
        },
      );
      if (!result.ok) return result;
      return validPatternDraft(result.value, parsed.data.body)
        ? { ok: true, value: result.value }
        : failure(502);
    },
    telemetry: (event) => {
      logger.info(
        compositionRequestLog(event, {
          eventName: 'cms.composition.pattern.request',
          operation:
            event.operationId === 'CMS-03C-12'
              ? 'cms.composition.pattern.define'
              : 'cms.composition.pattern.read_latest',
        }),
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
