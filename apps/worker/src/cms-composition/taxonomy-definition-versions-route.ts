import { TaxonomyVersionsApiRequestSchema } from '@wejammin/contracts';
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
  validVersions,
  type CmsTaxonomyDefinitionDependencies,
} from './taxonomy-definition-shared';
import {
  taxonomyError,
  taxonomyOperation,
  taxonomySuccess,
} from './taxonomy-definition-response';

export const taxonomyDefinitionVersions = (
  request: Request,
  taxonomyId: string,
  deps: CmsTaxonomyDefinitionDependencies,
): Promise<Response> =>
  taxonomyOperation(
    request,
    deps,
    'cmsTaxonomyVersionsRead',
    async (signal, requestId) => {
      const refuse = (error: Parameters<typeof taxonomyError>[3]) =>
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
      const path = TaxonomyVersionsApiRequestSchema.safeParse({ taxonomyId });
      if (!path.success || new URL(request.url).search !== '')
        return refuse(failure(400));
      const headersError = templateReadHeadersError(request);
      if (headersError !== null) return refuse(headersError);
      const base = {
        operationId: 'cmsTaxonomyVersionsRead' as const,
        request,
        requestId,
        session: session.value,
      };
      const rateError = await quota(deps, base, signal);
      if (rateError !== null) return refuse(rateError);
      if (signal.aborted) return refuse(failure(504, {}, 5));
      const result = await deps.readVersions(
        { ...base, taxonomyId: path.data.taxonomyId },
        signal,
      );
      if (!validEnvelope(result)) return refuse(failure(502));
      if (!result.ok) return refuse(result);
      if (!validVersions(result.value, taxonomyId)) return refuse(failure(502));
      return taxonomySuccess(
        request,
        deps,
        requestId,
        result.value,
        result.value.pageVersion,
        200,
      );
    },
  );
