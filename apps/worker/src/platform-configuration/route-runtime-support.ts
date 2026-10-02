import type { WorkerContext, WorkerDependencies } from '../index';
import { responseForAuthError } from '../authentication/boundary';
import { stepUpRequiredError } from '../authentication/step-up';
import type { AuthenticationSession } from '../authentication/types';
import { configurationResponseVersion } from './runtime-helpers';
import {
  enforceConfigurationRate,
  isConfigurationStepUpFresh,
  parseConfigurationPath,
  requireConfigurationSession,
} from './route-support';
import type {
  ConfigurationOutcome,
  PlatformConfigurationOperationId,
} from './types';

export const send = (
  context: WorkerContext,
  outcome: ConfigurationOutcome,
  operationId: PlatformConfigurationOperationId,
): Response => {
  if (!outcome.ok) {
    const response = responseForAuthError(context, outcome);
    context.res = response;
    return response;
  }
  context.header(
    'cache-control',
    operationId === 'CFG-05A-02' ? 'private, no-store' : 'no-store',
  );
  const version = configurationResponseVersion(outcome.value);
  if (version !== null) context.header('etag', `"${version}"`);
  const response = context.json(
    outcome.value as Record<string, unknown>,
    outcome.status,
  );
  context.res = response;
  return response;
};

export const sessionWithRate = async (
  context: WorkerContext,
  operationId: PlatformConfigurationOperationId,
  auth: WorkerDependencies['auth'],
  actingPartyRequired: boolean,
  requireFreshStepUp = false,
): Promise<
  | Readonly<{
      session: AuthenticationSession;
      rate: null;
    }>
  | Readonly<{
      session: null;
      rate: Response;
    }>
> => {
  const session = await requireConfigurationSession(
    context,
    auth,
    actingPartyRequired,
  );
  if (!session.ok)
    return { session: null, rate: responseForAuthError(context, session) };
  if (requireFreshStepUp && !isConfigurationStepUpFresh(session.value))
    return {
      session: null,
      rate: responseForAuthError(context, stepUpRequiredError()),
    };
  const rate = await enforceConfigurationRate(
    context,
    operationId,
    auth,
    session.value,
    null,
  );
  return rate === null
    ? { session: session.value, rate: null }
    : { session: null, rate };
};

export const parseRoutePath = <T>(
  schema: Parameters<typeof parseConfigurationPath<T>>[0],
  value: unknown,
) => parseConfigurationPath(schema, value);
