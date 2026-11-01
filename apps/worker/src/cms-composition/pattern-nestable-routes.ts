import { createRequestId, type PatternSelectorPage } from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { failure } from './pattern-instance-contracts';
import { validSelectorPage } from './pattern-update-answers';
import { parsePatternNestableQuery } from './pattern-nestable-query';
import type {
  CmsPatternUpdateDependencies,
  PatternNestableInput,
} from './pattern-update-ports';
import { patternUpdateRead } from './pattern-update-read';
import { patternUpdatePreflight } from './pattern-update-response';

const PATH = '/api/v1/cms/patterns/nestable';
const OPERATION = 'cmsPatternNestableRead';

/**
 * `GET /api/v1/cms/patterns/nestable` (cmsPatternNestableRead, DEC-196; BE03c 184, 413, 1528): the `active` pattern
 * versions of the owner party whose `compatibleTypeIds` contain EVERY requested content type, for the nested-pattern
 * picker of the pattern version designer. Designer only (`cms.template_designer`; an author or editor alone is a 403),
 * repeated `contentTypeId`, signed keyset cursor, the same `PatternSelectorPage` as CMS-03C-13 and the page version as
 * its ETag. Registered before `/api/v1/cms/patterns/:patternKey`: a request for `nestable` must never reach the
 * latest-read route.
 */
export const registerCmsPatternNestableRoute = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsPatternUpdateDependencies,
): void => {
  const requestIdOf = (request: Request): string =>
    createRequestId(request.headers.get('x-request-id') ?? undefined);
  app.options(PATH, (context) =>
    patternUpdatePreflight(
      context.req.raw,
      dependencies,
      requestIdOf(context.req.raw),
      OPERATION,
      'X-Request-Id',
    ),
  );
  app.get(PATH, (context) => {
    const request = context.req.raw;
    return patternUpdateRead<PatternNestableInput, PatternSelectorPage>(
      request,
      dependencies,
      requestIdOf(request),
      {
        operationId: OPERATION,
        admit: () => {
          const query = parsePatternNestableQuery(
            new URL(request.url).searchParams,
          );
          return query.ok ? { ok: true, value: { query: query.value } } : query;
        },
        read: async (input, signal) => {
          const result = await dependencies.readNestable(input, signal);
          // DEC-232: the matrix declares no 409 for this read (every cursor fault is a 400): a 409 from the port is a contract failure.
          return !result.ok && result.status === 409 ? failure(500) : result;
        },
        accept: (page, input) =>
          validSelectorPage(page, input.query) ? `"${page.pageVersion}"` : null,
      },
    );
  });
};
