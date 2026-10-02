import { EVENT_CONSUMER_RPC } from './rpc-names';
import type { DeadLetterPort, EventConsumerRpc } from './types';

/**
 * Durable dead-letter record behind the protected `consumer_dead_letter_event`
 * RPC. The record is identifiers and a closed reason code; the queue body is
 * never forwarded, so nothing a producer put in it can reach the table.
 */
export const createRpcDeadLetterPort = (
  rpc: EventConsumerRpc,
): DeadLetterPort => ({
  record: async ({ consumer, identity, reasonCode }, signal) => {
    const acknowledgement = await rpc<unknown>(
      EVENT_CONSUMER_RPC.deadLetterEvent,
      { p_request: { consumer, ...identity, reasonCode } },
      signal,
    );
    if (
      typeof acknowledgement !== 'object' ||
      acknowledgement === null ||
      Object.keys(acknowledgement).length !== 1 ||
      (acknowledgement as { accepted?: unknown }).accepted !== true
    )
      throw new Error('Dead-letter record was not acknowledged');
  },
});
