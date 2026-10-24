import {
  GovernedRecheckEventResolutionSchema,
  GovernedRecheckRunResultSchema,
  type GovernedRecheckEventResolution,
  type GovernedRecheckRunRequest,
  type GovernedRecheckRunResult,
} from './contract';
import {
  CMS_GOVERNED_RECHECK_RPC,
  type CmsGovernedRecheckRpcName,
} from './rpc-names';

/** The Worker's protected RPC transport, narrowed to the two governed recheck operations. */
export type GovernedRecheckRpc = <T>(
  operation: CmsGovernedRecheckRpcName,
  input: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<T>;

/** A reply that breaks the strict recheck contract; it carries no payload. */
export class GovernedRecheckResponseError extends Error {
  constructor() {
    super('The governed review recheck RPC returned an invalid response.');
    this.name = 'GovernedRecheckResponseError';
  }
}

export type GovernedRecheckRpcPorts = Readonly<{
  resolveEvent: (
    eventId: string,
    signal: AbortSignal,
  ) => Promise<GovernedRecheckEventResolution>;
  run: (
    request: GovernedRecheckRunRequest,
    signal: AbortSignal,
  ) => Promise<GovernedRecheckRunResult>;
}>;

/** The recheck operations as typed ports; every reply is validated, never trusted. */
export const createGovernedRecheckRpcPorts = (
  rpc: GovernedRecheckRpc,
): GovernedRecheckRpcPorts => ({
  resolveEvent: async (eventId, signal) => {
    const reply = GovernedRecheckEventResolutionSchema.safeParse(
      await rpc<unknown>(
        CMS_GOVERNED_RECHECK_RPC.resolveEvent,
        { p_event_id: eventId },
        signal,
      ),
    );
    if (!reply.success) throw new GovernedRecheckResponseError();
    return reply.data;
  },
  run: async (request, signal) => {
    const reply = GovernedRecheckRunResultSchema.safeParse(
      await rpc<unknown>(
        CMS_GOVERNED_RECHECK_RPC.run,
        { p_request: request },
        signal,
      ),
    );
    if (!reply.success) throw new GovernedRecheckResponseError();
    return reply.data;
  },
});
