import {
  executeCmsEditorialConflictResolve,
  type CmsEditorialConflictResolveRequest,
} from './cms-editorial-conflict-resolve';

export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const CONFLICT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
export const PARENT_A = '018f0c45-73fe-7dc2-9c09-68f7ecf132e0';
export const PARENT_B = '018f0c45-73fe-7dc2-9c09-68f7ecf132e1';
export const INSTANT = '2026-09-26T12:00:00+00:00';

export const theirsChoice = {
  path: '/fields/title',
  choice: 'theirs',
} as const;

export const validRequest = {
  entryId: ENTRY_ID,
  conflictId: CONFLICT_ID,
  baseRevision: '4',
  choices: [theirsChoice],
  expectedVersion: '7',
} as const;

export const resolvedResource = {
  id: REVISION_ID,
  version: '8',
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '8',
  schemaVersionId: CONFLICT_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [PARENT_A, PARENT_B],
  validationState: 'valid',
  conflictId: CONFLICT_ID,
} as const;

export const CREATED_REVISION_ID = REVISION_ID;
export const PARENT_A_ID = PARENT_A;
export const PARENT_B_ID = PARENT_B;
export const SCHEMA_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e2';
export const RESOLVE_PATH =
  '/api/v1/cms/entries/' + ENTRY_ID + '/conflicts/' + CONFLICT_ID + '/resolve';
export const CSRF_TOKEN = 'csrf-token';
export const IDEMPOTENCY_KEY = '0d9c1c2a-6f4f-4cde-9a3e-111111111111';

export const resolveRequest = (): CmsEditorialConflictResolveRequest => ({
  entryId: ENTRY_ID,
  conflictId: CONFLICT_ID,
  baseRevision: '4',
  choices: [{ path: '/fields/title', choice: 'theirs' }],
  expectedVersion: '7',
});

export const resolvedTransportResource = () => ({
  id: CREATED_REVISION_ID,
  version: '8',
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '8',
  schemaVersionId: SCHEMA_VERSION_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  parentRevisionIds: [PARENT_A_ID, PARENT_B_ID],
  validationState: 'valid',
  conflictId: CONFLICT_ID,
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
  requestId: ENTRY_ID,
  details: {},
});

export const submitResolve = (
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  overrides?: {
    readonly request?: unknown;
    readonly csrfToken?: string;
    readonly idempotencyKey?: string;
    readonly createIdempotencyKey?: () => string;
  },
) =>
  executeCmsEditorialConflictResolve({
    path: RESOLVE_PATH,
    request: (overrides?.request ??
      resolveRequest()) as CmsEditorialConflictResolveRequest,
    csrfToken: overrides?.csrfToken ?? CSRF_TOKEN,
    idempotencyKey: overrides?.idempotencyKey ?? IDEMPOTENCY_KEY,
    ...(overrides?.createIdempotencyKey
      ? { createIdempotencyKey: overrides.createIdempotencyKey }
      : {}),
    fetcher,
  });
