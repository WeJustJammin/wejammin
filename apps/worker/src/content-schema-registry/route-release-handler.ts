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
import { invalid } from './admission-common';
import type { ContentSchemaRegistryDependencies } from './types';
import type { FeatureContext } from './route-types';
import { rateLimitedError } from './route-rate-refusal';
import { reportRateRefusal } from './route-rate-telemetry';
import { createRefuse } from './route-refusal-telemetry';
import { policyFor, setRateHeaders } from './route-response';
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
    const startedAt = dependencies.now?.() ?? Date.now();
    // The caller is anonymous until the signed principal is verified; every early
    // answer is reported as sanitized refusal telemetry (a rejected signature is a
    // rejected nonce claim for the release counters).
    let actorClass: 'anonymous' | 'release-worker' = 'anonymous';
    const refuse = createRefuse(
      dependencies,
      context,
      operationId,
      startedAt,
      () => actorClass,
    );
    const origin = checkOrigin(context.req.raw, dependencies.releaseOrigins);
    if (origin !== null) return refuse(origin);
    const headers = parseMutationHeaders(context.req.raw, operationId);
    if (!headers.ok) return refuse(headers);
    const release = await readReleaseAdmission(
      context.req.raw,
      operationId,
      dependencies,
      context.get('requestId'),
      new AbortController().signal,
    );
    if (!release.ok) return refuse(release);
    actorClass = 'release-worker';
    const validPrincipal = validReleasePrincipal(
      release.value.principal,
      release.value.headers.keyId,
    );
    if (validPrincipal !== null) return refuse(validPrincipal);
    const capability = requireReleaseCapability(release.value.principal);
    if (capability !== null) return refuse(capability);
    const body = await parseJsonBody<
      BlockRegistrationRequest | BlockLifecycleAdvanceRequest
    >(context.req.raw, schemaForReleaseOperation(operationId));
    if (!body.ok) return refuse(body);
    // The body expectedVersion and the strong If-Match name one version; a
    // disagreement is a malformed request, never silently resolved (the same
    // rule the human mutations apply).
    const bodyVersion = (body.value as { expectedVersion?: unknown })
      .expectedVersion;
    if (
      typeof bodyVersion === 'string' &&
      headers.value.ifMatch !== undefined &&
      bodyVersion !== headers.value.ifMatch
    )
      return refuse(
        invalid('expectedVersion must equal the If-Match version.'),
      );
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
    if (!rate.ok) return refuse(rate);
    setRateHeaders(context, rate.value);
    if (!rate.value.allowed) {
      await reportRateRefusal(
        dependencies,
        context,
        operationId,
        'release-worker',
        rate.value,
        startedAt,
      );
      return refuse(
        rateLimitedError(rate.value, dependencies.now?.() ?? Date.now()),
      );
    }
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
