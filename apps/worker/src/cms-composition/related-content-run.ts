import { errorResponse } from './related-content-route-helpers';
import { observeRequest } from './observability-observation';
import { failure } from './related-content-response';
import type { CmsRelatedContentDependencies } from './related-content-types';

/**
 * One related-content operation under its registry deadline: the work gets an abort signal that fires at
 * `deadlineMs` (a deadline is 504 with `Retry-After: 15`), an uncaught failure is a scrubbed 500, and exactly one
 * telemetry event follows whatever the outcome (a telemetry failure never changes the response).
 */
export const runRelatedContentRoute = async (
  request: Request,
  dependencies: CmsRelatedContentDependencies,
  requestId: string,
  operationId: 'CMS-03C-05' | 'cmsRelatedContentRead',
  deadlineMs: number,
  execute: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> => {
  const startedAt = dependencies.now();
  const controller = new AbortController();
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(
        errorResponse(request, dependencies, requestId, failure(504, {}, 15)),
      );
    }, deadlineMs);
  });
  let response: Response;
  try {
    response = await Promise.race([execute(controller.signal), timeout]);
  } catch {
    response = errorResponse(request, dependencies, requestId, failure(500));
  } finally {
    clearTimeout(timer);
  }
  try {
    void Promise.resolve(
      dependencies.telemetry({
        operationId,
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
        observation: observeRequest(
          request,
          requestId,
          operationId,
          response.status,
        ),
      }),
    ).catch(() => undefined);
  } catch {
    /* Telemetry cannot change the response. */
  }
  return response;
};
