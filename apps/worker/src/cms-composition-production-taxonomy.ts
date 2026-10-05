import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import {
  configuredOriginList,
  createCmsEditorialSessionResolver,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import { unavailable } from './cms-editorial-production-errors';
import {
  MAX_DEFAULT_RESPONSE_BYTES,
  type CmsEditorialProductionConfiguration,
  type CmsEditorialProductionOptions,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import type { CmsTaxonomyDependencies } from './cms-composition/taxonomy-routes';

/**
 * The HTTP boundary is mounted, but no curator mutation is authorized until
 * the canonical-overlap authority and named atomic RPC are specified and
 * deployed. A valid human request therefore fails closed after admission.
 */
export const createProductionCmsTaxonomyDependencies = (
  options: CmsEditorialProductionOptions,
): CmsTaxonomyDependencies => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes: options.maxResponseBytes ?? MAX_DEFAULT_RESPONSE_BYTES,
    now: options.now ?? Date.now,
  };
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);
  return {
    humanOrigins: validateOriginList(
      options.humanOrigins ??
        configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
      Error,
    ),
    now: configuration.now,
    resolveSession: createCmsEditorialSessionResolver(
      options,
      configuration,
      contexts,
    ),
    rateLimit: createRateLimiter(options),
    actTerm: async () => unavailable('cms_composition'),
    telemetry: (event) => {
      logger.info(
        {
          eventName: 'cms.composition.taxonomy.request',
          operation: 'cms.composition.taxonomy.act',
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
