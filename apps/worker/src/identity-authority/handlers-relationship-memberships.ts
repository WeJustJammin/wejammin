import {
  AcceptMembershipRequestSchema,
  EndMembershipRequestSchema,
  HistoricalMembershipAssertionRequestSchema,
  MembershipInvitationRequestSchema,
  MembershipTenurePathSchema,
  MembershipTenureResourceSchema,
  OrganizationPathSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  admitJsonMutationTransport,
  responseForAuthError,
} from '../authentication/boundary';
import {
  configureRelationshipRoute,
  enforceRelationshipRate,
  parseRelationshipCommandHeaders,
  decodeRelationshipBody,
  relationshipPathError,
  resolveRelationshipSession,
} from './relationship-handler-support';
import { executeRelationship } from './relationship-handler-runtime';
import type { RecoveryState } from './recovery';

export const inviteMembership = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureRelationshipRoute(context, 'MEM-01');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolveRelationshipSession(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  const path = OrganizationPathSchema.safeParse({
    organizationId: context.req.param('organizationId'),
  });
  if (!path.success)
    return responseForAuthError(
      context,
      relationshipPathError('organizationId'),
    );
  // BE00 step 6: strict body.
  const body = decodeRelationshipBody(
    transport.value,
    MembershipInvitationRequestSchema,
  );
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await enforceRelationshipRate(
    context,
    dependencies,
    'MEM-01',
    resolved.value,
  );
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseRelationshipCommandHeaders(context.req.raw, true);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    ...body.value,
    request: context.req.raw,
    session: resolved.value,
    organizationId: path.data.organizationId,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.inviteMembership;
  return executeRelationship(
    context,
    dependencies,
    state,
    'MEM-01',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch!,
      mutation: true,
      aggregateId: path.data.organizationId,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    MembershipTenureResourceSchema,
    201,
  );
};

export const assertMembership = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureRelationshipRoute(context, 'MEM-02');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolveRelationshipSession(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  const path = OrganizationPathSchema.safeParse({
    organizationId: context.req.param('organizationId'),
  });
  if (!path.success)
    return responseForAuthError(
      context,
      relationshipPathError('organizationId'),
    );
  // BE00 step 6: strict body.
  const body = decodeRelationshipBody(
    transport.value,
    HistoricalMembershipAssertionRequestSchema,
  );
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await enforceRelationshipRate(
    context,
    dependencies,
    'MEM-02',
    resolved.value,
  );
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseRelationshipCommandHeaders(context.req.raw, true);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    ...body.value,
    request: context.req.raw,
    session: resolved.value,
    organizationId: path.data.organizationId,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.assertMembership;
  return executeRelationship(
    context,
    dependencies,
    state,
    'MEM-02',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch!,
      mutation: true,
      aggregateId: path.data.organizationId,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    MembershipTenureResourceSchema,
    201,
  );
};

export const acceptMembership = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureRelationshipRoute(context, 'MEM-03');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolveRelationshipSession(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  const path = MembershipTenurePathSchema.safeParse({
    tenureId: context.req.param('tenureId'),
  });
  if (!path.success)
    return responseForAuthError(context, relationshipPathError('tenureId'));
  // BE00 step 6: strict body.
  const body = decodeRelationshipBody(
    transport.value,
    AcceptMembershipRequestSchema,
  );
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await enforceRelationshipRate(
    context,
    dependencies,
    'MEM-03',
    resolved.value,
  );
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseRelationshipCommandHeaders(context.req.raw, true);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    ...body.value,
    request: context.req.raw,
    session: resolved.value,
    tenureId: path.data.tenureId,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.acceptMembership;
  return executeRelationship(
    context,
    dependencies,
    state,
    'MEM-03',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch!,
      mutation: true,
      aggregateId: path.data.tenureId,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    MembershipTenureResourceSchema,
    200,
  );
};

export const endMembership = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
): Promise<Response> => {
  configureRelationshipRoute(context, 'MEM-04');
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitJsonMutationTransport(context.req.raw);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then acting context.
  const resolved = await resolveRelationshipSession(context, dependencies);
  if (!resolved.ok) return responseForAuthError(context, resolved);
  const path = MembershipTenurePathSchema.safeParse({
    tenureId: context.req.param('tenureId'),
  });
  if (!path.success)
    return responseForAuthError(context, relationshipPathError('tenureId'));
  // BE00 step 6: strict body.
  const body = decodeRelationshipBody(
    transport.value,
    EndMembershipRequestSchema,
  );
  if (!body.ok) return responseForAuthError(context, body);
  // BE00 step 7: quota.
  const limited = await enforceRelationshipRate(
    context,
    dependencies,
    'MEM-04',
    resolved.value,
  );
  if (limited !== null) return limited;
  // BE00 step 8: exact Idempotency-Key and quoted If-Match.
  const headers = parseRelationshipCommandHeaders(context.req.raw, true);
  if (!headers.ok) return responseForAuthError(context, headers);
  const input = {
    ...body.value,
    request: context.req.raw,
    session: resolved.value,
    tenureId: path.data.tenureId,
    idempotencyKey: headers.value.idempotencyKey,
    ifMatch: headers.value.ifMatch!,
  };
  const port = dependencies.identityAuthority?.endMembership;
  return executeRelationship(
    context,
    dependencies,
    state,
    'MEM-04',
    {
      session: resolved.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch!,
      mutation: true,
      aggregateId: path.data.tenureId,
    },
    port === undefined
      ? undefined
      : (signal) => port(input, context.env, signal),
    MembershipTenureResourceSchema,
    200,
  );
};
