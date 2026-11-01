import type {
  EditorialDecisionRequestSchema,
  EditorialReviewAssignmentRequestSchema,
  EditorialReviewAssignmentResourceSchema,
  EditorialReviewResourceSchema,
  PreviewRequestSchema,
  PreviewTokenResourceSchema,
  PublicationRequestSchema,
  PublicationResourceSchema,
  PublicationScheduleRequestSchema,
  PublicationScheduleResourceSchema,
  ReviewSubmissionRequestSchema,
} from '@wejammin/contracts';
import {
  cmsJsonEqual,
  reviewAssignmentSuccessStatus,
} from '@wejammin/contracts/client';
import type { z } from 'zod';

import type { CmsValidators } from '../../lib/cms-contract-validators';

/**
 * The six Slice 11 browser commands as one table (CMS-03B-05 submit, -06
 * decision, -07 schedule, -08 preview, -09 publish, -18 assignment): the
 * identity a committed resource must be bound to, the validator and Location it
 * must carry, and (through `schemas`) the generated request, header and
 * resource schemas.
 *
 * The table is zod-free so a form can hold a spec at hydration. `schemas` reads
 * the generated schemas from the lazily loaded validators
 * (`lib/cms-contract-validators.ts`), which the transport and the form checks
 * load on first need; nothing here imports a schema as a value.
 */

export type CmsWorkflowCommandOperationId =
  | 'CMS-03B-05'
  | 'CMS-03B-06'
  | 'CMS-03B-07'
  | 'CMS-03B-08'
  | 'CMS-03B-09'
  | 'CMS-03B-18';

export interface CommandHeaders {
  readonly idempotencyKey: string;
  readonly ifMatch: string;
}

/** The strict generated schemas of one command. */
export interface CommandSchemas<TPath, TBody, TResource> {
  readonly pathSchema: z.ZodType<TPath>;
  readonly requestSchema: z.ZodType<TBody>;
  readonly headersSchema: z.ZodType<CommandHeaders>;
  readonly resourceSchema: z.ZodType<TResource>;
}

export interface CommandSpec<TPath, TBody, TResource> {
  readonly operationId: CmsWorkflowCommandOperationId;
  /** The generated schemas, read from the lazily loaded validators. */
  readonly schemas: (
    validators: CmsValidators,
  ) => CommandSchemas<TPath, TBody, TResource>;
  /** The body member the strong `If-Match` must equal, or null for a free operand. */
  readonly expectedVersion: (body: TBody) => string | null;
  /** The first path/body identifier that disagrees, or null. */
  readonly mismatchedId: (path: TPath, body: TBody) => string | null;
  readonly successStatus: (body: TBody) => 200 | 201 | 202;
  /** True when the committed resource names exactly the identity that was asked for. */
  readonly bound: (path: TPath, body: TBody, resource: TResource) => boolean;
  readonly etag: (resource: TResource) => string | null;
  readonly location: (
    path: TPath,
    body: TBody,
    resource: TResource,
  ) => string | null;
}

const noMismatch = (): null => null;
const quoted = (version: string): string => `"${version}"`;

const SUBMIT: CommandSpec<
  { entryId: string },
  z.infer<typeof ReviewSubmissionRequestSchema>,
  z.infer<typeof EditorialReviewResourceSchema>
> = {
  operationId: 'CMS-03B-05',
  schemas: (validators) => ({
    pathSchema: validators.CmsEditorialReviewSubmissionPathParamsSchema,
    requestSchema: validators.ReviewSubmissionRequestSchema,
    headersSchema: validators.CmsEditorialReviewSubmissionHeadersSchema,
    resourceSchema: validators.EditorialReviewResourceSchema,
  }),
  expectedVersion: () => null,
  mismatchedId: (path, body) =>
    path.entryId === body.entryId ? null : 'entryId',
  successStatus: () => 201,
  bound: (path, body, review) =>
    review.entryId === path.entryId &&
    review.revisionId === body.revisionId &&
    review.frozenHash === body.frozenHash &&
    review.state === 'open',
  etag: (review) => quoted(review.version),
  location: (_path, _body, review) => `/api/v1/cms/reviews/${review.id}`,
};

const DECIDE: CommandSpec<
  { reviewId: string },
  z.infer<typeof EditorialDecisionRequestSchema>,
  z.infer<typeof EditorialReviewResourceSchema>
> = {
  operationId: 'CMS-03B-06',
  schemas: (validators) => ({
    pathSchema: validators.CmsEditorialDecisionPathParamsSchema,
    requestSchema: validators.EditorialDecisionRequestSchema,
    headersSchema: validators.CmsEditorialDecisionHeadersSchema,
    resourceSchema: validators.EditorialReviewResourceSchema,
  }),
  expectedVersion: (body) => body.expectedVersion,
  mismatchedId: (path, body) =>
    path.reviewId === body.reviewId ? null : 'reviewId',
  successStatus: () => 200,
  bound: (path, _body, review) => review.id === path.reviewId,
  etag: (review) => quoted(review.version),
  location: () => null,
};

const SCHEDULE: CommandSpec<
  Record<string, never>,
  z.infer<typeof PublicationScheduleRequestSchema>,
  z.infer<typeof PublicationScheduleResourceSchema>
> = {
  operationId: 'CMS-03B-07',
  schemas: (validators) => ({
    pathSchema: validators.CmsPublicationSchedulePathParamsSchema,
    requestSchema: validators.PublicationScheduleRequestSchema,
    headersSchema: validators.CmsPublicationScheduleHeadersSchema,
    resourceSchema: validators.PublicationScheduleResourceSchema,
  }),
  expectedVersion: (body) => body.expectedVersion,
  mismatchedId: noMismatch,
  successStatus: () => 202,
  bound: (_path, body, schedule) =>
    schedule.revisionId === body.revisionId &&
    schedule.action === body.action &&
    schedule.audience === body.audience &&
    schedule.localDateTime === body.localDateTime &&
    schedule.timezone === body.timezone &&
    schedule.resolvedUtc === body.resolvedUtc &&
    schedule.tzdbVersion === body.tzdbVersion &&
    schedule.disambiguation === body.disambiguation,
  etag: (schedule) => quoted(schedule.version),
  location: (_path, _body, schedule) =>
    `/api/v1/cms/publication-schedules/${schedule.id}`,
};

const PREVIEW: CommandSpec<
  Record<string, never>,
  z.infer<typeof PreviewRequestSchema>,
  z.infer<typeof PreviewTokenResourceSchema>
> = {
  operationId: 'CMS-03B-08',
  schemas: (validators) => ({
    pathSchema: validators.CmsPublicationSchedulePathParamsSchema,
    requestSchema: validators.PreviewRequestSchema,
    headersSchema: validators.CmsPreviewRequestHeadersSchema,
    resourceSchema: validators.PreviewTokenResourceSchema,
  }),
  expectedVersion: () => null,
  mismatchedId: noMismatch,
  successStatus: () => 201,
  bound: (_path, body, token) =>
    token.entryId === body.entryId &&
    token.revisionId === body.revisionId &&
    token.locale === body.locale &&
    token.audience === body.audience &&
    token.route === body.route &&
    cmsJsonEqual(token.versionSet, body.versionSet),
  // The token is derived and never stored: no public validator, no Location.
  etag: () => null,
  location: () => null,
};

const PUBLISH: CommandSpec<
  Record<string, never>,
  z.infer<typeof PublicationRequestSchema>,
  z.infer<typeof PublicationResourceSchema>
> = {
  operationId: 'CMS-03B-09',
  schemas: (validators) => ({
    pathSchema: validators.CmsPublicationSchedulePathParamsSchema,
    requestSchema: validators.PublicationRequestSchema,
    headersSchema: validators.CmsPublicationRequestHeadersSchema,
    resourceSchema: validators.PublicationResourceSchema,
  }),
  expectedVersion: (body) => body.expectedVersion,
  mismatchedId: noMismatch,
  successStatus: () => 202,
  bound: (_path, body, publication) =>
    publication.entryId === body.entryId &&
    publication.revisionId === body.revisionId &&
    publication.audience === body.audience &&
    publication.action === 'publish',
  etag: (publication) => quoted(publication.version),
  location: (_path, _body, publication) =>
    `/api/v1/cms/publications/${publication.id}`,
};

const ASSIGN: CommandSpec<
  { reviewId: string },
  z.infer<typeof EditorialReviewAssignmentRequestSchema>,
  z.infer<typeof EditorialReviewAssignmentResourceSchema>
> = {
  operationId: 'CMS-03B-18',
  schemas: (validators) => ({
    pathSchema: validators.EditorialReviewAssignmentPathParamsSchema,
    requestSchema: validators.EditorialReviewAssignmentRequestSchema,
    headersSchema: validators.CmsEditorialReviewAssignmentHeadersSchema,
    resourceSchema: validators.EditorialReviewAssignmentResourceSchema,
  }),
  expectedVersion: (body) => body.expectedVersion,
  mismatchedId: noMismatch,
  successStatus: (body) => reviewAssignmentSuccessStatus(body.action),
  bound: (path, body, assignment) =>
    assignment.reviewId === path.reviewId &&
    (body.action === 'create'
      ? assignment.state === 'active'
      : assignment.state === 'revoked' && assignment.id === body.assignmentId),
  etag: (assignment) => quoted(assignment.version),
  location: (path, body, assignment) =>
    body.action === 'create'
      ? `/api/v1/cms/reviews/${path.reviewId}/assignments/${assignment.id}`
      : null,
};

/** What a command answered, reduced to the facts a success is verified by. */
export interface CommandAnswer {
  readonly status: number;
  readonly json: unknown;
  readonly etag: string | null;
  readonly location: string | null;
}

/**
 * The strict committed resource of a success, or null. A success is only a
 * success when its status is the one the request promises, its body is the
 * strict resource bound to the identity that was asked for, and it carries the
 * validator and Location the registry declares (BE03b:1427: anything else is an
 * unknown outcome, never a guessed success).
 */
export const verifyCommandSuccess = <TPath, TBody, TResource>(
  spec: CommandSpec<TPath, TBody, TResource>,
  validators: CmsValidators,
  path: TPath,
  body: TBody,
  answer: CommandAnswer,
): TResource | null => {
  if (answer.status !== spec.successStatus(body)) return null;
  const resource = spec
    .schemas(validators)
    .resourceSchema.safeParse(answer.json);
  if (!resource.success || !spec.bound(path, body, resource.data)) return null;
  const etag = spec.etag(resource.data);
  const location = spec.location(path, body, resource.data);
  if (etag !== null && answer.etag !== etag) return null;
  if (location !== null && answer.location !== location) return null;
  return resource.data;
};

/** The spec of every Slice 11 command, by operation id. */
export const WORKFLOW_COMMAND_SPECS = {
  'CMS-03B-05': SUBMIT,
  'CMS-03B-06': DECIDE,
  'CMS-03B-07': SCHEDULE,
  'CMS-03B-08': PREVIEW,
  'CMS-03B-09': PUBLISH,
  'CMS-03B-18': ASSIGN,
} as const;
