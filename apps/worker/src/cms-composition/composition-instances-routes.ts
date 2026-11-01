import {
  createRequestId,
  type CompositionInstancePage,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { validInstancesPage } from './composition-instances-answers';
import { parseCompositionInstancesRequest } from './composition-instances-query';
import { failure } from './pattern-instance-contracts';
import type {
  CmsPatternUpdateDependencies,
  CompositionInstancesInput,
} from './pattern-update-ports';
import { patternUpdateRead } from './pattern-update-read';
import {
  NO_ETAG,
  patternUpdateError,
  patternUpdatePreflight,
} from './pattern-update-response';

const PATH = '/api/v1/cms/entries/:entryId/compositions';
const OPERATION = 'cmsCompositionInstancesRead';

/**
 * `GET /api/v1/cms/entries/{entryId}/compositions` (DEC-206; BE03c route registry): the newest draft, active and
 * pending-diff row of each path of the entry's current draft revision, in render order, at most `limit` (1-50, default
 * 25) per page, for the composition page's instance list and as its edit-authority gate. The path is a UUID and the
 * only query keys are the opaque signed cursor and `limit` (a bad value is a 400). The database answers 404 for a
 * hidden or absent entry and 403 for a visible entry the caller cannot edit; this read has no conflict and no
 * validation answer, so a 409 or 422 from the port is a contract failure (the scrubbed 500). The page carries no
 * version, so no entity tag is sent.
 */
export const registerCmsCompositionInstancesRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsPatternUpdateDependencies,
): void => {
  const requestIdOf = (request: Request): string =>
    createRequestId(request.headers.get('x-request-id') ?? undefined);
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = requestIdOf(request);
    const preflight = patternUpdatePreflight(
      request,
      dependencies,
      requestId,
      OPERATION,
      'X-Request-Id',
    );
    return preflight.status === 204 &&
      !parseCompositionInstancesRequest(
        context.req.param('entryId'),
        new URLSearchParams(),
      ).ok
      ? patternUpdateError(
          request,
          dependencies,
          requestId,
          OPERATION,
          failure(400),
        )
      : preflight;
  });
  app.get(PATH, (context) => {
    const request = context.req.raw;
    return patternUpdateRead<
      CompositionInstancesInput,
      CompositionInstancePage
    >(request, dependencies, requestIdOf(request), {
      operationId: OPERATION,
      admit: () =>
        parseCompositionInstancesRequest(
          context.req.param('entryId'),
          new URL(request.url).searchParams,
        ),
      read: async (input, signal) => {
        const result = await dependencies.readInstances(input, signal);
        return !result.ok && (result.status === 409 || result.status === 422)
          ? failure(500)
          : result;
      },
      accept: (page, input) =>
        validInstancesPage(page, input) ? NO_ETAG : null,
    });
  });
};
