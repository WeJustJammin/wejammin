import {
  ReviewDependencyEventResolutionSchema,
  ReviewDependencyRecheckRunResultSchema,
  type ReviewDependencyEventResolution,
  type ReviewDependencyRecheckRunRequest,
  type ReviewDependencyRecheckRunResult,
} from '@wejammin/contracts';

import {
  CMS_REVIEW_RECHECK_RPC,
  type CmsReviewRecheckRpcName,
} from './rpc-names';

/** The Worker's protected RPC transport, narrowed to the two recheck operations. */
export type ReviewRecheckRpc = <T>(
  operation: CmsReviewRecheckRpcName,
  input: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<T>;

/** A reply that breaks the strict recheck contract; it carries no payload. */
export class ReviewRecheckResponseError extends Error {
  constructor() {
    super('The review recheck RPC returned an invalid response.');
    this.name = 'ReviewRecheckResponseError';
  }
}

/** The recheck operations as typed ports; every reply is validated, never trusted. */
export type ReviewRecheckRpcPorts = Readonly<{
  resolveEvent: (
    eventId: string,
    signal: AbortSignal,
  ) => Promise<ReviewDependencyEventResolution>;
  run: (
    request: ReviewDependencyRecheckRunRequest,
    signal: AbortSignal,
  ) => Promise<ReviewDependencyRecheckRunResult>;
}>;

export const createReviewRecheckRpcPorts = (
  rpc: ReviewRecheckRpc,
): ReviewRecheckRpcPorts => ({
  resolveEvent: async (eventId, signal) => {
    const reply = ReviewDependencyEventResolutionSchema.safeParse(
      await rpc<unknown>(
        CMS_REVIEW_RECHECK_RPC.resolveEvent,
        { p_event_id: eventId },
        signal,
      ),
    );
    if (!reply.success) throw new ReviewRecheckResponseError();
    return reply.data;
  },
  run: async (request, signal) => {
    const reply = ReviewDependencyRecheckRunResultSchema.safeParse(
      await rpc<unknown>(
        CMS_REVIEW_RECHECK_RPC.run,
        { p_request: request },
        signal,
      ),
    );
    if (!reply.success) throw new ReviewRecheckResponseError();
    return reply.data;
  },
});
