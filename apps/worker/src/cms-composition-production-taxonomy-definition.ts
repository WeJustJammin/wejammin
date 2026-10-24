import { TaxonomyVersionApiRequestSchema } from '@wejammin/contracts';
import {
  configuredOriginList,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import { compositionRequestLog } from './cms-composition/observability-observation';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
import {
  curatorError,
  failure,
  validDraft,
  type CmsTaxonomyDefinitionDependencies,
  type TaxonomyOperation,
  type CmsTaxonomyDefinitionWriteInput,
} from './cms-composition/taxonomy-definition-shared';
import { createTaxonomyDefinitionVersionsReader } from './cms-composition-production-taxonomy-definition-versions';
import {
  createTaxonomySelectorReader,
  createTaxonomyTermsReader,
} from './cms-composition-production-taxonomy-reads';
import { createTaxonomyTransport } from './cms-composition-production-taxonomy-context';

const TELEMETRY_OPERATION: Readonly<Record<TaxonomyOperation, string>> = {
  'CMS-03C-03': 'cms.composition.taxonomy.act',
  'CMS-03C-16': 'cms.composition.taxonomy.define',
  'CMS-03C-17': 'cms.composition.taxonomy.selector',
  cmsTaxonomyVersionsRead: 'cms.composition.taxonomy.versions',
  cmsTaxonomyTermsRead: 'cms.composition.taxonomy.terms',
};

/** Request-bound server authority; public bodies never provide owner or RPC context. */
export const createProductionCmsTaxonomyDefinitionDependencies = (
  options: CmsEditorialProductionOptions,
): CmsTaxonomyDefinitionDependencies => {
  const { configuration, deadlineMs, resolveSession, rpc } =
    createTaxonomyTransport(options);
  const createVersion: CmsTaxonomyDefinitionDependencies['createVersion'] =
    async (input: CmsTaxonomyDefinitionWriteInput, signal) => {
      if (input.operationId !== 'CMS-03C-16') return failure(400);
      const url = new URL(input.request.url);
      if (
        input.request.method !== 'POST' ||
        url.pathname !== '/api/v1/cms/taxonomies/versions' ||
        url.search !== ''
      )
        return failure(400);
      const parsed = TaxonomyVersionApiRequestSchema.safeParse({
        body: input.body,
        headers: {
          contentType: 'application/json',
          idempotencyKey: input.idempotencyKey,
          ...(input.ifMatch === null ? {} : { ifMatch: `"${input.ifMatch}"` }),
        },
      });
      if (
        !parsed.success ||
        input.request.headers.get('idempotency-key') !== input.idempotencyKey ||
        input.request.headers.get('if-match') !==
          (input.ifMatch === null ? null : `"${input.ifMatch}"`)
      )
        return failure(400);
      const authority = curatorError(input.session);
      if (authority !== null) return authority;
      return rpc(
        input,
        {
          ...parsed.data.body,
          idempotencyKey: input.idempotencyKey,
          ...(input.ifMatch === null ? {} : { ifMatch: input.ifMatch }),
        },
        (
          value,
        ): value is import('@wejammin/contracts').TaxonomyVersionResource =>
          validDraft(value, parsed.data.body),
        signal,
      );
    };
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);
  return {
    humanOrigins: validateOriginList(
      options.humanOrigins ??
        configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
      Error,
    ),
    now: configuration.now,
    maxResponseBytes: configuration.maxResponseBytes,
    deadlineMs,
    resolveSession,
    rateLimit: createRateLimiter(options),
    createVersion,
    readVersions: createTaxonomyDefinitionVersionsReader(rpc),
    readTerms: createTaxonomyTermsReader(rpc),
    readSelector: createTaxonomySelectorReader(rpc),
    telemetry: (event) => {
      logger.info(
        compositionRequestLog(event, {
          eventName: 'cms.composition.taxonomy_definition.request',
          operation: TELEMETRY_OPERATION[event.operationId],
        }),
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
