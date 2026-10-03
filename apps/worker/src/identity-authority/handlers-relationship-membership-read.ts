import {
  MembershipCollectionSchema,
  OrganizationMembershipsPathSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import { responseForAuthError } from '../authentication/boundary';
import {
  configureRelationshipRoute,
  enforceRelationshipRate,
  rejectRelationshipQuery,
  resolveRelationshipSession,
} from './relationship-handler-support';
import { executeRelationship } from './relationship-handler-runtime';
import type { RecoveryState } from './recovery';

export const readMemberships = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureRelationshipRoute(context, 'MEM-06');
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolveRelationshipSession(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  // BE00 step 6: strict path and query.
  const path = OrganizationMembershipsPathSchema.safeParse({
    organizationId: context.req.param('organizationId'),
  });
  if (!path.success)
    return responseForAuthError(context, {
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'The resource identifier is invalid.',
      details: {
        violations: [
          {
            path: '/path/organizationId',
            code: 'path_invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    });
  const query = rejectRelationshipQuery(context.req.raw, true);
  if (!query.ok) return responseForAuthError(context, query);
  const limited = await enforceRelationshipRate(
    context,
    dependencies,
    'MEM-06',
    resolved.value,
  );
  if (limited !== null) return limited;
  const input = {
    request: context.req.raw,
    session: resolved.value,
    organizationId: path.data.organizationId,
    query: query.value,
  };
  const port = dependencies.identityAuthority?.readMemberships;
  return executeRelationship(
    context,
    dependencies,
    state,
    'MEM-06',
    {
      session: resolved.value,
      idempotencyKey: null,
      ifMatch: null,
      mutation: false,
      aggregateId: path.data.organizationId,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    MembershipCollectionSchema,
    200,
  );
};
