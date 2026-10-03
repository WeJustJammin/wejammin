import {
  Cfg05b04CapabilityActionRequestSchema,
  Cfg05b05AuditDiagnosticRequestSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext, WorkerDependencies } from '../index';
import { authError, responseForAuthError } from '../authentication/boundary';
import { stepUpRequiredError } from '../authentication/step-up';
import type { AuthenticationResult } from '../authentication/types';
import type { Cfg05b05AuditDiagnosticRequest } from '@wejammin/contracts';
import { registerAdminCapabilitySnapshotRoute } from './admin-capability-snapshot-route';
import { registerAdminMfaResetRoute } from './admin-mfa-reset-route';
import { createAdminWorkspacePortRunner } from './admin-runtime-port';
import {
  admitConfigurationTransport,
  checkConfigurationSameOrigin,
  enforceConfigurationRate,
  isConfigurationStepUpFresh,
  parseConfigurationCommandHeaders,
} from './route-support';
import type { AdminWorkspacePortInput } from './types';
import {
  admitSession,
  decodeAdminBody,
  parseQuery,
  requireAdminCapability,
  withDeadline,
} from './admin-route-admission';

const send = (
  context: WorkerContext,
  runner: ReturnType<typeof createAdminWorkspacePortRunner>,
  input: AdminWorkspacePortInput,
  outcome: AuthenticationResult<unknown>,
): Response => {
  if (!outcome.ok) return responseForAuthError(context, outcome);
  context.header(
    'cache-control',
    input.operationId === 'CFG-05B-01' ? 'private, no-store' : 'no-store',
  );
  const value = outcome.value as Readonly<Record<string, unknown>>;
  const version =
    typeof value.version === 'string' &&
    /^[1-9][0-9]{0,17}$/u.test(value.version)
      ? value.version
      : null;
  if (version !== null) context.header('etag', `"${version}"`);
  const response = context.json(value, runner.statusFor(input));
  context.res = response;
  return response;
};

export const createAdminWorkspaceRouteRuntime = (
  dependencies: WorkerDependencies,
) => {
  const runner = createAdminWorkspacePortRunner(dependencies);

  const inbox = async (context: WorkerContext): Promise<Response> => {
    const operationId = 'CFG-05B-01' as const;
    context.set('operation', operationId);
    return withDeadline(context, operationId, async (signal) => {
      // BE00 step 2: origin (a read has no body, CSRF or media).
      const origin = checkConfigurationSameOrigin(context);
      if (!origin.ok) return responseForAuthError(context, origin);
      // BE00 steps 4 and 5: verified session, then the acting context.
      const admitted = await admitSession(context, dependencies, signal);
      if ('response' in admitted) return admitted.response;
      // BE00 step 6: strict query.
      const query = await parseQuery(context.req.raw);
      if (!query.ok) return responseForAuthError(context, query);
      // BE00 step 7: capability, then quota.
      const denied = requireAdminCapability(
        context,
        operationId,
        admitted.requestContext,
      );
      if (denied !== null) return denied;
      const rate = await enforceConfigurationRate(
        context,
        operationId,
        dependencies.auth,
        admitted.session,
        null,
        signal,
      );
      if (rate !== null) return rate;
      const input: AdminWorkspacePortInput = {
        operationId,
        request: context.req.raw,
        query: query.value as Readonly<Record<string, unknown>>,
        session: admitted.session,
        requestContext: admitted.requestContext,
      };
      return send(
        context,
        runner,
        input,
        await runner.run(context, input, 'readInbox', signal),
      );
    });
  };

  const capabilityAction = async (
    context: WorkerContext,
  ): Promise<Response> => {
    const operationId = 'CFG-05B-04' as const;
    context.set('operation', operationId);
    return withDeadline(context, operationId, async (signal) => {
      // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
      const transport = await admitConfigurationTransport(context, signal);
      if (!transport.ok) return responseForAuthError(context, transport);
      // BE00 steps 4 and 5: verified session, then the acting context.
      const admitted = await admitSession(context, dependencies, signal);
      if ('response' in admitted) return admitted.response;
      // BE00 step 6: strict body.
      const body = decodeAdminBody(
        transport.value,
        Cfg05b04CapabilityActionRequestSchema,
      );
      if (!body.ok) return responseForAuthError(context, body);
      // BE00 step 7: capability, step-up freshness, then quota.
      const denied = requireAdminCapability(
        context,
        operationId,
        admitted.requestContext,
      );
      if (denied !== null) return denied;
      if (!isConfigurationStepUpFresh(admitted.session))
        return responseForAuthError(context, stepUpRequiredError());
      const rate = await enforceConfigurationRate(
        context,
        operationId,
        dependencies.auth,
        admitted.session,
        null,
        signal,
      );
      if (rate !== null) return rate;
      // BE00 step 8: exact Idempotency-Key and quoted If-Match.
      const headers = parseConfigurationCommandHeaders(context.req.raw);
      if (!headers.ok) return responseForAuthError(context, headers);
      const input: AdminWorkspacePortInput = {
        operationId,
        request: context.req.raw,
        body: body.value as Readonly<Record<string, unknown>>,
        session: admitted.session,
        requestContext: admitted.requestContext,
        idempotencyKey: headers.value.idempotencyKey,
        ...(headers.value.ifMatch === undefined
          ? {}
          : { ifMatch: headers.value.ifMatch }),
      };
      return send(
        context,
        runner,
        input,
        await runner.run(context, input, 'capabilityAction', signal),
      );
    });
  };

  const auditDiagnostic = async (context: WorkerContext): Promise<Response> => {
    const operationId = 'CFG-05B-05' as const;
    context.set('operation', operationId);
    return withDeadline(context, operationId, async (signal) => {
      // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
      const transport = await admitConfigurationTransport(context, signal);
      if (!transport.ok) return responseForAuthError(context, transport);
      // BE00 steps 4 and 5: verified session, then the acting context.
      const admitted = await admitSession(context, dependencies, signal);
      if ('response' in admitted) return admitted.response;
      // BE00 step 6: strict body.
      const body = decodeAdminBody(
        transport.value,
        Cfg05b05AuditDiagnosticRequestSchema,
      );
      if (!body.ok) return responseForAuthError(context, body);
      if (
        (body.value as Cfg05b05AuditDiagnosticRequest).action !== 'read_audit'
      )
        return responseForAuthError(
          context,
          authError(
            422,
            'INVALID_REQUEST',
            'Diagnostic runs are deferred from this route.',
          ),
        );
      // BE00 step 7: capability, then quota.
      const denied = requireAdminCapability(
        context,
        operationId,
        admitted.requestContext,
      );
      if (denied !== null) return denied;
      const rate = await enforceConfigurationRate(
        context,
        operationId,
        dependencies.auth,
        admitted.session,
        null,
        signal,
      );
      if (rate !== null) return rate;
      // BE00 step 8: exact Idempotency-Key and strong quoted If-Match.
      const headers = parseConfigurationCommandHeaders(context.req.raw, true);
      if (!headers.ok) return responseForAuthError(context, headers);
      const input: AdminWorkspacePortInput = {
        operationId,
        request: context.req.raw,
        body: body.value as Readonly<Record<string, unknown>>,
        session: admitted.session,
        requestContext: admitted.requestContext,
        idempotencyKey: headers.value.idempotencyKey,
        ifMatch: headers.value.ifMatch!,
      };
      return send(
        context,
        runner,
        input,
        await runner.run(context, input, 'auditDiagnostic', signal),
      );
    });
  };

  return { inbox, capabilityAction, auditDiagnostic };
};

export const registerAdminWorkspaceRoutes = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  const runtime = createAdminWorkspaceRouteRuntime(dependencies);
  app.get('/api/v1/admin/inbox', runtime.inbox);
  app.post('/api/v1/admin/capability-grants/actions', runtime.capabilityAction);
  app.post('/api/v1/admin/audit-diagnostics/actions', runtime.auditDiagnostic);
  registerAdminMfaResetRoute(app, dependencies);
  registerAdminCapabilitySnapshotRoute(app, dependencies);
};
