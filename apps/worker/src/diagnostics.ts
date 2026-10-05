import {
  ApiErrorSchema,
  DiagnosticResponseSchema,
  RequestContextSchema,
  type RequestContext,
  type JsonValue,
} from '@wejammin/contracts';

import { verifyReadOrigin } from './authentication/boundary';
import { MFA_METHOD_REGISTRY } from './authentication/step-up';
import type {
  DiagnosticAuditEvent,
  WorkerApp,
  WorkerContext,
  WorkerDependencies,
} from './index';

const DIAGNOSTICS_CAPABILITY = 'diagnostics.read' as const;

const diagnosticReasonFrom = (request: Request): string | null => {
  const reason = request.headers.get('x-diagnostic-reason');
  if (reason === null) return null;

  const normalized = reason.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 0x1f ||
        codePoint === 0x7f ||
        (codePoint >= 0x80 && codePoint <= 0x9f))
    );
  });
  const byteLength = new TextEncoder().encode(normalized).byteLength;
  return normalized.length >= 3 &&
    normalized.length <= 240 &&
    byteLength <= 240 &&
    !hasControlCharacter
    ? normalized
    : null;
};

const diagnosticAudit = async (
  dependencies: WorkerDependencies,
  event: DiagnosticAuditEvent,
): Promise<boolean> => {
  if (dependencies.auditDiagnosticAccess === undefined) return false;

  try {
    await dependencies.auditDiagnosticAccess(event);
    return true;
  } catch {
    return false;
  }
};

const diagnosticError = (
  context: WorkerContext,
  code:
    | 'DEPENDENCY_UNAVAILABLE'
    | 'FORBIDDEN'
    | 'INVALID_REQUEST'
    | 'STEP_UP_REQUIRED'
    | 'UNAUTHENTICATED',
  message: string,
  status: 400 | 401 | 403 | 503,
  details: Readonly<Record<string, JsonValue>>,
) => {
  context.set('errorCode', code);
  context.header('cache-control', 'no-store');
  if (code === 'DEPENDENCY_UNAVAILABLE' && status === 503) {
    context.header('retry-after', '5');
  }
  const payload = ApiErrorSchema.parse({
    code,
    details,
    message,
    requestId: context.get('requestId'),
  });
  return context.json(payload, status);
};

export const registerDiagnosticsRoute = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  app.get('/api/v1/internal/diagnostics', async (context) => {
    context.set('operation', 'diagnostics.read');
    const request = context.req.raw;
    // BE00 step 2: a read has no body or CSRF token; the origin is the gate.
    if (verifyReadOrigin(request) !== null) {
      return diagnosticError(
        context,
        'FORBIDDEN',
        'The request origin is not allowed.',
        403,
        {},
      );
    }
    const reason = diagnosticReasonFrom(request);
    let requestContext: RequestContext | null = null;
    if (dependencies.resolveRequestContext !== undefined) {
      try {
        const parsed = RequestContextSchema.safeParse(
          await dependencies.resolveRequestContext(request, context.env),
        );
        requestContext = parsed.success ? parsed.data : null;
      } catch {
        requestContext = null;
      }
    }

    const recordAudit = async (
      decision: DiagnosticAuditEvent['decision'],
      auditReason: string | null,
      actor: typeof requestContext,
    ): Promise<void> => {
      await diagnosticAudit(dependencies, {
        action: DIAGNOSTICS_CAPABILITY,
        actorId: actor?.userId ?? null,
        actingPartyId: actor?.actingPartyId ?? null,
        correlationId: context.get('correlationId'),
        decision,
        reason: auditReason,
        requestId: context.get('requestId'),
        target: 'worker-diagnostics',
      });
    };

    if (requestContext === null) {
      await recordAudit('deny', reason, null);
      return diagnosticError(
        context,
        'UNAUTHENTICATED',
        'Authentication is required.',
        401,
        { recoveryAction: 'reauthenticate' },
      );
    }

    // BE00 step 6: strict header validation precedes authorization (step 7).
    if (reason === null) {
      await recordAudit('deny', null, requestContext);
      return diagnosticError(
        context,
        'INVALID_REQUEST',
        'A diagnostic reason is required.',
        400,
        {
          violations: [
            {
              code: 'required',
              message: 'A diagnostic reason is required.',
              path: '/reason',
            },
          ],
        },
      );
    }

    let freshStepUp = false;
    if (dependencies.isStepUpFresh !== undefined) {
      try {
        freshStepUp = await dependencies.isStepUpFresh(
          requestContext,
          request,
          context.env,
        );
      } catch {
        freshStepUp = false;
      }
    }
    if (!freshStepUp) {
      await recordAudit('deny', reason, requestContext);
      return diagnosticError(
        context,
        'STEP_UP_REQUIRED',
        'Recent step-up authentication is required.',
        401,
        { allowedMethods: [...MFA_METHOD_REGISTRY], recoveryAction: 'step_up' },
      );
    }

    if (!requestContext.capabilities.includes(DIAGNOSTICS_CAPABILITY)) {
      await recordAudit('deny', reason, requestContext);
      return diagnosticError(
        context,
        'FORBIDDEN',
        'The named diagnostic capability is required.',
        403,
        { reasonCode: 'CAPABILITY_REQUIRED' },
      );
    }

    const authorizedAudit = await diagnosticAudit(dependencies, {
      action: DIAGNOSTICS_CAPABILITY,
      actorId: requestContext.userId,
      actingPartyId: requestContext.actingPartyId,
      correlationId: context.get('correlationId'),
      decision: 'allow',
      reason,
      requestId: context.get('requestId'),
      target: 'worker-diagnostics',
    });
    if (!authorizedAudit) {
      return diagnosticError(
        context,
        'DEPENDENCY_UNAVAILABLE',
        'Diagnostics are temporarily unavailable.',
        503,
        {
          dependencyClass: 'diagnostics',
          retryable: true,
          retryAfterSeconds: 5,
        },
      );
    }

    try {
      const checks =
        dependencies.composeDiagnostics === undefined
          ? [{ name: 'worker', status: 'ok' } as const]
          : await dependencies.composeDiagnostics(
              requestContext,
              request,
              context.env,
            );
      const payload = DiagnosticResponseSchema.parse({
        checkedAt: (dependencies.nowDate?.() ?? new Date()).toISOString(),
        checks,
        requestId: context.get('requestId'),
        state: checks.every((check) => check.status === 'ok')
          ? 'healthy'
          : 'degraded',
      });
      context.header('cache-control', 'no-store');
      return context.json(payload);
    } catch {
      return diagnosticError(
        context,
        'DEPENDENCY_UNAVAILABLE',
        'Diagnostics are temporarily unavailable.',
        503,
        {
          dependencyClass: 'diagnostics',
          retryable: true,
          retryAfterSeconds: 5,
        },
      );
    }
  });
};
