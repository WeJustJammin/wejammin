import { createLogger, type Logger } from '@wejammin/observability/logging';

import {
  createAsyncEntrypoint,
  type AsyncWorkerBindings,
} from './async-entrypoint';
import { createAsyncJobDependencies } from './async-runtime';
import { createSupabaseRpc, parseBoolean } from './async-runtime-support';
import { CmsSchemaDryRunOriginRequestSchema } from './content-schema-registry/schema-dry-run-origin-request';
import { createCmsSchemaDryRunOriginVerifier } from './content-schema-registry/schema-dry-run-origin-verifier';
import { createProductionOperationalAlertDependencies } from './content-schema-registry/operational-alert-production';
import { runContentSchemaRegistryOperationalAlerts } from './content-schema-registry/operational-alert-runtime';
import type { OperationalAlertDependencies } from './content-schema-registry/operational-alert-runtime';
import { logSchemaMigrationQueueAttempt } from './content-schema-registry/operational-alert-queue-telemetry';
import {
  createProductionEventConsumers,
  type ProductionEventConsumerOptions,
  type ProductionEventConsumers,
} from './event-consumers/production';
import {
  createProductionJobEffectDispatcher,
  type ProductionVerificationDependencies,
} from './production-job-effect-dispatcher';
import {
  createProductionSchemaMigrationWorker,
  migrationQueueOutcome,
  type ProductionSchemaMigrationWorkerOptions,
} from './production-worker-runtime';
import { projectServerEnvironment } from '@wejammin/config/environment';

export const createProductionAsyncEntrypoint = (
  fetchImpl: typeof fetch = globalThis.fetch,
  verification?: ProductionVerificationDependencies,
  migrationOptions?: ProductionSchemaMigrationWorkerOptions,
  eventConsumerOptions?: ProductionEventConsumerOptions,
) =>
  (() => {
    const originRpc = createSupabaseRpc(fetchImpl);
    const dependencies = createAsyncJobDependencies({
      effect: createProductionJobEffectDispatcher(verification),
      fetch: fetchImpl,
      verifyCmsSchemaDryRunOrigin: ({ env, envelope, signal }) =>
        createCmsSchemaDryRunOriginVerifier({
          port: {
            call: async (operation, request, rpcSignal) => {
              const parsed = CmsSchemaDryRunOriginRequestSchema.parse(request);
              return parseBoolean(
                await originRpc<unknown>(
                  env,
                  operation,
                  { p_request: parsed },
                  rpcSignal,
                ),
                'Invalid CMS origin response',
              );
            },
          },
        }).verify(envelope, signal),
    });
    const workers = new WeakMap<
      object,
      ReturnType<typeof createProductionSchemaMigrationWorker>
    >();
    const queueLoggers = new WeakMap<object, Logger>();
    const eventConsumers = new WeakMap<object, ProductionEventConsumers>();
    const consumersFor = (
      env: AsyncWorkerBindings,
    ): ProductionEventConsumers => {
      let consumers = eventConsumers.get(env);
      if (consumers === undefined) {
        consumers = createProductionEventConsumers(
          projectServerEnvironment(env),
          fetchImpl,
          eventConsumerOptions,
        );
        eventConsumers.set(env, consumers);
      }
      return consumers;
    };
    return createAsyncEntrypoint({
      ...dependencies,
      processEventConsumer: ({ env, message }) =>
        consumersFor(env).registry.process({
          body: message.body,
          attempts: message.attempts,
        }),
      observeReconcilingAge: ({ env }) =>
        consumersFor(env).reconcilingAge.observe(),
      processSchemaMigration: async ({ env, event, message }) => {
        let worker = workers.get(env);
        if (worker === undefined) {
          worker = createProductionSchemaMigrationWorker(
            projectServerEnvironment(env),
            fetchImpl,
            migrationOptions,
          );
          workers.set(env, worker);
        }
        const result = await worker.process(event, {
          attempt: message.attempts,
        });
        let queueLogger = queueLoggers.get(env);
        if (queueLogger === undefined) {
          queueLogger = createLogger({
            environment: env.APP_ENVIRONMENT,
            release: env.APP_RELEASE,
            service: 'wejammin-cms-migration-worker',
          });
          queueLoggers.set(env, queueLogger);
        }
        logSchemaMigrationQueueAttempt(queueLogger, result, message);
        return migrationQueueOutcome(result);
      },
    });
  })();

export const runProductionOperationalAlerts = async (
  controller: Pick<ScheduledController, 'scheduledTime'>,
  env: AsyncWorkerBindings,
  dependencies?: OperationalAlertDependencies,
): Promise<void> => {
  if (env.APP_ENVIRONMENT !== 'production') return;
  if (
    dependencies === undefined &&
    (env.CLOUDFLARE_ACCOUNT_ID === undefined ||
      env.CLOUDFLARE_OBSERVABILITY_API_TOKEN === undefined ||
      env.CLOUDFLARE_PLATFORM_DLQ_ID === undefined ||
      env.PLATFORM_ALERT_EMAIL === undefined)
  )
    throw new Error('Operational alert bindings unavailable');
  await runContentSchemaRegistryOperationalAlerts(
    {
      environment: 'production',
      release: env.APP_RELEASE,
      scheduledAt: new Date(controller.scheduledTime).toISOString(),
    },
    dependencies ??
      createProductionOperationalAlertDependencies({
        CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID as string,
        CLOUDFLARE_OBSERVABILITY_API_TOKEN:
          env.CLOUDFLARE_OBSERVABILITY_API_TOKEN as string,
        CLOUDFLARE_PLATFORM_DLQ_ID: env.CLOUDFLARE_PLATFORM_DLQ_ID as string,
        PLATFORM_ALERT_EMAIL: env.PLATFORM_ALERT_EMAIL as NonNullable<
          AsyncWorkerBindings['PLATFORM_ALERT_EMAIL']
        >,
        SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
        SUPABASE_URL: env.SUPABASE_URL,
      }),
  );
};
