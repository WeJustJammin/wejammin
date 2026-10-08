import { executeCmsEditorialEntryCreate } from './cms-editorial-entry-create-transport';

/**
 * Shared fixtures for the CMS-03B-10 create-transport suites: one canonical
 * request and resource, the JSON response builder with the no-store and strong
 * ETag headers a verified create carries, a typed `ApiError` body, and the
 * `submit` driver that runs the transport with an injected fetcher. A test
 * derives its refused variants from these so each names the one member it
 * breaks.
 */

export const CONTENT_TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const CONTENT_TYPE_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
export const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
export const HASH = 'a'.repeat(64);
export const INSTANT = '2026-09-26T12:00:00+00:00';
export const PATH = '/api/v1/cms/entries';

export const workflowPolicy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: HASH,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: HASH,
};

export const createRequest = () => ({
  contentTypeId: CONTENT_TYPE_ID,
  contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
  locale: 'en-US',
  changedPaths: ['/fields/' + CONTENT_TYPE_VERSION_ID],
  values: { [CONTENT_TYPE_VERSION_ID]: { title: 'Hello' } },
  schemaArtifact: {
    id: CONTENT_TYPE_ID,
    contentTypeVersionId: CONTENT_TYPE_VERSION_ID,
    artifactHash: HASH,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy,
  activationEvidence: workflowPolicy,
});

export const createResource = () => ({
  entry: { id: ENTRY_ID, version: '1', createdAt: INSTANT, updatedAt: INSTANT },
  revision: {
    id: REVISION_ID,
    version: '1',
    createdAt: INSTANT,
    updatedAt: INSTANT,
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: HASH,
  validationState: 'valid',
});

export const jsonResponse = (
  status: number,
  body: unknown,
  headers?: HeadersInit,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      etag: '"1"',
      ...(headers ?? {}),
    },
  });

export const apiError = (code: string) => ({
  code,
  message: 'Safe message',
  requestId: REQUEST_ID,
  details: {},
});

export const submit = (
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  overrides: {
    readonly request?: unknown;
    readonly csrfToken?: string;
    readonly idempotencyKey?: string;
    readonly createIdempotencyKey?: () => string;
  } = {},
) =>
  executeCmsEditorialEntryCreate({
    path: PATH,
    request: (overrides.request ?? createRequest()) as never,
    csrfToken: overrides.csrfToken ?? 'csrf-token',
    idempotencyKey: overrides.idempotencyKey ?? 'idem-key-1',
    ...(overrides.createIdempotencyKey === undefined
      ? {}
      : { createIdempotencyKey: overrides.createIdempotencyKey }),
    fetcher,
  });
