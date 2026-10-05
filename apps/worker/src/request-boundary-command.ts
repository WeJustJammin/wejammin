import {
  InfrastructureCommandSchema,
  ProtectedCommandHeadersSchema,
} from '@wejammin/contracts';

import {
  decodeBoundedText,
  readBoundedRequestBytes,
} from './http/bounded-body';
import {
  invalid,
  isJsonContentType,
  issueDetails,
  normalizedHeaderValue,
  payloadTooLarge,
  requestIdFor,
  unsupportedMediaType,
  type IssueLike,
} from './request-boundary-support';
import {
  MAX_JSON_BODY_BYTES,
  type ProtectedCommandRequest,
  type RequestBoundaryResult,
} from './request-boundary-types';

/** Parses body and command headers before session or authority lookup. */
export const parseProtectedCommandRequest = async (
  request: Request,
): Promise<RequestBoundaryResult<ProtectedCommandRequest>> => {
  const requestId = requestIdFor(request);
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return unsupportedMediaType(requestId);
  }
  const outcome = await readBoundedRequestBytes(request, {
    maxBytes: MAX_JSON_BODY_BYTES,
  });
  if (outcome.kind === 'too-large') return payloadTooLarge(requestId);
  if (outcome.kind === 'malformed-length')
    return invalid(requestId, 'The Content-Length header is invalid.');
  if (outcome.kind !== 'ok')
    return invalid(requestId, 'The request body could not be read.');
  const bodyText = decodeBoundedText(outcome.bytes);

  let body: unknown;
  try {
    body = JSON.parse(bodyText) as unknown;
  } catch {
    return invalid(requestId, 'The request body is not valid JSON.');
  }

  const command = InfrastructureCommandSchema.safeParse(body);
  const headerCandidate: Record<string, string> = {
    contentType: 'application/json',
  };
  const idempotencyKey = normalizedHeaderValue(
    request.headers.get('idempotency-key'),
  );
  const ifMatch = normalizedHeaderValue(request.headers.get('if-match'));
  if (idempotencyKey !== undefined)
    headerCandidate.idempotencyKey = idempotencyKey;
  if (ifMatch !== undefined) headerCandidate.ifMatch = ifMatch;
  const headers = ProtectedCommandHeadersSchema.safeParse(headerCandidate);

  if (!command.success || !headers.success) {
    const issues: IssueLike[] = [];
    if (!command.success) issues.push(...command.error.issues);
    if (!headers.success) {
      issues.push(
        ...headers.error.issues.map((issue) => ({
          ...issue,
          path: ['headers', ...issue.path],
        })),
      );
    }
    return invalid(
      requestId,
      'The protected command request is invalid.',
      issueDetails(issues),
      422,
    );
  }

  return {
    ok: true,
    requestId,
    value: { command: command.data, headers: headers.data },
  };
};
