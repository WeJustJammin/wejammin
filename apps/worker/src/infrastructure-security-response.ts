import { type CommandResult, type RequestId } from '@wejammin/contracts';

import { type ProtectedCommandDecision } from '@wejammin/application/infrastructure/security';
import { MFA_METHOD_REGISTRY } from './authentication/step-up';
import { createSafeErrorResponse, withNoStore } from './request-boundary';

export const addOriginVary = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('vary', 'Origin');
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

export const browserSecurityFailure = (requestId: RequestId): Response =>
  addOriginVary(
    createSafeErrorResponse(requestId, {
      code: 'FORBIDDEN',
      details: { reasonCode: 'ORIGIN_CSRF_REQUIRED' },
      message: 'The request is not authorized.',
      status: 403,
    }),
  );

export const dependencyFailure = (requestId: RequestId): Response => {
  const response = createSafeErrorResponse(requestId, {
    code: 'DEPENDENCY_UNAVAILABLE',
    details: {
      dependencyClass: 'authorization',
      retryable: true,
      retryAfterSeconds: 1,
    },
    message: 'The protected command is temporarily unavailable.',
    status: 503,
  });
  const headers = new Headers(response.headers);
  headers.set('retry-after', '1');
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const commandResultResponse = (
  requestId: RequestId,
  result: CommandResult,
): Response =>
  withNoStore(
    new Response(JSON.stringify(result), {
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
      status: 200,
    }),
  );

const conflictResponse = (
  requestId: RequestId,
  decision: Extract<ProtectedCommandDecision, { kind: 'conflict' }>,
): Response =>
  createSafeErrorResponse(requestId, {
    code: 'CONFLICT',
    details: {
      ...(decision.currentVersion === undefined
        ? {}
        : { currentVersion: decision.currentVersion }),
      conflict: decision.reason,
      recoveryAction:
        decision.reason === 'VERSION_MISMATCH'
          ? 'refetch_and_resubmit'
          : 'use_a_new_operation_key',
    },
    message:
      decision.reason === 'VERSION_MISMATCH'
        ? 'The resource changed; refresh before retrying.'
        : 'The operation key is already bound to different content.',
    status: 409,
  });

const deniedResponse = (
  requestId: RequestId,
  decision: Extract<ProtectedCommandDecision, { kind: 'denied' }>,
): Response => {
  switch (decision.reason) {
    case 'SESSION_EXPIRED':
    case 'UNAUTHENTICATED':
      return createSafeErrorResponse(requestId, {
        code: 'UNAUTHENTICATED',
        details: { recoveryAction: 'reauthenticate' },
        message: 'Authentication is required.',
        status: 401,
      });
    case 'STEP_UP_REQUIRED':
      return createSafeErrorResponse(requestId, {
        code: 'STEP_UP_REQUIRED',
        details: {
          allowedMethods: [...MFA_METHOD_REGISTRY],
          recoveryAction: 'step_up',
        },
        message: 'Recent step-up authentication is required.',
        status: 401,
      });
    case 'FOREIGN_AUTHORITY':
    case 'FORBIDDEN':
      return createSafeErrorResponse(requestId, {
        code: 'FORBIDDEN',
        details: { reasonCode: 'AUTHORITY_REQUIRED' },
        message: 'The requested operation is not authorized.',
        status: 403,
      });
    case 'NOT_FOUND':
      return createSafeErrorResponse(requestId, {
        code: 'NOT_FOUND',
        details: {},
        message: 'The requested resource is not available.',
        status: 404,
      });
    case 'AUDIT_REASON_REQUIRED':
      return createSafeErrorResponse(requestId, {
        code: 'INVALID_REQUEST',
        details: {
          violations: [
            {
              code: 'required',
              message: 'An audit reason is required.',
              path: '/reason',
            },
          ],
        },
        message: 'The protected command request is invalid.',
        status: 400,
      });
    case 'INVALID_REQUEST':
      return createSafeErrorResponse(requestId, {
        code: 'INVALID_REQUEST',
        details: {},
        message: 'The protected command request is invalid.',
        status: 400,
      });
  }
};

export const protectedDecisionResponse = (
  requestId: RequestId,
  decision: ProtectedCommandDecision,
): Response => {
  switch (decision.kind) {
    case 'committed':
    case 'replayed':
      return commandResultResponse(requestId, decision.result);
    case 'conflict':
      return conflictResponse(requestId, decision);
    case 'denied':
      return deniedResponse(requestId, decision);
    case 'dependency_error':
      return dependencyFailure(requestId);
  }
};
