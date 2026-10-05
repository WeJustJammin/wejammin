import {
  ClientBindingIdSchema,
  CmsStrongEtagSchema,
  createRequestId,
} from '@wejammin/contracts';
import {
  CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS,
  isBinding,
  PLATFORM_API_ORIGIN,
} from './content-schema-registry-platform-shared';
import type {
  ContentSchemaRegistryMutationOperationId,
  ContentSchemaRegistryMutationTarget,
} from './content-schema-registry-platform-shared';
import {
  MutationInputError,
  parseFormDataInput,
  parseJsonInput,
} from './content-schema-registry-platform-input';
import type { ParsedMutationInput } from './content-schema-registry-platform-input';
import {
  boundedMutationInput,
  contentSchemaRegistryMutationOperationFromBoundedInput,
  isJsonMutationContentType,
} from './content-schema-registry-platform-bounded-input';
import {
  copyMutationResponseHeaders,
  csrfCookie,
  forwardedMutationCookies,
  forwardedMutationError,
  invalidPayloadError,
  localMutationError,
  mutationPath,
  printableToken,
  sameOriginMutationRequest,
  schemaParseMutation,
  schemaParseSuccess,
} from './content-schema-registry-platform-mutation-support';

export const forwardContentSchemaRegistryMutation = async (
  request: Request,
  binding: unknown,
  target: ContentSchemaRegistryMutationTarget,
): Promise<Response> => {
  if (!isBinding(binding) || request.method !== 'POST')
    return localMutationError(request, 503);
  if (!sameOriginMutationRequest(request))
    return localMutationError(request, 403);
  const clientBindingId = request.headers.get('x-client-binding-id');
  if (
    clientBindingId !== null &&
    !ClientBindingIdSchema.safeParse(clientBindingId).success
  ) {
    return localMutationError(request, 400);
  }
  const path = mutationPath(target);
  if (path === null) return localMutationError(request, 400);

  // One bounded read of this request, shared with the operation probe below.
  const bounded = await boundedMutationInput(request);
  if (!bounded.read.ok) return localMutationError(request, 400);
  let parsed: ParsedMutationInput;
  try {
    parsed = isJsonMutationContentType(bounded.contentType)
      ? await parseJsonInput(bounded, target)
      : await parseFormDataInput(bounded, target);
  } catch (error) {
    if (error instanceof MutationInputError)
      return localMutationError(request, 400);
    return localMutationError(request, 400);
  }
  if (
    parsed.transport.operationId !== null &&
    parsed.transport.operationId !== target.operationId
  ) {
    return localMutationError(request, 400);
  }

  const headerCsrf = request.headers.get('x-csrf-token');
  const csrfToken = parsed.transport.csrfToken ?? headerCsrf;
  if (
    headerCsrf !== null &&
    parsed.transport.csrfToken !== null &&
    headerCsrf !== parsed.transport.csrfToken
  ) {
    return localMutationError(request, 403);
  }
  if (!printableToken(csrfToken, 512) || csrfCookie(request) !== csrfToken)
    return localMutationError(request, 403);

  const headerIdempotency = request.headers.get('idempotency-key');
  const idempotencyKey = parsed.transport.idempotencyKey ?? headerIdempotency;
  if (
    headerIdempotency !== null &&
    parsed.transport.idempotencyKey !== null &&
    headerIdempotency !== parsed.transport.idempotencyKey
  ) {
    return localMutationError(request, 400);
  }
  if (!printableToken(idempotencyKey, 128) || (idempotencyKey?.length ?? 0) < 8)
    return localMutationError(request, 400);

  const headerIfMatch = request.headers.get('if-match');
  const ifMatch = parsed.transport.ifMatch ?? headerIfMatch;
  if (
    headerIfMatch !== null &&
    parsed.transport.ifMatch !== null &&
    headerIfMatch !== parsed.transport.ifMatch
  ) {
    return localMutationError(request, 400);
  }
  if (
    CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS[target.operationId]
      .requiresIfMatch &&
    !CmsStrongEtagSchema.safeParse(ifMatch).success
  ) {
    return localMutationError(request, 400);
  }

  const stepUpHeader = request.headers.get('x-step-up-token');
  const stepUpToken = parsed.transport.stepUpToken ?? stepUpHeader;
  if (
    stepUpHeader !== null &&
    parsed.transport.stepUpToken !== null &&
    stepUpHeader !== parsed.transport.stepUpToken
  ) {
    return localMutationError(request, 400);
  }
  // Recent MFA is the session's step-up proof, which the Worker checks (401
  // STEP_UP_REQUIRED); the activation form has no token field, so a token is
  // forwarded only when a caller supplied one and is never demanded here.
  if (
    target.operationId === 'CMS-03A-04' &&
    parsed.transport.source === 'form' &&
    parsed.transport.confirmed !== true
  ) {
    return localMutationError(request, 403);
  }
  if (stepUpToken !== null && !printableToken(stepUpToken, 512)) {
    return localMutationError(request, 403);
  }

  const validated = schemaParseMutation(target.operationId, parsed.payload);
  if (!validated.success)
    return invalidPayloadError(request, validated.error?.issues ?? []);

  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
    'content-type': 'application/json',
    origin: PLATFORM_API_ORIGIN,
    'idempotency-key': idempotencyKey as string,
    'x-csrf-token': csrfToken as string,
  });
  if (ifMatch !== null) headers.set('if-match', ifMatch);
  if (stepUpToken !== null) headers.set('x-step-up-token', stepUpToken);
  const cookie = forwardedMutationCookies(request);
  if (cookie !== null) headers.set('cookie', cookie);
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  headers.set('x-request-id', requestId);
  const correlationId = request.headers.get('x-correlation-id');
  if (correlationId !== null && printableToken(correlationId, 128))
    headers.set('x-correlation-id', correlationId);
  if (clientBindingId !== null)
    headers.set('x-client-binding-id', clientBindingId);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(`${PLATFORM_API_ORIGIN}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(validated.data),
      }),
    );
  } catch {
    return localMutationError(request, 503);
  }
  if (!(upstream instanceof Response)) return localMutationError(request, 503);

  const responseContentType = upstream.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/iu.test(responseContentType))
    return localMutationError(request, 502);
  if (
    !CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS[
      target.operationId
    ].successStatuses.some((status) => status === upstream.status)
  )
    return forwardedMutationError(request, upstream);
  let responseBody: unknown;
  try {
    responseBody = await upstream.json();
  } catch {
    return localMutationError(request, 502);
  }
  const parsedResponse = schemaParseSuccess(target.operationId, responseBody);
  if (!parsedResponse.success) return localMutationError(request, 502);
  const responseHeaders = copyMutationResponseHeaders(upstream);
  if (!responseHeaders.has('x-request-id'))
    responseHeaders.set('x-request-id', requestId);
  return new Response(JSON.stringify(parsedResponse.data), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};

/** Stable name used by route adapters and tests for the mutation facade. */
export const forwardContentSchemaRegistryRequest =
  forwardContentSchemaRegistryMutation;

/** Read only the operation discriminator so Astro can keep native POST flows. */
export const contentSchemaRegistryMutationOperationFromRequest = async (
  request: Request,
): Promise<ContentSchemaRegistryMutationOperationId | null> => {
  // BE00 step 2: a request that cannot be shown to be same-origin is refused
  // before its body is read, so a cross-site POST is never buffered here.
  if (!sameOriginMutationRequest(request)) return null;
  // The same bounded read (and, for a form, the same parsed form) the facade
  // uses, so a cookie-bearing request is never read twice.
  const bounded = await boundedMutationInput(request);
  try {
    return await contentSchemaRegistryMutationOperationFromBoundedInput(
      bounded,
    );
  } catch {
    return null;
  }
};
