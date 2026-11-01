import type { ReviewDependencyRecheckMessage } from '@wejammin/contracts';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import { createSupabaseRpc } from '../../async-runtime';
import type { AsyncWorkerBindings } from '../../async-entrypoint';
import { createRpcDeadLetterPort } from '../../event-consumers/dead-letter';
import type { EventConsumerRpc } from '../../event-consumers/types';
import { createReviewRecheckJob } from './job';
import { createReviewRecheckProcessor } from './processor';
import { createReviewRecheckRpcPorts, type ReviewRecheckRpc } from './rpc';
import { createReviewRecheckSourceConsumers } from './source-consumers';

export type ProductionReviewRecheckOptions = Readonly<{
  logger?: Logger;
}>;

/**
 * Composes the dependency recheck from the protected Supabase RPC transport and
 * the platform jobs queue binding: the six source event consumers, the job and
 * the router the queue entrypoint calls. The Worker keeps nothing between
 * messages; every durable decision is a protected `platform_api` RPC.
 */
export const createProductionReviewRecheckProcessor = (
  env: AsyncWorkerBindings,
  fetchImpl: typeof fetch = globalThis.fetch,
  options: ProductionReviewRecheckOptions = {},
) => {
  const transport = createSupabaseRpc(fetchImpl);
  const rpc: ReviewRecheckRpc = (operation, input, signal) =>
    transport(env, operation, input, signal);
  const deadLetterRpc: EventConsumerRpc = (operation, input, signal) =>
    transport(env, operation, input, signal);
  const telemetry =
    options.logger ??
    createLogger({
      environment: env.APP_ENVIRONMENT,
      release: env.APP_RELEASE,
      service: 'wejammin-cms-review-recheck',
    });
  const ports = createReviewRecheckRpcPorts(rpc);
  const queue = {
    send: async (message: ReviewDependencyRecheckMessage): Promise<void> => {
      await env.PLATFORM_JOBS.send(message);
    },
  };
  return createReviewRecheckProcessor({
    consumers: createReviewRecheckSourceConsumers({
      resolveEvent: ports.resolveEvent,
      queue,
      deadLetter: createRpcDeadLetterPort(deadLetterRpc),
      telemetry,
    }),
    job: createReviewRecheckJob({ run: ports.run, queue, telemetry }),
  });
};
