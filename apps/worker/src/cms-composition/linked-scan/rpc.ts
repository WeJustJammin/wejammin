import {
  LinkedScanEventResolutionSchema,
  LinkedScanRunResultSchema,
  type LinkedScanEventResolution,
  type LinkedScanRunRequest,
  type LinkedScanRunResult,
} from './contract';
import { CMS_LINKED_SCAN_RPC, type CmsLinkedScanRpcName } from './rpc-names';

/** The Worker's protected RPC transport, narrowed to the two linked-update scan operations. */
export type LinkedScanRpc = <T>(
  operation: CmsLinkedScanRpcName,
  input: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<T>;

/** A reply that breaks the strict scan contract; it carries no payload. */
export class LinkedScanResponseError extends Error {
  constructor() {
    super('The linked-update scan RPC returned an invalid response.');
    this.name = 'LinkedScanResponseError';
  }
}

export type LinkedScanRpcPorts = Readonly<{
  resolveEvent: (
    eventId: string,
    signal: AbortSignal,
  ) => Promise<LinkedScanEventResolution>;
  run: (
    request: LinkedScanRunRequest,
    signal: AbortSignal,
  ) => Promise<LinkedScanRunResult>;
}>;

/** The scan operations as typed ports; every reply is validated, never trusted. */
export const createLinkedScanRpcPorts = (
  rpc: LinkedScanRpc,
): LinkedScanRpcPorts => ({
  resolveEvent: async (eventId, signal) => {
    const reply = LinkedScanEventResolutionSchema.safeParse(
      await rpc<unknown>(
        CMS_LINKED_SCAN_RPC.resolveEvent,
        { p_event_id: eventId },
        signal,
      ),
    );
    if (!reply.success) throw new LinkedScanResponseError();
    return reply.data;
  },
  run: async (request, signal) => {
    const reply = LinkedScanRunResultSchema.safeParse(
      await rpc<unknown>(
        CMS_LINKED_SCAN_RPC.run,
        { p_request: request },
        signal,
      ),
    );
    if (!reply.success) throw new LinkedScanResponseError();
    return reply.data;
  },
});
