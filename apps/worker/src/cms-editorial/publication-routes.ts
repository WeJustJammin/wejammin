import {
  CmsPublicationRequestHeadersSchema,
  PublicationRequestSchema,
  PublicationResourceSchema,
  type PreflightEvidence,
  type PublicationRequest,
  type PublicationResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { registerWorkflowCommand } from './workflow-command';
import { accessibilityEvidence, policyFor } from './workflow-support';
import {
  CMS_EDITORIAL_PUBLISH_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialPublishPortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_PUBLISH_OPERATION_ID);

/**
 * CMS-03B-09 publish immediately. The lineage row is committed synchronously
 * and answered `202` with `projectionState`; that is never proof of public
 * visibility. The publish-phase accessibility proof is produced here.
 */
export const registerCmsEditorialPublicationRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowCommand<
    E,
    Record<never, never>,
    PublicationRequest,
    PublicationResource,
    CmsEditorialPublishPortInput,
    PreflightEvidence | null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/publications',
    bodySchema: PublicationRequestSchema,
    headersSchema: CmsPublicationRequestHeadersSchema,
    path: () => ({ ok: true, value: {} }),
    agree: () => null,
    expectedVersion: (body) => body.expectedVersion,
    port: (ports) => ports.publishRevision,
    prepare: (context) =>
      accessibilityEvidence(context, {
        phase: 'publish',
        entryId: context.body.entryId,
        revisionId: context.body.revisionId,
      }),
    build: (base, _path, body, evidence) => ({
      operationId: CMS_EDITORIAL_PUBLISH_OPERATION_ID,
      ...base,
      body,
      evidence,
    }),
    resourceSchema: PublicationResourceSchema,
    accept: (publication, _path, body) =>
      publication.entryId === body.entryId &&
      publication.revisionId === body.revisionId &&
      publication.audience === body.audience &&
      publication.action === 'publish'
        ? {
            status: 202,
            etag: `"${publication.version}"`,
            location: `/api/v1/cms/publications/${publication.id}`,
            entryId: publication.entryId,
          }
        : null,
  });
