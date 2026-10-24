import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from '../../async-entrypoint';
import { createSupabaseRpc } from '../../async-runtime';
import type {
  EventConsumerMessage,
  EventConsumerOutcome,
} from '../../event-consumers/types';
import type { LinkedScanMessage } from './contract';
import { createLinkedScanJob } from './job';
import { createLinkedScanProcessor } from './processor';
import { createLinkedScanRpcPorts, type LinkedScanRpc } from './rpc';
import { createLinkedScanSourceConsumer } from './source-consumer';

export type ProductionLinkedScanOptions = Readonly<{
  logger?: Logger;
}>;

/** The governed recheck family this composition runs in front of (itself in front of the Slice 11 recheck). */
export type LinkedScanDelegate = Readonly<{
  process: (message: EventConsumerMessage) => Promise<EventConsumerOutcome>;
}>;

/**
 * Composes the linked-update scan of the platform queue: the pattern-activation producer and the
 * job over the protected Supabase RPC transport and the `PLATFORM_JOBS` binding, in front of the
 * recheck family the caller passes (the governed recheck composition, which only the production
 * async entrypoint may build). The Worker keeps nothing between messages; every durable decision
 * is a protected `platform_api` RPC.
 */
export const createProductionLinkedScanProcessor = (
  env: AsyncWorkerBindings,
  fetchImpl: typeof fetch = globalThis.fetch,
  options: ProductionLinkedScanOptions = {},
  delegate: LinkedScanDelegate,
) => {
  const transport = createSupabaseRpc(fetchImpl);
  const rpc: LinkedScanRpc = (operation, input, signal) =>
    transport(env, operation, input, signal);
  const telemetry =
    options.logger ??
    createLogger({
      environment: env.APP_ENVIRONMENT,
      release: env.APP_RELEASE,
      service: 'wejammin-cms-linked-scan',
    });
  const queue = {
    send: async (message: LinkedScanMessage): Promise<void> => {
      await env.PLATFORM_JOBS.send(message);
    },
  };
  const ports = createLinkedScanRpcPorts(rpc);
  return createLinkedScanProcessor({
    job: createLinkedScanJob({ run: ports.run, queue, telemetry }),
    source: createLinkedScanSourceConsumer({
      resolveEvent: ports.resolveEvent,
      queue,
      telemetry,
    }),
    delegate,
  });
};
