import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
} from './types';
import { CONTENT_SCHEMA_REGISTRY_RUNBOOK } from './types';
import { lifecycleMetrics } from './route-lifecycle-metrics';
import type { FeatureContext } from './route-types';
import { readOperationIds } from './route-types';
import {
  errorResponse,
  etagFor,
  isContentSchemaRegistryPrivateServiceRequest,
  policyFor,
  presentationVariantForSession,
  runTelemetry,
  setContentSchemaRegistryCapabilityHeader,
  successStatusFor,
  validatePortInput,
} from './route-response';

const UUID_TEXT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Location names the created resource. A successor (CMS-03A-09) is a new draft
 * version readable at the protected detail route; every other command keeps
 * the request path.
 */
const locationFor = (
  operationId: ContentSchemaRegistryOperationId,
  requestPath: string,
  value: unknown,
): string => {
  if (
    operationId === 'CMS-03A-09' &&
    typeof value === 'object' &&
    value !== null
  ) {
    const { id, contentTypeId } = value as {
      id?: unknown;
      contentTypeId?: unknown;
    };
    if (
      typeof id === 'string' &&
      typeof contentTypeId === 'string' &&
      UUID_TEXT.test(id) &&
      UUID_TEXT.test(contentTypeId)
    )
      return `/api/v1/cms/content-types/${contentTypeId}/versions/${id}`;
  }
  return requestPath;
};

export type ContentSchemaRegistryDomain = Readonly<{
  execute: (
    input: ContentSchemaRegistryPortInput,
  ) => Promise<ContentSchemaRegistryResult<unknown>>;
}>;

export type RouteExecutor = (
  context: FeatureContext,
  operationId: ContentSchemaRegistryOperationId,
  actorClass: 'human' | 'release-worker',
  input: ContentSchemaRegistryPortInput,
) => Promise<Response>;

export const createExecutor =
  (
    dependencies: ContentSchemaRegistryDependencies,
    domain: ContentSchemaRegistryDomain,
  ): RouteExecutor =>
  async (context, operationId, actorClass, input) => {
    const startedAt = dependencies.now?.() ?? Date.now();
    context.set('operationId', operationId);
    const policy = policyFor(operationId);
    let result: ContentSchemaRegistryResult<unknown>;
    try {
      result = await domain.execute(validatePortInput(operationId, input));
    } catch {
      result = {
        ok: false,
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: {},
      };
    }
    const durationMs = Math.max(
      0,
      (dependencies.now?.() ?? Date.now()) - startedAt,
    );
    await runTelemetry(dependencies, {
      operationId,
      requestId: context.get('requestId'),
      correlationId:
        context.req.header('x-correlation-id') ?? context.get('requestId'),
      outcome: result.ok
        ? 'success'
        : result.status >= 500
          ? 'failure'
          : 'rejected',
      status: result.ok
        ? successStatusFor(operationId, result.value)
        : result.status,
      ...(result.ok ? {} : { errorCode: result.code }),
      durationMs,
      actorClass,
      rateClass: policy.rateClass,
      rateLimit: policy.rateLimit,
      rateWindowSeconds: policy.rateWindowSeconds,
      deadlineMs: policy.timeoutMs,
      slo: policy.slo,
      alertClass: 'content_schema_registry_tier2',
      alertRoute: 'platform.on_call',
      runbook: CONTENT_SCHEMA_REGISTRY_RUNBOOK,
      traceSteps: [
        'cms.admission',
        'cms.authority',
        'cms.rate_limit',
        'cms.rpc',
        'cms.response',
      ],
      metrics: {
        duration_ms: durationMs,
        request_status: result.ok
          ? successStatusFor(operationId, result.value)
          : result.status,
        slo_command_p95_ms: policy.slo.commandP95Ms,
        slo_protected_rpc_p95_ms: policy.slo.protectedRpcP95Ms,
        slo_acceptance_p99_ms: policy.slo.acceptanceP99Ms,
        ...lifecycleMetrics(
          operationId,
          input,
          result,
          dependencies.now?.() ?? Date.now(),
        ),
      },
    });
    if (!result.ok)
      return errorResponse(context, result, context.get('requestId'));
    const isRead = readOperationIds.has(operationId);
    if (
      isRead &&
      input.session !== undefined &&
      isContentSchemaRegistryPrivateServiceRequest(input.request)
    )
      setContentSchemaRegistryCapabilityHeader(
        context,
        input.session.capabilities,
        presentationVariantForSession(input.session),
        input.session.userId,
        input.session.actingPartyId,
        input.session.stepUpFreshUntil,
      );
    context.header('cache-control', 'no-store');
    const etag = etagFor(result.value);
    if (etag !== null && !isRead) context.header('etag', etag);
    if (!isRead)
      context.header(
        'location',
        locationFor(operationId, context.req.path, result.value),
      );
    return context.json(
      result.value,
      successStatusFor(operationId, result.value),
    );
  };

export type { ContentSchemaRegistryError };
