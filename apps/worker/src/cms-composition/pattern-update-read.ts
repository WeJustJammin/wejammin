import { checkOrigin } from '../cms-editorial/admission-headers';
import {
  failure,
  patternUpdateAdmission,
  patternUpdateSession,
  validEnvelope,
  type CmsPatternUpdateDependencies,
  type PatternUpdateContext,
  type PatternUpdateError,
  type PatternUpdateResult,
} from './pattern-update-ports';
import {
  NO_ETAG,
  patternUpdateError,
  patternUpdateSuccess,
  runPatternUpdateRoute,
} from './pattern-update-response';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';

/** What a safe read adds to the admitted context once its strict path and query are parsed. */
export type PatternUpdateAdmitted<Extra> =
  Readonly<{ ok: true; value: Extra }> | PatternUpdateError;

type ReadInput = PatternUpdateContext &
  Readonly<{
    operationId:
      | 'CMS-03C-13'
      | 'CMS-03C-14'
      | 'cmsCompositionInstancesRead'
      | 'cmsPatternNestableRead';
  }>;

export type PatternUpdateReadSpec<Input extends ReadInput, Page> = Readonly<{
  operationId: Input['operationId'];
  /** Strict path and query (BE00 step 6): the members the port input carries beyond the admitted context. */
  admit: () => PatternUpdateAdmitted<
    Omit<Input, keyof PatternUpdateContext | 'operationId'>
  >;
  read: (
    input: Input,
    signal: AbortSignal,
  ) => Promise<PatternUpdateResult<Page>>;
  /** The strong ETag (or `NO_ETAG` for an unversioned page) when the page honours the request, else null (an invalid dependency answer, 502). */
  accept: (page: unknown, input: Input) => string | typeof NO_ETAG | null;
}>;

/**
 * One safe read in the BE00 order: origin and request media, verified human session, strict path and query, no
 * precondition headers or body, the route capability, the user then party quota, the port, then the response contract.
 * The answer is never cached; its ETag is the page or instance version.
 */
export const patternUpdateRead = <Input extends ReadInput, Page>(
  request: Request,
  dependencies: CmsPatternUpdateDependencies,
  requestId: string,
  spec: PatternUpdateReadSpec<Input, Page>,
): Promise<Response> =>
  runPatternUpdateRoute(
    request,
    dependencies,
    requestId,
    spec.operationId,
    async (signal) => {
      const refuse = (error: PatternUpdateError): Response =>
        patternUpdateError(
          request,
          dependencies,
          requestId,
          spec.operationId,
          error,
        );
      const early =
        checkOrigin(request, dependencies.humanOrigins) ??
        templateReadMediaError(request);
      if (early !== null) return refuse(early);
      const session = await patternUpdateSession(dependencies, request, signal);
      if (!session.ok) return refuse(session);
      const admitted = spec.admit();
      if (!admitted.ok) return refuse(admitted);
      const headersError = templateReadHeadersError(request);
      if (headersError !== null) return refuse(headersError);
      const admission = await patternUpdateAdmission(
        dependencies,
        spec.operationId,
        request,
        session.value,
        signal,
      );
      if (admission !== null) return refuse(admission);
      const input = {
        operationId: spec.operationId,
        request,
        requestId,
        session: session.value,
        ...admitted.value,
      } as unknown as Input;
      let result: PatternUpdateResult<Page>;
      try {
        result = await spec.read(input, signal);
      } catch {
        return refuse(failure(503, {}, 15));
      }
      if (!validEnvelope<Page>(result)) return refuse(failure(502));
      if (!result.ok) return refuse(result);
      const etag = spec.accept(result.value, input);
      if (etag === null) return refuse(failure(502));
      return patternUpdateSuccess(
        request,
        dependencies,
        requestId,
        result.value,
        etag,
      );
    },
  );
