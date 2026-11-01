import {
  RelatedContentHeadersSchema,
  RelatedContentPathSchema,
  RelatedContentResourceSchema,
  RelatedContentRuleRequestSchema,
  type RelatedContentResource,
} from '@wejammin/contracts';

import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import { compositionRequestLog } from './cms-composition/observability-observation';
import { defaultCmsEditorialLogger } from './cms-editorial-production-telemetry';
import {
  cmsEditorialContextFor,
  configuredOriginList,
  correlationFor,
  createCmsEditorialSessionResolver,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import {
  invalidResponse,
  unavailable,
} from './cms-editorial-production-errors';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import {
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  type CmsEditorialProductionConfiguration,
  type CmsEditorialProductionOptions,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import { createRelatedContentReader } from './cms-composition-production-related-read';
import { relatedRpcError } from './cms-composition-production-related-rpc';
import { failure } from './cms-composition/related-content-response';
import type {
  CmsRelatedContentDependencies,
  CmsRelatedContentPortInput,
  CmsRelatedContentResult,
} from './cms-composition/related-content-routes';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

const RPC = 'cms_curate_related_content';

/** The curation answers the request it was given: same source, same ordered pins and exclusions. */
const answersRequest = (
  resource: RelatedContentResource,
  body: Readonly<{
    entryId: string;
    pins: readonly string[];
    exclusions: readonly string[];
  }>,
): boolean =>
  resource.sourceEntryId === body.entryId &&
  resource.pins.join('\u0000') === body.pins.join('\u0000') &&
  resource.exclusions.join('\u0000') === body.exclusions.join('\u0000');

/**
 * CMS-03C-05 production adapter. The Worker alone selects the private-schema RPC with the service credential;
 * the browser never receives the key. The database re-proves the source assignment, the target eligibility,
 * the registry rule and the entry version under its own locks regardless of what the Worker validated.
 */
export const createProductionCmsRelatedContentDependencies = (
  options: CmsEditorialProductionOptions,
): CmsRelatedContentDependencies => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? MAX_DEFAULT_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > DEFAULT_DEADLINE_MS ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1
  )
    throw new Error('Invalid CMS related-content production configuration.');
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes,
    now: options.now ?? Date.now,
  };
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const logger =
    options.logger ?? defaultCmsEditorialLogger(options.environment);

  const actRelatedContent = async (
    input: CmsRelatedContentPortInput,
    signal: AbortSignal,
  ): Promise<CmsRelatedContentResult<RelatedContentResource>> => {
    if (input.operationId !== 'CMS-03C-05') return failure(400);
    const path = RelatedContentPathSchema.safeParse(input.path);
    const headers = RelatedContentHeadersSchema.safeParse({
      contentType: 'application/json',
      idempotencyKey: input.idempotencyKey,
      ifMatch: `"${input.ifMatch}"`,
    });
    if (!path.success || !headers.success) return failure(400);
    const body = RelatedContentRuleRequestSchema.safeParse(input.body);
    if (!body.success) return failure(422);
    // The contract admits upper-case hex UUIDs (and dedupes them case-insensitively); the database accepts
    // lower-case only (cms_valid_uuid), so the adapter sends and compares the canonical lower-case form.
    const command = {
      ...body.data,
      entryId: body.data.entryId.toLowerCase(),
      pins: body.data.pins.map((id) => id.toLowerCase()),
      exclusions: body.data.exclusions.map((id) => id.toLowerCase()),
    };
    if (
      path.data.entryId.toLowerCase() !== command.entryId ||
      command.expectedVersion !== input.ifMatch
    )
      return failure(400);
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.some(
        (value) => value === 'cms.author' || value === 'cms.editor',
      )
    )
      return failure(403, { reasonCode: 'capability_missing' });
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return failure(401);
    const deadline = createDeadline(signal, deadlineMs);
    const timedOut = () => failure(504, {}, 15);
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/${RPC}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'CMS-03C-05',
            'X-Request-Id': input.requestId,
            'X-Correlation-Id': correlationFor(input),
            'X-Idempotency-Key': input.idempotencyKey,
            'If-Match': `"${input.ifMatch}"`,
          },
          body: JSON.stringify({
            p_request: {
              ...command,
              idempotencyKey: input.idempotencyKey,
              ifMatch: input.ifMatch,
              context,
              correlationId: correlationFor(input),
            },
          }),
        },
        deadline,
      );
      if (!response.ok) return response;
      if (!response.value.ok) {
        const payload = await readRpcError(
          response.value,
          maxResponseBytes,
          deadline.signal,
        );
        return deadline.expired()
          ? timedOut()
          : relatedRpcError(response.value.status, payload);
      }
      const parsed = await parseJsonResponse(
        response.value,
        maxResponseBytes,
        deadline.signal,
      );
      if (deadline.expired()) return timedOut();
      if (!parsed.ok) return parsed;
      const resource = RelatedContentResourceSchema.safeParse(parsed.value);
      return resource.success && answersRequest(resource.data, command)
        ? { ok: true, value: resource.data }
        : invalidResponse();
    } catch {
      return unavailable('cms_composition');
    } finally {
      deadline.dispose();
    }
  };

  return {
    humanOrigins: validateOriginList(
      options.humanOrigins ??
        configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
      Error,
    ),
    now: configuration.now,
    resolveSession: createCmsEditorialSessionResolver(
      options,
      configuration,
      contexts,
    ),
    rateLimit: createRateLimiter(options),
    actRelatedContent,
    readRelatedContent: createRelatedContentReader(
      configuration,
      contexts,
      deadlineMs,
      maxResponseBytes,
    ),
    telemetry: (event) => {
      logger.info(
        compositionRequestLog(event, {
          eventName: 'cms.composition.related_content.request',
          operation:
            event.operationId === 'cmsRelatedContentRead'
              ? 'cms.composition.related_content.read'
              : 'cms.composition.related_content.act',
        }),
        { samplingClass: 'always', highRisk: event.outcome !== 'success' },
      );
    },
  };
};
