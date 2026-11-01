import {
  CmsLineageIdSchema,
  type TaxonomySelectorPage,
  type TaxonomyTermListPage,
} from '@wejammin/contracts';
import { checkOrigin } from '../cms-editorial/admission-headers';
import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';
import {
  failure,
  humanSessionError,
  quota,
  validEnvelope,
  type CmsTaxonomyDefinitionDependencies,
  type CmsTaxonomyDefinitionError,
  type CmsTaxonomyDefinitionResult,
  type CmsTaxonomySelectorInput,
  type CmsTaxonomyTermsInput,
  type TaxonomyBaseInput,
} from './taxonomy-definition-shared';
import {
  taxonomyError,
  taxonomyOperation,
  taxonomySuccess,
} from './taxonomy-definition-response';
import {
  parseSelectorQuery,
  parseTermsQuery,
  type TaxonomyQueryResult,
} from './taxonomy-read-query';
import { validSelectorPage, validTermsPage } from './taxonomy-read-pages';

type ReadSpec<Input extends TaxonomyBaseInput, Page> = Readonly<{
  operationId: Input['operationId'];
  /** Strict path and query (BE00 step 6); the extra members the port input carries. */
  admit: (
    request: Request,
    taxonomyId: string | undefined,
  ) => TaxonomyQueryResult<Omit<Input, keyof TaxonomyBaseInput>>;
  read: (
    input: Input,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<Page>>;
  /** The page version (ETag operand) when the page honours the request, else null (502). */
  accept: (page: unknown, input: Input) => string | null;
}>;

/**
 * One taxonomy safe read in the BE00 order: origin and request media, session, human identity, strict path and query,
 * no precondition headers or body, capability then both quota buckets, the port, then the response contract. The ETag
 * is the page version; the answer is never cached.
 */
const taxonomyRead = <Input extends TaxonomyBaseInput, Page>(
  request: Request,
  taxonomyId: string | undefined,
  deps: CmsTaxonomyDefinitionDependencies,
  spec: ReadSpec<Input, Page>,
): Promise<Response> =>
  taxonomyOperation(
    request,
    deps,
    spec.operationId,
    async (signal, requestId) => {
      const refuse = (error: CmsTaxonomyDefinitionError) =>
        taxonomyError(request, deps, requestId, error);
      const early =
        checkOrigin(request, deps.humanOrigins) ??
        templateReadMediaError(request);
      if (early !== null) return refuse(early);
      const session = await deps.resolveSession(request, signal);
      if (!validEnvelope<CmsEditorialSession>(session))
        return refuse(failure(502));
      if (!session.ok) return refuse(session);
      const malformed = humanSessionError(session.value);
      if (malformed !== null) return refuse(malformed);
      const admitted = spec.admit(request, taxonomyId);
      if (!admitted.ok) return refuse(admitted);
      const headersError = templateReadHeadersError(request);
      if (headersError !== null) return refuse(headersError);
      const input = {
        operationId: spec.operationId,
        request,
        requestId,
        session: session.value,
        ...admitted.value,
      } as unknown as Input;
      const rateError = await quota(deps, input, signal);
      if (rateError !== null) return refuse(rateError);
      if (signal.aborted) return refuse(failure(504, {}, 5));
      const result = await spec.read(input, signal);
      if (!validEnvelope<Page>(result)) return refuse(failure(502));
      if (!result.ok) return refuse(result);
      const version = spec.accept(result.value, input);
      if (version === null) return refuse(failure(502));
      return taxonomySuccess(
        request,
        deps,
        requestId,
        result.value,
        version,
        200,
      );
    },
  );

export const taxonomyTermsRead = (
  request: Request,
  taxonomyId: string,
  deps: CmsTaxonomyDefinitionDependencies,
): Promise<Response> =>
  taxonomyRead<CmsTaxonomyTermsInput, TaxonomyTermListPage>(
    request,
    taxonomyId,
    deps,
    {
      operationId: 'cmsTaxonomyTermsRead',
      admit: (req, id) => {
        const lineage = CmsLineageIdSchema.safeParse(id);
        if (!lineage.success) return failure(400);
        const query = parseTermsQuery(
          lineage.data,
          new URL(req.url).searchParams,
        );
        return query.ok
          ? {
              ok: true,
              value: { taxonomyId: lineage.data, query: query.value },
            }
          : query;
      },
      read: (input, signal) => deps.readTerms(input, signal),
      accept: (page, input) =>
        validTermsPage(page, input.query) ? page.pageVersion : null,
    },
  );

export const taxonomySelectorRead = (
  request: Request,
  deps: CmsTaxonomyDefinitionDependencies,
): Promise<Response> =>
  taxonomyRead<CmsTaxonomySelectorInput, TaxonomySelectorPage>(
    request,
    undefined,
    deps,
    {
      operationId: 'CMS-03C-17',
      admit: (req) => {
        const query = parseSelectorQuery(new URL(req.url).searchParams);
        return query.ok ? { ok: true, value: { query: query.value } } : query;
      },
      read: (input, signal) => deps.readSelector(input, signal),
      accept: (page, input) =>
        validSelectorPage(page, input.query) ? page.pageVersion : null,
    },
  );
