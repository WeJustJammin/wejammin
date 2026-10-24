import { TaxonomyTermActionApiRequestSchema } from '@wejammin/contracts';

import { compositionRequestLog } from './cms-composition/observability-observation';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import {
  configuredOriginList,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
import { createTaxonomyTransport } from './cms-composition-production-taxonomy-context';
import { curatorError } from './cms-composition/taxonomy-definition-shared';
import {
  failure,
  validTerm,
  type CmsTaxonomyDependencies,
} from './cms-composition/taxonomy-contracts';

/**
 * CMS-03C-03 over `platform_api.cms_act_taxonomy_term` (BE03c 161, 1447, 1506). The route has already admitted the
 * request in the BE00 order; this port re-derives the server authority for the RPC from a fresh session resolution of
 * the same Request, repeats the strict transport contract (path, strict body, exact Idempotency-Key and quoted
 * If-Match equal to `expectedVersion`) and sends one named call: no retry, since the atomic command is idempotent only
 * through its reservation, and the bytes and key of a repeated request are the caller's. The answer must be the strict
 * term the request addressed (`validTerm`); anything else is a retryable 502.
 */
export const createProductionCmsTaxonomyDependencies = (
  options: CmsEditorialProductionOptions,
): CmsTaxonomyDependencies => {
  const { configuration, resolveSession, rpc } =
    createTaxonomyTransport(options);
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);
  return {
    humanOrigins: validateOriginList(
      options.humanOrigins ??
        configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
      Error,
    ),
    now: configuration.now,
    resolveSession,
    rateLimit: createRateLimiter(options),
    actTerm: async (input, signal) => {
      const url = new URL(input.request.url);
      const parsed = TaxonomyTermActionApiRequestSchema.safeParse({
        taxonomyId: input.path.taxonomyId,
        headers: {
          contentType: 'application/json',
          idempotencyKey: input.idempotencyKey,
          ifMatch: `"${input.ifMatch}"`,
        },
        body: input.body,
      });
      if (
        input.operationId !== 'CMS-03C-03' ||
        input.request.method !== 'POST' ||
        url.pathname !==
          `/api/v1/cms/taxonomies/${input.path.taxonomyId}/terms/actions` ||
        url.search !== '' ||
        !parsed.success ||
        parsed.data.body.taxonomyId !== input.path.taxonomyId ||
        input.request.headers.get('idempotency-key') !== input.idempotencyKey ||
        input.request.headers.get('if-match') !== `"${input.ifMatch}"`
      )
        return failure(400);
      const authority = curatorError(input.session);
      if (authority !== null) return authority;
      return rpc(
        input,
        {
          ...parsed.data.body,
          idempotencyKey: input.idempotencyKey,
          ifMatch: input.ifMatch,
        },
        (value): value is import('@wejammin/contracts').TaxonomyTermResource =>
          validTerm(value, parsed.data.body),
        signal,
      );
    },
    telemetry: (event) => {
      logger.info(
        compositionRequestLog(event, {
          eventName: 'cms.composition.taxonomy.request',
          operation: 'cms.composition.taxonomy.act',
        }),
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
