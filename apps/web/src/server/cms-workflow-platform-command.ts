import {
  cmsEditorialIfMatchEqualsExpectedVersion,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';

import {
  WORKFLOW_COMMAND_SPECS,
  type CmsWorkflowCommandOperationId,
  type CommandSpec,
  verifyCommandSuccess,
} from '../components/cms-editorial-workflow/cms-workflow-command-specs';
import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import { CMS_EDITORIAL_DETAIL_POLICIES } from './cms-editorial-platform-error-details';
import {
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialLocalError,
  cmsEditorialMismatchError,
  cmsEditorialValidationError,
} from './cms-editorial-platform-shared';
import {
  admitCmsEditorialWrite,
  cmsEditorialCsrfToken,
  cmsEditorialJsonMedia,
  cmsEditorialUnverifiedSuccess,
  dispatchCmsEditorialWrite,
  relayCmsEditorialWriteFailure,
} from './cms-editorial-platform-write';
import { projectCmsWorkflowErrorDetails } from './cms-workflow-platform-errors';

/**
 * Server-only first-party proxy for the six Slice 11 browser commands:
 * CMS-03B-05 submit, -06 decision, -07 schedule, -08 preview, -09 publish and
 * -18 reviewer assignment. One admission kit serves all six, driven by the
 * generated route registry (path, status, error table) and the generated
 * request, header and resource schemas, so the web boundary cannot drift from
 * the Worker.
 *
 * The proxy owns transport hygiene only: same-origin, the CSRF double submit, a
 * bounded printable `Idempotency-Key`, an exact strong `If-Match`, JSON media
 * and a locally validated strict body. It never mints or rewrites a key, a
 * version or an authority value; the Worker re-derives all of them. A 2xx it
 * cannot verify is an unknown outcome, so the browser keeps its key and replays
 * the identical request (BE03b:1427).
 */

export type { CmsWorkflowCommandOperationId };

export type CmsWorkflowCommandParams = Readonly<{
  entryId?: string | undefined;
  reviewId?: string | undefined;
}>;

const rowOf = (operationId: CmsWorkflowCommandOperationId) => {
  const row = cmsEditorialRoutePolicies.find(
    (candidate) => candidate.operationId === operationId,
  );
  /* v8 ignore next -- registry parity is asserted by the route test */
  if (row === undefined) throw new Error(`unregistered ${operationId}`);
  return row;
};

const routeFor = (
  template: string,
  path: Readonly<Record<string, string>>,
): string =>
  template.replace(/\{(\w+)\}/gu, (_, name: string) => path[name] as string);

const forward = async <TPath extends Record<string, string>, TBody, TResource>(
  spec: CommandSpec<TPath, TBody, TResource>,
  request: Request,
  params: CmsWorkflowCommandParams,
  binding: unknown,
): Promise<Response> => {
  const admitted = admitCmsEditorialWrite(request, binding);
  if (admitted instanceof Response) return admitted;

  const path = spec.pathSchema.safeParse(params);
  if (!path.success)
    return cmsEditorialValidationError(request, 400, path.error.issues);
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);
  const csrfToken = cmsEditorialCsrfToken(request);
  if (csrfToken instanceof Response) return csrfToken;
  const media = cmsEditorialJsonMedia(request);
  if (media instanceof Response) return media;
  const headers = spec.headersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success)
    return cmsEditorialValidationError(request, 400, headers.error.issues);

  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = spec.requestSchema.safeParse(body.value);
  if (!parsed.success)
    return cmsEditorialValidationError(request, 422, parsed.error.issues);
  const mismatched = spec.mismatchedId(path.data, parsed.data);
  if (mismatched !== null)
    return cmsEditorialMismatchError(request, mismatched);
  const expectedVersion = spec.expectedVersion(parsed.data);
  if (
    expectedVersion !== null &&
    !cmsEditorialIfMatchEqualsExpectedVersion(
      headers.data.ifMatch,
      expectedVersion,
    )
  )
    return cmsEditorialLocalError(request, 400, undefined, undefined, {
      violations: [
        {
          path: '/expectedVersion',
          code: 'mismatch',
          message: 'The value is invalid.',
        },
      ],
    });

  const row = rowOf(spec.operationId);
  const route = routeFor(row.path, path.data);
  const forwardedHeaders = cmsEditorialForwardHeaders(request);
  forwardedHeaders.set('content-type', 'application/json');
  forwardedHeaders.set('x-csrf-token', csrfToken);
  forwardedHeaders.set('idempotency-key', headers.data.idempotencyKey);
  forwardedHeaders.set('if-match', headers.data.ifMatch);

  const sent = await dispatchCmsEditorialWrite(
    request,
    admitted.binding,
    route,
    forwardedHeaders,
    JSON.stringify(parsed.data),
  );
  if (sent instanceof Response) return sent;
  const { upstream } = sent;
  if (!upstream.ok)
    return relayCmsEditorialWriteFailure(
      request,
      upstream,
      row.errors,
      CMS_EDITORIAL_DETAIL_POLICIES.read,
      (status, code, details) =>
        projectCmsWorkflowErrorDetails(spec.operationId, status, code, details),
    );

  const answer = await cmsEditorialBoundedResponseJson(upstream);
  if (!answer.ok) return cmsEditorialUnverifiedSuccess(request);
  const committed = verifyCommandSuccess(spec, path.data, parsed.data, {
    status: upstream.status,
    json: answer.value,
    etag: upstream.headers.get('etag'),
    location: upstream.headers.get('location'),
  });
  if (committed === null) return cmsEditorialUnverifiedSuccess(request);
  const etag = spec.etag(committed);
  const location = spec.location(path.data, parsed.data, committed);

  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  // A validator or Location the policy does not declare is never relayed.
  if (etag === null) responseHeaders.delete('etag');
  if (location === null) responseHeaders.delete('location');
  return new Response(JSON.stringify(committed), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};

const FORWARDERS: Readonly<
  Record<
    CmsWorkflowCommandOperationId,
    (
      request: Request,
      params: CmsWorkflowCommandParams,
      binding: unknown,
    ) => Promise<Response>
  >
> = {
  'CMS-03B-05': (request, params, binding) =>
    forward(WORKFLOW_COMMAND_SPECS['CMS-03B-05'], request, params, binding),
  'CMS-03B-06': (request, params, binding) =>
    forward(WORKFLOW_COMMAND_SPECS['CMS-03B-06'], request, params, binding),
  'CMS-03B-07': (request, params, binding) =>
    forward(WORKFLOW_COMMAND_SPECS['CMS-03B-07'], request, params, binding),
  'CMS-03B-08': (request, params, binding) =>
    forward(WORKFLOW_COMMAND_SPECS['CMS-03B-08'], request, params, binding),
  'CMS-03B-09': (request, params, binding) =>
    forward(WORKFLOW_COMMAND_SPECS['CMS-03B-09'], request, params, binding),
  'CMS-03B-18': (request, params, binding) =>
    forward(WORKFLOW_COMMAND_SPECS['CMS-03B-18'], request, params, binding),
};

/** Browser-facing transport for a Slice 11 command; the Worker owns authorization. */
export const forwardCmsWorkflowCommand = (
  operationId: CmsWorkflowCommandOperationId,
  request: Request,
  params: CmsWorkflowCommandParams,
  binding: unknown,
): Promise<Response> => FORWARDERS[operationId](request, params, binding);
