import { parseServerEnvironment } from '@wejammin/config/environment';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AuthenticationDependencies } from './authentication/types';
import { createSupabaseRpc } from './async-runtime-support';
import { createProductionCmsTemplateDependencies } from './cms-composition-production';
import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import { createProductionCmsPatternInstanceDependencies } from './cms-composition-production-pattern';
import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';
import { createProductionCmsTaxonomyDependencies } from './cms-composition-production-taxonomy';
import type { CmsLocaleDependencies } from './cms-composition/locale-routes';
import type { CmsPatternInstanceDependencies } from './cms-composition/pattern-instance-routes';
import type { CmsRelatedContentDependencies } from './cms-composition/related-content-routes';
import type { CmsTaxonomyDependencies } from './cms-composition/taxonomy-routes';
import type { CmsTemplateDependencies } from './cms-composition/template-routes';
import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
import type { CmsEditorialDependencies } from './cms-editorial/types';
import type { JobStatusProductionFetch } from './jobs/job-status-production';
import {
  createSchemaMigrationWorker,
  type MigrationWorkerResult,
  type MigrationWorkerTelemetryEvent,
  type SchemaMigrationRpcName,
  type SchemaMigrationWorker,
  type SchemaMigrationWorkerDependencies,
} from './content-schema-registry/migration-worker';
import { CONTENT_SCHEMA_REGISTRY_RUNBOOK } from './content-schema-registry/types';
import type { WorkerBindings } from './worker-bindings';

/**
 * Deployment overrides for the CMS editorial bundle. Environment, transport,
 * the server auth limiter, and the capability resolver are composed by the
 * runtime, so this surface only carries deployment tuning plus the injectable
 * session/rate seams used by focused composition tests.
 */
export type ProductionCmsEditorialOptions = Readonly<
  Pick<
    CmsEditorialProductionOptions,
    | 'resolveSession'
    | 'rateLimit'
    | 'humanOrigins'
    | 'maxResponseBytes'
    | 'deadlineMs'
    | 'now'
    | 'telemetry'
    | 'logger'
  >
>;

export type ProductionSchemaMigrationWorkerOptions = Readonly<
  Pick<
    SchemaMigrationWorkerDependencies,
    'leaseDurationMs' | 'maxBatchRows' | 'maxBatchesPerInvocation' | 'now'
  > & {
    workerId?: string;
    deadlineMs?: number;
    maxResponseBytes?: number;
    telemetry?: (event: MigrationWorkerTelemetryEvent) => void | Promise<void>;
    logger?: Logger;
  }
>;

export type ProductionCmsCompositionDependencies = Readonly<{
  cmsEditorial: CmsEditorialDependencies;
  cmsTemplate: CmsTemplateDependencies;
  cmsLocale: CmsLocaleDependencies;
  cmsPatternInstance: CmsPatternInstanceDependencies;
  cmsTaxonomy: CmsTaxonomyDependencies;
  cmsRelatedContent: CmsRelatedContentDependencies;
}>;

export const migrationQueueOutcome = (
  result: MigrationWorkerResult,
): 'ack' | 'retry' =>
  result.outcome === 'retry' ||
  result.outcome === 'failed_retryable' ||
  result.outcome === 'progress'
    ? 'retry'
    : 'ack';

const migrationTraceSteps = (
  operation: MigrationWorkerTelemetryEvent['operation'],
): readonly string[] =>
  operation === 'migration.consume'
    ? ['cms.migration.admission', 'cms.migration.claim', 'cms.migration.plan']
    : operation === 'migration.batch'
      ? ['cms.migration.lease', 'cms.migration.batch', 'cms.migration.cursor']
      : [
          'cms.migration.recovery',
          'cms.migration.reconcile',
          'cms.migration.dlq',
        ];

export const productionMigrationTelemetry =
  (
    logger: Logger,
  ): NonNullable<SchemaMigrationWorkerDependencies['telemetry']> =>
  (event) => {
    const outcome =
      event.outcome === 'failure' || event.outcome === 'dead_letter'
        ? 'failure'
        : event.retryable
          ? 'retry'
          : event.outcome === 'duplicate' || event.outcome === 'stale'
            ? 'rejected'
            : 'success';
    logger.info(
      {
        eventName: 'cms.registry.migration',
        operation: event.operation,
        outcome,
        ...(event.eventId === null && event.migrationPlanId === null
          ? {}
          : {
              jobId: (event.eventId ?? event.migrationPlanId) as
                string | undefined,
            }),
        ...(event.correlationId === null
          ? {}
          : { traceId: event.correlationId }),
        ...(event.cursor === null ? {} : { entityVersion: event.cursor }),
        ...(event.attempt < 1 ? {} : { attempt: event.attempt }),
        ...(event.reasonCode === null ? {} : { errorCode: event.reasonCode }),
        durationMs: event.durationMs,
        traceSteps: [...migrationTraceSteps(event.operation)],
        metrics: {
          'cms.migration.requests.total': 1,
          'cms.migration.retries.total': event.retryable ? 1 : 0,
          'cms.migration.dlq.total': event.outcome === 'dead_letter' ? 1 : 0,
          // BE03a Observability names (the dotted names above feed the alert
          // evaluator): migration progress, blocked, queue retry and DLQ.
          ...(event.progress === null
            ? {}
            : { cms_migration_progress: Math.max(0, event.progress) }),
          cms_migration_blocked_total: event.outcome === 'blocked' ? 1 : 0,
          cms_queue_retry_total: event.retryable ? 1 : 0,
          cms_queue_dlq_total: event.outcome === 'dead_letter' ? 1 : 0,
        },
        attributes: {
          'slo.tier': 2,
          'alert.class': 'content.schema.migration.tier2',
          'alert.route': 'platform.on_call',
          runbook: CONTENT_SCHEMA_REGISTRY_RUNBOOK,
          'retry.alert.after': 3,
          'dead-letter.alert.threshold': 0,
        },
      },
      { samplingClass: 'always', highRisk: event.outcome !== 'success' },
    );
  };

const productionMigrationWorkerId = (environment: WorkerBindings): string =>
  `cms-schema-migration-${environment.APP_ENVIRONMENT}-${environment.APP_RELEASE}`;

/**
 * Compose the S09 migration worker from the protected Supabase RPC transport.
 * The worker receives only the validated event/job input; all state and
 * authority remain behind named server-side RPCs.
 */
export const createProductionSchemaMigrationWorker = (
  environment: WorkerBindings,
  fetchImpl: typeof fetch = globalThis.fetch,
  options: ProductionSchemaMigrationWorkerOptions = {},
): SchemaMigrationWorker => {
  const validatedEnvironment = parseServerEnvironment(environment);
  const rpc = createSupabaseRpc(fetchImpl, {
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    ...(options.maxResponseBytes === undefined
      ? {}
      : { maxResponseBytes: options.maxResponseBytes }),
  });
  const port: SchemaMigrationWorkerDependencies['port'] = {
    call: (operation: SchemaMigrationRpcName, request: unknown, signal) =>
      rpc(validatedEnvironment, operation, { p_request: request }, signal),
  };
  const logger =
    options.logger ??
    createLogger({
      environment: validatedEnvironment.APP_ENVIRONMENT,
      release: validatedEnvironment.APP_RELEASE,
      service: 'wejammin-cms-migration-worker',
    });
  const telemetry = options.telemetry ?? productionMigrationTelemetry(logger);
  return createSchemaMigrationWorker({
    port,
    workerId:
      options.workerId ?? productionMigrationWorkerId(validatedEnvironment),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.leaseDurationMs === undefined
      ? {}
      : { leaseDurationMs: options.leaseDurationMs }),
    ...(options.maxBatchRows === undefined
      ? {}
      : { maxBatchRows: options.maxBatchRows }),
    ...(options.maxBatchesPerInvocation === undefined
      ? {}
      : { maxBatchesPerInvocation: options.maxBatchesPerInvocation }),
    telemetry,
  });
};

/**
 * Compose the CMS-03B editorial dependency and the four CMS-03C composition
 * boundaries from the protected Supabase RPC transport. The editorial bundle
 * shares its session/rate seams and deployment tuning with every composition
 * boundary so their admission behavior stays aligned across operations.
 */
export const createProductionCmsCompositionDependencies = (
  environment: WorkerBindings,
  fetchImpl: JobStatusProductionFetch,
  auth: Pick<AuthenticationDependencies, 'resolveSession'> &
    Partial<Pick<AuthenticationDependencies, 'rateLimit'>>,
  resolveCapabilities: CmsEditorialProductionOptions['resolveCapabilities'],
  options: ProductionCmsEditorialOptions = {},
): ProductionCmsCompositionDependencies => {
  const cmsEditorialOptions: CmsEditorialProductionOptions = {
    environment,
    fetchImpl,
    auth,
    ...(resolveCapabilities === undefined ? {} : { resolveCapabilities }),
    ...options,
  };
  return {
    cmsEditorial: createProductionCmsEditorialDependencies(cmsEditorialOptions),
    cmsTemplate: createProductionCmsTemplateDependencies(cmsEditorialOptions),
    cmsLocale: createProductionCmsLocaleDependencies(cmsEditorialOptions),
    cmsPatternInstance:
      createProductionCmsPatternInstanceDependencies(cmsEditorialOptions),
    cmsTaxonomy: createProductionCmsTaxonomyDependencies(cmsEditorialOptions),
    cmsRelatedContent:
      createProductionCmsRelatedContentDependencies(cmsEditorialOptions),
  };
};
