import type { Context } from 'hono';
import { Hono } from 'hono';

import type { ContentSchemaRegistryOperationId } from './types';

export type FeatureVariables = Readonly<{
  requestId: string;
  operationId: ContentSchemaRegistryOperationId;
}>;
export type FeatureApp = Hono<{ Variables: FeatureVariables }>;
export type FeatureContext = Context<{ Variables: FeatureVariables }>;

export const routeIds = {
  typeId: 'contentTypeId',
  versionId: 'versionId',
  blockId: 'blockDefinitionVersionId',
  reviewId: 'reviewId',
  grantId: 'grantId',
} as const;

export const operations = {
  create: 'CMS-03A-01',
  field: 'CMS-03A-02',
  relation: 'CMS-03A-03',
  activate: 'CMS-03A-04',
  register: 'CMS-03A-05',
  list: 'CMS-03A-06',
  detail: 'CMS-03A-07',
  lifecycle: 'CMS-03A-08',
  successor: 'CMS-03A-09',
  dryRun: 'CMS-03A-10',
  submitReview: 'CMS-03A-11',
  decideReview: 'CMS-03A-12',
  readReview: 'CMS-03A-13',
  assignReview: 'CMS-03A-14',
  grant: 'CMS-03A-15',
  renewGrant: 'CMS-03A-16',
  revokeGrant: 'CMS-03A-17',
  listGrants: 'CMS-03A-18',
} as const;

/** Protected reads: no body, no mutation headers, no ETag or Location. */
export const readOperationIds: ReadonlySet<ContentSchemaRegistryOperationId> =
  new Set(['CMS-03A-06', 'CMS-03A-07', 'CMS-03A-13', 'CMS-03A-18']);

export const statusFor: Readonly<
  Record<ContentSchemaRegistryOperationId, number>
> = {
  'CMS-03A-01': 201,
  'CMS-03A-02': 201,
  'CMS-03A-03': 201,
  'CMS-03A-04': 202,
  'CMS-03A-05': 201,
  'CMS-03A-06': 200,
  'CMS-03A-07': 200,
  'CMS-03A-08': 201,
  'CMS-03A-09': 201,
  'CMS-03A-10': 202,
  'CMS-03A-11': 201,
  'CMS-03A-12': 201,
  'CMS-03A-13': 200,
  // 14 answers 201 for a created assignment and 200 for a revoked one.
  'CMS-03A-14': 201,
  'CMS-03A-15': 201,
  'CMS-03A-16': 200,
  'CMS-03A-17': 200,
  'CMS-03A-18': 200,
};
