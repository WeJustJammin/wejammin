/**
 * The stable identifiers and the request/response fixtures the runtime
 * mutation tests build on, kept out of the test file so it stays within its
 * line cap.
 */

import { executeCmsEditorialRevisionMutation } from './cms-editorial-runtime';

export const FIELD_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132df';
export const SCHEMA_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132de';
export const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';

// `version` is the immutable revision snapshot's own version (always '1');
// `entryVersion` is the committed entry version and the only valid next
// If-Match (lane G contract: EntryRevisionResource.entryVersion).
export const revisionResource = () => ({
  id: REVISION_ID,
  version: '1',
  entryVersion: '12',
  createdAt: '2026-09-26T12:00:00+00:00',
  updatedAt: '2026-09-26T12:00:00+00:00',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '5',
  schemaVersionId: SCHEMA_VERSION_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
});

export const request = () => ({
  entryId: ENTRY_ID,
  baseRevision: '4',
  changedPaths: ['/fields/' + FIELD_A],
  values: { [FIELD_A]: 'hello there' },
  locale: 'en-US',
  expectedVersion: '11',
});

export const jsonResponse = (
  status: number,
  body: unknown,
  headers?: HeadersInit,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  });

export const apiError = (code: string) => ({
  code,
  message: 'Safe message',
  requestId: REQUEST_ID,
  details: {},
});

export const submit = (
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  overrides: { readonly request?: unknown; readonly csrfToken?: string } = {},
) =>
  executeCmsEditorialRevisionMutation({
    path: '/api/v1/cms/entries/' + ENTRY_ID + '/revisions',
    request: (overrides.request ?? request()) as never,
    csrfToken: overrides.csrfToken ?? 'csrf-token',
    idempotencyKey: 'idem-key-1',
    fetcher,
  });
