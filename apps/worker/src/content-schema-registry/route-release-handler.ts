import type {
  BlockLifecycleAdvanceRequest,
  BlockRegistrationRequest,
} from './contracts';
import {
  checkOrigin,
  dependencyDeadline,
  parseJsonBody,
  parseMutationHeaders,
  readReleaseAdmission,
  requireReleaseCapability,
  schemaForReleaseOperation,
  validReleasePrincipal,
} from './admission';
import type { ContentSchemaRegistryDependencies } from './types';
import type { FeatureContext } from './route-types';
import { rateLimitedError } from './route-rate-refusal';
import { errorResponse, policyFor, setRateHeaders } from './route-response';
import type { RouteExecutor } from './route-execution';

export type ReleaseMutation = (
  context: FeatureContext,
  operationId: 'CMS-03A-05' | 'CMS-03A-08',
  path?: Readonly<Record<string, string>>,
) => Promise<Response>;

export const createReleaseMutation =
  (
    dependencies: ContentSchemaRegistryDependencies,
    execute: RouteExecutor,
  ): ReleaseMutation =>
  async (context, operationId, path = {}) => {
    const origin = checkOrigin(context.req.raw, dependencies.releaseOrigins);
    if (origin !== null)
      return errorResponse(context, origin, context.get('requestId'));
    const headers = parseMutationHeaders(context.req.raw, operationId);
    if (!headers.ok)
      return errorResponse(context, headers, context.get('requestId'));
    const release = await readReleaseAdmission(
      context.req.raw,
      operationId,
      dependencies,
      context.get('requestId'),
      new AbortController().signal,
    );
    if (!release.ok)
      return errorResponse(context, release, context.get('requestId'));
    const validPrincipal = validReleasePrincipal(
      release.value.principal,
      release.value.headers.keyId,
    );
    if (validPrincipal !== null)
      return errorResponse(context, validPrincipal, context.get('requestId'));
    const capability = requireReleaseCapability(release.value.principal);
    if (capability !== null)
      return errorResponse(context, capability, context.get('requestId'));
    const body = await parseJsonBody<
      BlockRegistrationRequest | BlockLifecycleAdvanceRequest
    >(context.req.raw, schemaForReleaseOperation(operationId));
    if (!body.ok) return errorResponse(context, body, context.get('requestId'));
    const rate = await dependencyDeadline(
      (signal) =>
        dependencies.rateLimit(
          {
            operationId,
            request: context.req.raw,
            actorId: release.value.principal.principalId,
            actingPartyId: null,
            principalClass: 'release-worker',
            rateClass: policyFor(operationId).rateClass,
            limit: policyFor(operationId).rateLimit,
            windowSeconds: policyFor(operationId).rateWindowSeconds,
          },
          signal,
        ),
      dependencies.deadlineMs ?? 15_000,
    );
    if (!rate.ok) return errorResponse(context, rate, context.get('requestId'));
    setRateHeaders(context, rate.value);
    if (!rate.value.allowed)
      return errorResponse(
        context,
        rateLimitedError(rate.value, dependencies.now?.() ?? Date.now()),
        context.get('requestId'),
      );
    return execute(context, operationId, 'release-worker', {
      operationId,
      requestId: context.get('requestId'),
      request: context.req.raw,
      principal: release.value.principal,
      path,
      body: body.value as
        BlockRegistrationRequest | BlockLifecycleAdvanceRequest,
      idempotencyKey: headers.value.idempotencyKey,
      ...(headers.value.ifMatch === undefined
        ? {}
        : { ifMatch: headers.value.ifMatch }),
      rawBody: release.value.rawBody,
      release: {
        headers: release.value.headers,
        rawBody: release.value.rawBody,
      },
    });
  };
