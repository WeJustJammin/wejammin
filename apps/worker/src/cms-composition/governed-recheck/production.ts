import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from '../../async-entrypoint';
import { createSupabaseRpc } from '../../async-runtime';
import type {
  EventConsumerMessage,
  EventConsumerOutcome,
} from '../../event-consumers/types';
import type { GovernedRecheckMessage } from './contract';
import { createGovernedRecheckJob } from './job';
import { createGovernedRecheckProcessor } from './processor';
import { createGovernedRecheckRpcPorts, type GovernedRecheckRpc } from './rpc';
import { createGovernedRecheckSourceConsumers } from './source-consumers';

export type ProductionGovernedRecheckOptions = Readonly<{
  logger?: Logger;
}>;

/** The Slice 11 editorial recheck processor this composition runs behind. */
export type EditorialRecheckDelegate = Readonly<{
  process: (message: EventConsumerMessage) => Promise<EventConsumerOutcome>;
}>;

/**
 * Composes the review recheck family of the platform queue: the governed
 * producers and job over the protected Supabase RPC transport and the
 * `PLATFORM_JOBS` binding, in front of the editorial recheck the caller passes
 * (the Slice 11 composition, which only the production async entrypoint may
 * build). The Worker keeps nothing between messages; every durable decision is
 * a protected `platform_api` RPC.
 */
export const createProductionGovernedRecheckProcessor = (
  env: AsyncWorkerBindings,
  fetchImpl: typeof fetch = globalThis.fetch,
  options: ProductionGovernedRecheckOptions = {},
  delegate: EditorialRecheckDelegate,
) => {
  const transport = createSupabaseRpc(fetchImpl);
  const rpc: GovernedRecheckRpc = (operation, input, signal) =>
    transport(env, operation, input, signal);
  const telemetry =
    options.logger ??
    createLogger({
      environment: env.APP_ENVIRONMENT,
      release: env.APP_RELEASE,
      service: 'wejammin-cms-governed-recheck',
    });
  const queue = {
    send: async (message: GovernedRecheckMessage): Promise<void> => {
      await env.PLATFORM_JOBS.send(message);
    },
  };
  const ports = createGovernedRecheckRpcPorts(rpc);
  return createGovernedRecheckProcessor({
    job: createGovernedRecheckJob({ run: ports.run, queue, telemetry }),
    sources: createGovernedRecheckSourceConsumers({
      resolveEvent: ports.resolveEvent,
      queue,
      telemetry,
    }),
    delegate,
  });
};
