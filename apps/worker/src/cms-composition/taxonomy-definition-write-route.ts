import {
  TaxonomyVersionApiRequestSchema,
  TaxonomyVersionRequestSchema,
  type TaxonomyVersionRequest,
} from '@wejammin/contracts';
import {
  decodeJsonBody,
  jsonBodyPreflight,
  readBytes,
} from '../cms-editorial/admission-body';
import {
  checkOrigin,
  csrfErrorIfCookie,
} from '../cms-editorial/admission-headers';
import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  failure,
  humanSessionError,
  quota,
  validDraft,
  validEnvelope,
  type CmsTaxonomyDefinitionDependencies,
} from './taxonomy-definition-shared';
import {
  taxonomyError,
  taxonomyOperation,
  taxonomySuccess,
} from './taxonomy-definition-response';

export const taxonomyDefinitionWrite = (
  request: Request,
  dependencies: CmsTaxonomyDefinitionDependencies,
): Promise<Response> =>
  taxonomyOperation(
    request,
    dependencies,
    'CMS-03C-16',
    async (signal, requestId) => {
      const refuse = (error: Parameters<typeof taxonomyError>[3]) =>
        taxonomyError(request, dependencies, requestId, error);
      const early =
        checkOrigin(request, dependencies.humanOrigins) ??
        jsonBodyPreflight(request) ??
        csrfErrorIfCookie(request);
      if (early !== null) return refuse(early);
      const bytes = await readBytes(request, signal);
      if (signal.aborted) return refuse(failure(504, {}, 5));
      if (!bytes.ok) return refuse(bytes);
      const session = await dependencies.resolveSession(request, signal);
      if (!validEnvelope<CmsEditorialSession>(session))
        return refuse(failure(502));
      if (!session.ok) return refuse(session);
      const malformed = humanSessionError(session.value);
      if (malformed !== null) return refuse(malformed);
      if (new URL(request.url).search !== '') return refuse(failure(400));
      const parsed = decodeJsonBody<TaxonomyVersionRequest>(
        bytes.value,
        TaxonomyVersionRequestSchema,
      );
      if (!parsed.ok) return refuse(parsed);
      const base = {
        operationId: 'CMS-03C-16' as const,
        request,
        requestId,
        session: session.value,
      };
      // Header parse precedes capability and quota (BE03c 408, 1502).
      const transport = TaxonomyVersionApiRequestSchema.safeParse({
        body: parsed.value,
        headers: {
          contentType: 'application/json',
          idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
          ...(request.headers.has('if-match')
            ? { ifMatch: request.headers.get('if-match') }
            : {}),
        },
      });
      if (!transport.success) return refuse(failure(400));
      const rateError = await quota(dependencies, base, signal);
      if (rateError !== null) return refuse(rateError);
      if (signal.aborted) return refuse(failure(504, {}, 5));
      const result = await dependencies.createVersion(
        {
          ...base,
          body: transport.data.body,
          idempotencyKey: transport.data.headers.idempotencyKey,
          ifMatch: transport.data.headers.ifMatch?.slice(1, -1) ?? null,
        },
        signal,
      );
      if (!validEnvelope(result)) return refuse(failure(502));
      if (!result.ok) return refuse(result);
      if (!validDraft(result.value, parsed.value)) return refuse(failure(502));
      return taxonomySuccess(
        request,
        dependencies,
        requestId,
        result.value,
        result.value.version,
        201,
      );
    },
  );
