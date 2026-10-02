import {
  Cfg05b07CapabilitySnapshotResponseSchema,
  type Cfg05b07CapabilitySnapshotResponse,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext, WorkerDependencies } from '../index';
import { authError, responseForAuthError } from '../authentication/boundary';
import { admit, withDeadline } from './admin-route-admission';
import {
  checkConfigurationSameOrigin,
  enforceConfigurationRate,
} from './route-support';

const OPERATION_ID = 'CFG-05B-07';

/**
 * Only names inside the published `admin.*` and `settings.*` namespaces
 * leave the Worker, and only after contract validation. Capabilities that do
 * not parse (including every other domain capability) are dropped, never
 * echoed.
 */
const adminCapabilities = (
  capabilities: readonly string[],
): Cfg05b07CapabilitySnapshotResponse => {
  const named = [...new Set(capabilities)].filter(
    (capability) =>
      capability.startsWith('admin.') || capability.startsWith('settings.'),
  );
  const parsed = Cfg05b07CapabilitySnapshotResponseSchema.safeParse({
    capabilities: named.slice(0, 32),
  });
  return parsed.success ? parsed.data : { capabilities: [] };
};

/**
 * CFG-05B-07: the acting-party-bound `admin.*`/`settings.*` capability snapshot for the
 * verified session. Authority is the same server-derived request context every
 * admin route admits on; the route accepts no input and adds no new authority.
 */
export const createAdminCapabilitySnapshotRoute =
  (dependencies: WorkerDependencies) =>
  async (context: WorkerContext): Promise<Response> => {
    context.set('operation', OPERATION_ID);
    return withDeadline(context, OPERATION_ID, async (signal) => {
      const origin = checkConfigurationSameOrigin(context);
      if (!origin.ok) return responseForAuthError(context, origin);
      if (new URL(context.req.url).search !== '')
        return responseForAuthError(
          context,
          authError(
            400,
            'INVALID_REQUEST',
            'The query parameters are invalid.',
          ),
        );
      const admitted = await admit(context, dependencies, OPERATION_ID, signal);
      if ('response' in admitted) return admitted.response;
      const rate = await enforceConfigurationRate(
        context,
        OPERATION_ID,
        dependencies.auth,
        admitted.session,
        null,
        signal,
      );
      if (rate !== null) return rate;
      context.header('cache-control', 'no-store');
      const response = context.json(
        adminCapabilities(admitted.requestContext.capabilities),
        200,
      );
      context.res = response;
      return response;
    });
  };

export const registerAdminCapabilitySnapshotRoute = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  app.get(
    '/api/v1/admin/capability-snapshot',
    createAdminCapabilitySnapshotRoute(dependencies),
  );
};
