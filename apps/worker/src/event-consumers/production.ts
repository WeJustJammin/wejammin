import {
  projectServerEnvironment,
  type ServerEnvironment,
} from '@wejammin/config/environment';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import { createSupabaseRpc } from '../async-runtime-rpc-transport';
import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { createAuthStateReconciler } from './auth-state-reconciler';
import { createRpcReconcilerFactorPort } from './auth-state-reconciler-rpc';
import {
  createCapabilityGrantConsumer,
  createRpcCapabilityGrantSource,
  type AuthorizationRefreshSink,
} from './capability-grant-consumer';
import { createRpcDeadLetterPort } from './dead-letter';
import { createProviderFactorStatusPort } from './provider-factor-status';
import {
  createReconcilingAgeProbe,
  createRpcReconcilingAgePort,
} from './reconciling-age';
import { createEventConsumerRegistry } from './registry';
import { createSecurityNotifier } from './security-notifier';
import type { SecurityNotificationProviderPort } from './security-notifier';
import { createRpcInAppNotificationProvider } from './in-app-notification-provider';
import {
  createRpcSecurityNotificationSource,
  withNotificationBreaker,
} from './security-notifier-ports';
import type { EventConsumerRpc } from './types';

export type ProductionEventConsumerOptions = Readonly<{
  logger?: Logger;
  /**
   * The security-notification provider. Absent, the in-app notification
   * store is the boundary (external email delivery is disabled by the
   * architecture); a bound provider replaces it.
   */
  notificationProvider?: SecurityNotificationProviderPort;
  /** Applies a refetched grant to a Worker-side authorization cache, if one exists. */
  authorizationRefresh?: AuthorizationRefreshSink;
  now?: () => number;
}>;

/**
 * Authority for every CMS capability is resolved per request from the
 * database projection, so the Worker holds no capability cache to drop. The
 * consumer still rereads the current grant and reports it; a cache added
 * later registers here.
 */
const NO_WORKER_AUTHORIZATION_CACHE: AuthorizationRefreshSink = {
  refresh: async () => undefined,
};

export type ProductionEventConsumers = Readonly<{
  registry: ReturnType<typeof createEventConsumerRegistry>;
  reconcilingAge: ReturnType<typeof createReconcilingAgeProbe>;
}>;

/**
 * Composes the registered event consumers from the protected Supabase RPC
 * transport and the Supabase Auth admin credential. Everything stateful stays
 * behind named RPCs; the Worker keeps nothing between messages.
 */
export const createProductionEventConsumers = (
  environment: ServerEnvironment,
  fetchImpl: typeof fetch = globalThis.fetch,
  options: ProductionEventConsumerOptions = {},
): ProductionEventConsumers => {
  const validated = projectServerEnvironment(environment);
  const transport = createSupabaseRpc(fetchImpl);
  const rpc: EventConsumerRpc = (operation, input, signal) =>
    transport(validated, operation, input, signal);
  const logger =
    options.logger ??
    createLogger({
      environment: validated.APP_ENVIRONMENT,
      release: validated.APP_RELEASE,
      service: 'wejammin-event-consumers',
    });
  const config = normalizeAuthProductionOptions({
    environment: validated,
    fetchImpl,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const deadLetter = createRpcDeadLetterPort(rpc);
  return {
    registry: createEventConsumerRegistry({
      reconciler: createAuthStateReconciler({
        factors: createRpcReconcilerFactorPort(rpc),
        provider: createProviderFactorStatusPort(config),
        deadLetter,
        telemetry: logger,
      }),
      notifier: createSecurityNotifier({
        source: createRpcSecurityNotificationSource(rpc),
        provider:
          options.notificationProvider ??
          withNotificationBreaker(createRpcInAppNotificationProvider(rpc)),
        deadLetter,
        telemetry: logger,
      }),
      capabilityGrant: createCapabilityGrantConsumer({
        grants: createRpcCapabilityGrantSource(rpc),
        authorization:
          options.authorizationRefresh ?? NO_WORKER_AUTHORIZATION_CACHE,
        deadLetter,
        telemetry: logger,
      }),
    }),
    reconcilingAge: createReconcilingAgeProbe({
      age: createRpcReconcilingAgePort(rpc),
      telemetry: logger,
    }),
  };
};
