import {
  CmsPreviewRequestHeadersSchema,
  PreviewRequestSchema,
  PreviewTokenResourceSchema,
  cmsJsonEqual,
  type PreviewRequest,
  type PreviewTokenResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { registerWorkflowCommand } from './workflow-command';
import { noPreparation, policyFor } from './workflow-support';
import {
  CMS_EDITORIAL_PREVIEW_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialPreviewPortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_PREVIEW_OPERATION_ID);

/**
 * CMS-03B-08 mint a preview token. The token is derived and shown once: it is
 * a response-only value with no ETag and no Location, and it never reaches
 * telemetry. The If-Match operand is the entry version (E5); the preview scope
 * (assignee, reviewer assignee, publisher) is the database's.
 */
export const registerCmsEditorialPreviewRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowCommand<
    E,
    Record<never, never>,
    PreviewRequest,
    PreviewTokenResource,
    CmsEditorialPreviewPortInput,
    null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/previews',
    bodySchema: PreviewRequestSchema,
    headersSchema: CmsPreviewRequestHeadersSchema,
    path: () => ({ ok: true, value: {} }),
    agree: () => null,
    port: (ports) => ports.mintPreview,
    prepare: noPreparation,
    build: (base, _path, body) => ({
      operationId: CMS_EDITORIAL_PREVIEW_OPERATION_ID,
      ...base,
      body,
    }),
    resourceSchema: PreviewTokenResourceSchema,
    // The token binds the exact request; a binding the caller did not ask for
    // (or an already revoked token) is never published.
    accept: (token, _path, body) =>
      token.entryId === body.entryId &&
      token.revisionId === body.revisionId &&
      token.locale === body.locale &&
      token.audience === body.audience &&
      token.route === body.route &&
      !token.revoked &&
      cmsJsonEqual(token.versionSet, body.versionSet)
        ? { status: 201, etag: null, location: null, entryId: token.entryId }
        : null,
  });
