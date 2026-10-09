import {
  ReviewQueuePageSchema,
  ReviewQueueQuerySchema,
  type ReviewQueuePage,
  type ReviewQueueQuery,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { invalid, issues } from './admission-common';
import { registerWorkflowRead } from './workflow-read';
import { closedQuery, noPreparation, policyFor } from './workflow-support';
import {
  CMS_EDITORIAL_REVIEW_QUEUE_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialReviewQueuePortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_REVIEW_QUEUE_OPERATION_ID);
const QUERY_KEYS: ReadonlySet<string> = new Set([
  'cursor',
  'limit',
  'scope',
  'state',
]);
const LIMIT = /^[1-9][0-9]?$/u;
const MAX_PAGE = 50;
const MAX_CURSOR = 512;

const malformed = (key: string) =>
  invalid('The review queue query is invalid.', {
    violations: [
      {
        path: `/${key}`,
        code: 'invalid_value',
        message: 'The value is invalid.',
      },
    ],
  });

/**
 * CMS-03B-17 reviewer queue. The queue is the caller's own assigned or
 * submitted reviews: the database derives the scope and signs the next cursor,
 * and a structurally malformed cursor or limit is a 400 before any dependency.
 */
export const registerCmsEditorialReviewQueueRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowRead<
    E,
    Record<never, never>,
    ReviewQueueQuery,
    ReviewQueuePage,
    CmsEditorialReviewQueuePortInput,
    null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/reviews',
    path: () => ({ ok: true, value: {} }),
    query: (request) => {
      const members = closedQuery(request, QUERY_KEYS);
      if (!members.ok) return members;
      const { cursor, limit, ...rest } = members.value;
      if (cursor !== undefined && (cursor === '' || cursor.length > MAX_CURSOR))
        return malformed('cursor');
      if (
        limit !== undefined &&
        (!LIMIT.test(limit) || Number(limit) > MAX_PAGE)
      )
        return malformed('limit');
      const parsed = ReviewQueueQuerySchema.safeParse({
        ...rest,
        ...(cursor === undefined ? {} : { cursor }),
        ...(limit === undefined ? {} : { limit: Number(limit) }),
      });
      return parsed.success
        ? { ok: true, value: parsed.data }
        : invalid(
            'The review queue query failed validation.',
            issues(parsed.error),
          );
    },
    port: (ports) => ports.listEditorialReviews,
    prepare: noPreparation,
    build: (base, _path, query) => ({
      operationId: CMS_EDITORIAL_REVIEW_QUEUE_OPERATION_ID,
      ...base,
      query,
    }),
    resourceSchema: ReviewQueuePageSchema,
    // The page honours the request: at most `limit` rows, only the asked state,
    // and an assignment end only for the assigned scope.
    accept: async (page, _path, query) =>
      page.nextCursor !== '' &&
      page.items.length <= query.limit &&
      page.items.every(
        (item) =>
          (query.state === undefined || item.state === query.state) &&
          (query.scope === 'assigned' || item.assignmentEndsAt === null),
      )
        ? {
            etag: `"${page.pageVersion}"`,
            entryId: null,
            counts: { items_returned: page.items.length },
          }
        : null,
  });
