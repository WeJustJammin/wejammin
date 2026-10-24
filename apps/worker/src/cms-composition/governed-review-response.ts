import { governedErrorResponse } from './governed-review-errors';
import { governedHeaders } from './governed-review-http';
import { policyOf, type GovernedOperation } from './governed-review-policy';
import { observeRequest } from './observability-observation';
import {
  failure,
  governedResponseLimit,
  serializedBytesWithin,
  type CmsGovernedReviewDependencies,
  type GovernedRouteFacts,
} from './governed-review-ports';

export { governedErrorResponse, governedHeaders };

/** What a verified success adds to the body: its status, validator and Location. */
export type GovernedSuccessOptions = Readonly<{
  status?: 200 | 201 | 202;
  /** The strong validator operand, quoted on the wire; absent means no ETag. */
  etag?: string;
  location?: string;
}>;

/**
 * A verified success. CMS-03C-06 is 201 (the committed review; `version` is the later
 * CAS operand), the other operations pass their own status, validator and Location.
 */
export const governedSuccess = (
  request: Request,
  dependencies: CmsGovernedReviewDependencies,
  requestId: string,
  operation: GovernedOperation,
  value: { version?: string },
  options: GovernedSuccessOptions = {},
): Response => {
  const limit = governedResponseLimit(dependencies.maxResponseBytes);
  if (!serializedBytesWithin(value, limit))
    return governedErrorResponse(
      request,
      dependencies,
      requestId,
      operation,
      failure(502),
    );
  const headers = governedHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  const etag = options.etag ?? value.version;
  if (etag !== undefined) headers.set('etag', `"${etag}"`);
  if (options.location !== undefined) headers.set('location', options.location);
  return new Response(JSON.stringify(value), {
    status: options.status ?? 201,
    headers,
  });
};

/** Total route deadline, caller abort and telemetry never retry a mutation. */
export const runGovernedRoute = async (
  request: Request,
  dependencies: CmsGovernedReviewDependencies,
  requestId: string,
  operation: GovernedOperation,
  execute: (signal: AbortSignal) => Promise<Response>,
  facts: GovernedRouteFacts = {},
): Promise<Response> => {
  const startedAt = dependencies.now();
  const controller = new AbortController();
  let resolveAbort!: (response: Response) => void;
  const aborted = new Promise<Response>((resolve) => {
    resolveAbort = resolve;
  });
  const abort = (): void => {
    controller.abort();
    resolveAbort(
      governedErrorResponse(
        request,
        dependencies,
        requestId,
        operation,
        failure(504, {}, 15),
      ),
    );
  };
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, policyOf(operation).deadlineMs);
  let response: Response;
  try {
    if (request.signal.aborted) abort();
    response = await Promise.race([
      controller.signal.aborted ? aborted : execute(controller.signal),
      aborted,
    ]);
  } catch {
    response = governedErrorResponse(
      request,
      dependencies,
      requestId,
      operation,
      failure(500),
    );
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  }
  try {
    void Promise.resolve(
      dependencies.telemetry({
        operationId: operation,
        requestId,
        status: response.status,
        outcome:
          response.status < 400
            ? 'success'
            : response.status < 500
              ? 'rejected'
              : 'failure',
        actorClass: 'human',
        durationMs: Math.max(0, dependencies.now() - startedAt),
        ...(facts.activation === undefined
          ? {}
          : { activation: facts.activation }),
        observation: observeRequest(
          request,
          requestId,
          operation,
          response.status,
        ),
      }),
    ).catch(() => undefined);
  } catch {
    /* Telemetry cannot replace the decided response. */
  }
  return response;
};
