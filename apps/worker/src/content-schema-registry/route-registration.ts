import type { FeatureApp, FeatureContext } from './route-types';
import { operations, routeIds } from './route-types';
import {
  humanBodySchemas,
  parseGrantListQuery,
  parseQuery,
  parseRequestPathId,
  rejectDetailQuery,
} from './admission';
import { errorResponse } from './route-response';
import type { RouteHandlers } from './route-handlers';
import type { ContentSchemaRegistryResult } from './types';

type PathIds = ContentSchemaRegistryResult<Readonly<Record<string, string>>>;

/** Parse every named UUID path parameter; the first malformed one is 400. */
const pathIdsFor =
  (names: readonly string[]) =>
  (context: FeatureContext): PathIds => {
    const values: Record<string, string> = {};
    for (const name of names) {
      const parsed = parseRequestPathId(context.req.param(name));
      if (!parsed.ok) return parsed;
      values[name] = parsed.value;
    }
    return { ok: true, value: values };
  };

const versionIds = pathIdsFor([routeIds.typeId, routeIds.versionId]);
const reviewIds = pathIdsFor([routeIds.reviewId]);
const grantIds = pathIdsFor([routeIds.grantId]);

const VERSIONS = '/api/v1/cms/content-types/:contentTypeId/versions/:versionId';
const REVIEWS = '/api/v1/cms/schema-reviews/:reviewId';
const GRANTS = '/api/v1/cms/capability-grants';

type HumanMutationOperation =
  | typeof operations.create
  | typeof operations.field
  | typeof operations.relation
  | typeof operations.activate
  | typeof operations.successor
  | typeof operations.dryRun
  | typeof operations.submitReview
  | typeof operations.decideReview
  | typeof operations.assignReview
  | typeof operations.grant
  | typeof operations.renewGrant
  | typeof operations.revokeGrant;

export const registerContentSchemaRegistryEndpoints = (
  app: FeatureApp,
  handlers: RouteHandlers,
): void => {
  const mutation = (
    path: string,
    operationId: HumanMutationOperation,
    parsePath?: (context: FeatureContext) => PathIds,
  ): void => {
    app.post(path, async (context) => {
      context.set('operationId', operationId);
      const ids = parsePath === undefined ? null : parsePath(context);
      if (ids !== null && !ids.ok)
        return errorResponse(context, ids, context.get('requestId'));
      return handlers.humanMutation(
        context,
        operationId,
        humanBodySchemas[operationId],
        ids === null ? {} : ids.value,
      );
    });
  };

  mutation('/api/v1/cms/content-types', operations.create);
  mutation(`${VERSIONS}/fields`, operations.field, versionIds);
  mutation(`${VERSIONS}/relations`, operations.relation, versionIds);
  mutation(`${VERSIONS}/activate`, operations.activate, versionIds);
  mutation(`${VERSIONS}/successors`, operations.successor, versionIds);
  mutation(`${VERSIONS}/dry-runs`, operations.dryRun, versionIds);
  mutation(`${VERSIONS}/reviews`, operations.submitReview, versionIds);
  mutation(`${REVIEWS}/decisions`, operations.decideReview, reviewIds);
  mutation(`${REVIEWS}/assignments`, operations.assignReview, reviewIds);
  mutation(GRANTS, operations.grant);
  mutation(`${GRANTS}/:grantId/renewals`, operations.renewGrant, grantIds);
  mutation(`${GRANTS}/:grantId/revocations`, operations.revokeGrant, grantIds);

  app.post('/api/v1/cms/blocks/versions', async (context) => {
    context.set('operationId', operations.register);
    return handlers.releaseMutation(context, operations.register);
  });
  app.get('/api/v1/cms/content-types', async (context) => {
    context.set('operationId', operations.list);
    const query = parseQuery(context.req.raw);
    if (!query.ok)
      return errorResponse(context, query, context.get('requestId'));
    return handlers.protectedRead(context, operations.list, {}, query.value);
  });
  app.get(VERSIONS, async (context) => {
    context.set('operationId', operations.detail);
    const queryError = rejectDetailQuery(context.req.raw);
    if (queryError !== null)
      return errorResponse(context, queryError, context.get('requestId'));
    const ids = versionIds(context);
    if (!ids.ok) return errorResponse(context, ids, context.get('requestId'));
    return handlers.protectedRead(context, operations.detail, ids.value);
  });
  app.get(REVIEWS, async (context) => {
    context.set('operationId', operations.readReview);
    const queryError = rejectDetailQuery(context.req.raw);
    if (queryError !== null)
      return errorResponse(context, queryError, context.get('requestId'));
    const ids = reviewIds(context);
    if (!ids.ok) return errorResponse(context, ids, context.get('requestId'));
    return handlers.protectedRead(context, operations.readReview, ids.value);
  });
  app.get(GRANTS, async (context) => {
    context.set('operationId', operations.listGrants);
    const query = parseGrantListQuery(context.req.raw);
    if (!query.ok)
      return errorResponse(context, query, context.get('requestId'));
    return handlers.protectedRead(
      context,
      operations.listGrants,
      {},
      query.value,
    );
  });
  app.post(
    '/api/v1/cms/blocks/versions/:blockDefinitionVersionId/lifecycle',
    async (context) => {
      context.set('operationId', operations.lifecycle);
      const blockId = parseRequestPathId(context.req.param(routeIds.blockId));
      if (!blockId.ok)
        return errorResponse(context, blockId, context.get('requestId'));
      return handlers.releaseMutation(context, operations.lifecycle, {
        blockDefinitionVersionId: blockId.value,
      });
    },
  );
};
