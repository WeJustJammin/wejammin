import type {
  CmsCapabilityGrantListQuery,
  ContentSchemaRegistryListQuery,
} from './contracts';
import {
  humanBodySchemas,
  parseJsonBody,
  parseMutationHeaders,
  rejectReadMutationHeadersOrBody,
  type ParsedHumanBody,
} from './admission';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryPortInput,
  HumanMutationOperationId,
  HumanReadOperationId,
} from './types';
import type { FeatureContext } from './route-types';
import { errorResponse } from './route-response';
import { createHumanAuthority } from './route-human-authority';
import type { RouteExecutor } from './route-execution';

export type HumanMutation = (
  context: FeatureContext,
  operationId: HumanMutationOperationId,
  bodySchema: (typeof humanBodySchemas)[HumanMutationOperationId],
  path?: Readonly<Record<string, string>>,
) => Promise<Response>;

export type ProtectedRead = (
  context: FeatureContext,
  operationId: HumanReadOperationId,
  path?: Readonly<Record<string, string>>,
  query?: ContentSchemaRegistryListQuery | CmsCapabilityGrantListQuery,
) => Promise<Response>;

export const createHumanHandlers = (
  dependencies: ContentSchemaRegistryDependencies,
  execute: RouteExecutor,
): Readonly<{ humanMutation: HumanMutation; protectedRead: ProtectedRead }> => {
  const authorize = createHumanAuthority(dependencies);

  const humanMutation: HumanMutation = async (
    context,
    operationId,
    bodySchema,
    path = {},
  ): Promise<Response> => {
    const requestId = context.get('requestId');
    const body = await parseJsonBody<ParsedHumanBody>(
      context.req.raw,
      bodySchema,
    );
    if (!body.ok) return errorResponse(context, body, requestId);
    const headers = parseMutationHeaders(context.req.raw, operationId);
    if (!headers.ok) return errorResponse(context, headers, requestId);
    const authority = await authorize(context, operationId);
    if (!authority.ok) return authority.response;
    return execute(context, operationId, 'human', {
      operationId,
      requestId,
      request: context.req.raw,
      session: authority.session,
      path,
      body: body.value as NonNullable<ContentSchemaRegistryPortInput['body']>,
      idempotencyKey: headers.value.idempotencyKey,
      ...(headers.value.ifMatch === undefined
        ? {}
        : { ifMatch: headers.value.ifMatch }),
    });
  };

  const protectedRead: ProtectedRead = async (
    context,
    operationId,
    path = {},
    query,
  ): Promise<Response> => {
    const requestId = context.get('requestId');
    const readHeaders = await rejectReadMutationHeadersOrBody(context.req.raw);
    if (readHeaders !== null)
      return errorResponse(context, readHeaders, requestId);
    const authority = await authorize(context, operationId);
    if (!authority.ok) return authority.response;
    return execute(context, operationId, 'human', {
      operationId,
      requestId,
      request: context.req.raw,
      session: authority.session,
      path,
      ...(query === undefined ? {} : { query }),
    });
  };

  return { humanMutation, protectedRead };
};
