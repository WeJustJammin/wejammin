import { createRequestId, type PatternSelectorPage } from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { validSelectorPage } from './pattern-update-answers';
import { parsePatternSelectorQuery } from './pattern-selector-query';
import type {
  CmsPatternUpdateDependencies,
  PatternSelectorInput,
} from './pattern-update-ports';
import { patternUpdateRead } from './pattern-update-read';
import { patternUpdatePreflight } from './pattern-update-response';

const PATH = '/api/v1/cms/patterns/selector';
const OPERATION = 'CMS-03C-13';

/**
 * CMS-03C-13 `GET /api/v1/cms/patterns/selector` (BE03c 175): the active, compatible pattern versions of the owner
 * party for one content type, author or editor only, signed keyset cursor, ETag = the page version. Registered before
 * `/api/v1/cms/patterns/:patternKey`: `selector` is a reserved pattern key and must never reach the latest-read route.
 */
export const registerCmsPatternSelectorRoute = <E extends Env>(
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
    return patternUpdateRead<PatternSelectorInput, PatternSelectorPage>(
      request,
      dependencies,
      requestIdOf(request),
      {
        operationId: OPERATION,
        admit: () => {
          const query = parsePatternSelectorQuery(
            new URL(request.url).searchParams,
          );
          return query.ok ? { ok: true, value: { query: query.value } } : query;
        },
        read: (input, signal) => dependencies.readSelector(input, signal),
        accept: (page, input) =>
          validSelectorPage(page, input.query) ? `"${page.pageVersion}"` : null,
      },
    );
  });
};
