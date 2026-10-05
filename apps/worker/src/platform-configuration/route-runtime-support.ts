import type { WorkerContext, WorkerDependencies } from '../index';
import { responseForAuthError } from '../authentication/boundary';
import { stepUpRequiredError } from '../authentication/step-up';
import type { AuthenticationSession } from '../authentication/types';
import { configurationResponseVersion } from './runtime-helpers';
import {
  enforceConfigurationRate,
  isConfigurationStepUpFresh,
  parseConfigurationPath,
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

/**
 * BE00 step 7 for a human settings mutation: step-up freshness, then the
 * per-user and per-party quota. A refusal is the complete response.
 */
export const stepUpAndRate = async (
  context: WorkerContext,
  operationId: PlatformConfigurationOperationId,
  auth: WorkerDependencies['auth'],
  session: AuthenticationSession,
): Promise<Response | null> => {
  if (!isConfigurationStepUpFresh(session))
    return responseForAuthError(context, stepUpRequiredError());
  return enforceConfigurationRate(context, operationId, auth, session, null);
};

export const parseRoutePath = <T>(
  schema: Parameters<typeof parseConfigurationPath<T>>[0],
  value: unknown,
) => parseConfigurationPath(schema, value);
