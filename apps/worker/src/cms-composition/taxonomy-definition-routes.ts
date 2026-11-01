import {
  createRequestId,
  TaxonomyVersionsApiRequestSchema,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';
import { instrumentComposition } from './observability-instrument';
import {
  failure,
  MIN_TAXONOMY_ERROR_BYTES,
  type CmsTaxonomyDefinitionDependencies,
} from './taxonomy-definition-shared';
import { taxonomyError, taxonomyHeaders } from './taxonomy-definition-response';
import { taxonomyDefinitionWrite } from './taxonomy-definition-write-route';
import { taxonomyDefinitionVersions } from './taxonomy-definition-versions-route';
import {
  taxonomySelectorRead,
  taxonomyTermsRead,
} from './taxonomy-read-routes';
export type {
  CmsTaxonomyDefinitionDependencies,
  CmsTaxonomyDefinitionWriteInput,
  CmsTaxonomyDefinitionVersionsInput,
  CmsTaxonomyTermsInput,
  CmsTaxonomySelectorInput,
  CmsTaxonomyDefinitionError,
  CmsTaxonomyDefinitionResult,
} from './taxonomy-definition-shared';

export const registerCmsTaxonomyDefinitionRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsTaxonomyDefinitionDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    writes: ['createVersion'],
    reads: ['readVersions', 'readTerms', 'readSelector'],
  });
  if (
    dependencies.maxResponseBytes !== undefined &&
    (!Number.isSafeInteger(dependencies.maxResponseBytes) ||
      dependencies.maxResponseBytes < MIN_TAXONOMY_ERROR_BYTES)
  )
    throw new Error('Taxonomy response budget cannot carry a typed refusal.');
  const write = '/api/v1/cms/taxonomies/versions';
  const read = '/api/v1/cms/taxonomies/:taxonomyId/versions';
  const terms = '/api/v1/cms/taxonomies/:taxonomyId/terms';
  const selector = '/api/v1/cms/taxonomies/selector';
  for (const path of [write, read, terms, selector])
    app.options(path, (context) => {
      const request = context.req.raw;
      const requestId = createRequestId(
        request.headers.get('x-request-id') ?? undefined,
      );
      const origin = request.headers.get('origin');
      if (origin === null || !dependencies.humanOrigins.includes(origin))
        return taxonomyError(request, dependencies, requestId, failure(403));
      if (
        (path === read || path === terms) &&
        !TaxonomyVersionsApiRequestSchema.safeParse({
          taxonomyId: context.req.param('taxonomyId'),
        }).success
      )
        return taxonomyError(request, dependencies, requestId, failure(400));
      const headers = taxonomyHeaders(request, dependencies, requestId);
      headers.set(
        'access-control-allow-methods',
        path === write ? 'POST, OPTIONS' : 'GET, OPTIONS',
      );
      headers.set(
        'access-control-allow-headers',
        path === write
          ? 'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id'
          : 'X-Request-Id',
      );
      return new Response(null, { status: 204, headers });
    });
  app.post(write, (context) =>
    taxonomyDefinitionWrite(context.req.raw, dependencies),
  );
  app.get(read, (context) =>
    taxonomyDefinitionVersions(
      context.req.raw,
      context.req.param('taxonomyId'),
      dependencies,
    ),
  );
  app.get(terms, (context) =>
    taxonomyTermsRead(
      context.req.raw,
      context.req.param('taxonomyId'),
      dependencies,
    ),
  );
  app.get(selector, (context) =>
    taxonomySelectorRead(context.req.raw, dependencies),
  );
};
