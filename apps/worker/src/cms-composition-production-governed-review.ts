import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import { metricKey } from './content-schema-registry/route-metric-key';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import { metricOutcome } from './cms-editorial/route-telemetry';
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
import { type GovernedContextVerifier } from './cms-composition-production-governed-review-rpc';
import { createGovernedPorts } from './cms-composition-production-governed-review-ports';
import { policyOf } from './cms-composition/governed-review-policy';
import {
  compositionInvalidationLog,
  compositionRequestLog,
} from './cms-composition/observability-observation';
import {
  failure,
  GOVERNED_DEADLINE_MS,
  GOVERNED_MAX_BYTES,
  governedGate,
  governedResponseLimit,
  validEnvelope,
  type CmsGovernedReviewDependencies,
  type GovernedError,
} from './cms-composition/governed-review-ports';

/** Governed reviews have no response exception and no automatic retry; If-Match applies to the decision and assignment commands only. */
export const createProductionCmsGovernedReviewDependencies = (
  options: CmsEditorialProductionOptions,
): CmsGovernedReviewDependencies => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  const deadlineMs = options.deadlineMs ?? GOVERNED_DEADLINE_MS;
  const requestedLimit = options.maxResponseBytes ?? GOVERNED_MAX_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > GOVERNED_DEADLINE_MS ||
    !Number.isSafeInteger(requestedLimit) ||
    requestedLimit < 1
  )
    throw new Error('Invalid CMS governed review production configuration.');
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes: governedResponseLimit(requestedLimit),
    now: options.now ?? Date.now,
  };
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const resolveSession = createCmsEditorialSessionResolver(
    options,
    configuration,
    contexts,
  );
  /** Re-prove identity and the `any_of` owner capability on the original Request. */
  const verify: GovernedContextVerifier = createFreshContextVerifier<
    Parameters<GovernedContextVerifier>[0],
    GovernedError
  >({
    contexts,
    resolveSession,
    configuration,
    failure,
    validEnvelope,
    // Authority and recent MFA are re-proven on the refreshed session, not the admitted one.
    authorize: (session, input) => governedGate(input.operationId, session),
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
    ...createGovernedPorts(transport),
    telemetry: (event) => {
      const names = {
        eventName: 'cms.composition.governed_review.request',
        operation: policyOf(event.operationId).event,
      };
      const details = compositionRequestLog(event, names);
      const invalidation = compositionInvalidationLog(event, names);
      if (invalidation !== null)
        logger.info(invalidation, { samplingClass: 'always', highRisk: true });
      logger.info(
        {
          ...details,
          // BE03c Observability: the activation metric, counted once per CMS-03C-09 request whose action is known.
          ...(event.activation === undefined
            ? {}
            : {
                metrics: {
                  ...details.metrics,
                  [metricKey('cms_governed_activation_total', {
                    action: event.activation.action,
                    outcome: metricOutcome(event.status),
                    subject_kind: event.activation.subjectKind,
                  })]: 1,
                },
              }),
        },
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
