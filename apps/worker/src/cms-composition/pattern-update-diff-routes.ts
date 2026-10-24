import {
  CompositionUpdateDiffApiRequestSchema,
  createRequestId,
  type CompositionUpdateDiffResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { failure } from './pattern-instance-contracts';
import { validUpdateDiff } from './pattern-update-answers';
import type {
  CmsPatternUpdateDependencies,
  PatternUpdateDiffInput,
} from './pattern-update-ports';
import { patternUpdateRead } from './pattern-update-read';
import {
  patternUpdateError,
  patternUpdatePreflight,
} from './pattern-update-response';

const PATH = '/api/v1/cms/compositions/instances/:instanceId/update-diff';
const OPERATION = 'CMS-03C-14';

/**
 * CMS-03C-14 `GET .../instances/{instanceId}/update-diff` (BE03c 176): the three-way diff of one pattern instance for
 * its assigned author or editor. The path is a UUID and no query key is allowed (any is a 400); the strong ETag is the
 * instance `version`. An instance with no newer version answers 200 with an empty diff (DEC-180 G4), not an error.
 */
export const registerCmsPatternUpdateDiffRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsPatternUpdateDependencies,
): void => {
  const requestIdOf = (request: Request): string =>
    createRequestId(request.headers.get('x-request-id') ?? undefined);
  const parsePath = (instanceId: string | undefined, search: string) =>
    CompositionUpdateDiffApiRequestSchema.safeParse({
      instanceId,
      query: search === '' ? {} : { search },
    });
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
      !parsePath(context.req.param('instanceId'), '').success
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
      PatternUpdateDiffInput,
      CompositionUpdateDiffResource
    >(request, dependencies, requestIdOf(request), {
      operationId: OPERATION,
      admit: () => {
        const parsed = parsePath(
          context.req.param('instanceId'),
          new URL(request.url).search,
        );
        return parsed.success
          ? { ok: true, value: { instanceId: parsed.data.instanceId } }
          : failure(400);
      },
      read: (input, signal) => dependencies.readUpdateDiff(input, signal),
      accept: (diff, input) =>
        validUpdateDiff(diff, input.instanceId)
          ? `"${diff.instance.version}"`
          : null,
    });
  });
};
