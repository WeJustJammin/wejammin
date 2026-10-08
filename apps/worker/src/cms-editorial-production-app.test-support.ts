import { vi } from 'vitest';

import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
} from './cms-editorial';
import {
  conflictBody,
  conflictPath,
  createBody,
  createPath,
  restoreBody,
  restorePath,
  revisionBody,
  revisionPath,
} from './cms-editorial/route-fixtures.test-support';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  REVISION_ID,
  USER_ID,
  compose,
  json,
} from './cms-editorial-production.test-support';

/**
 * Whole-app fixtures for Slice 10 error and composition tests: the real Hono
 * routes over the real production adapter, with only the PostgREST network edge
 * (`fetchImpl`) and the session/rate seams faked. Nothing here implements more
 * than the published contract.
 */

export const ORIGIN = 'https://cms.example.test';
export const CONFLICT_ID = '31000000-0000-4000-8000-000000000003';
export const FIELD_ID = '60000000-0000-4000-8000-000000000006';
export const IDEMPOTENCY_KEY = 'idempotency-key-0001';

export const sessionSeam = async (): Promise<{
  ok: true;
  value: {
    userId: string;
    actingPartyId: string;
    capabilities: readonly string[];
    mfaFresh: boolean;
  };
}> => ({
  ok: true,
  value: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author', 'cms.editor'],
    mfaFresh: true,
  },
});

export const rateSeam = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 60_000,
  },
});

export const wiredApp = (
  fetchImpl: typeof fetch,
  overrides: Record<string, unknown> = {},
) =>
  createCmsEditorialApp(
    compose(fetchImpl, {
      resolveSession: sessionSeam,
      rateLimit: rateSeam,
      telemetry: async () => undefined,
      ...overrides,
    }) as unknown as CmsEditorialDependencies,
  );

/** A PostgREST `RAISE EXCEPTION '<token>' USING ERRCODE = '<sqlstate>'` body. */
export const postgrestRaise = (
  message: string,
  sqlstate = 'P0001',
  httpStatus = 400,
  extra: Record<string, unknown> = {},
): Response =>
  json(
    { code: sqlstate, details: null, hint: null, message, ...extra },
    httpStatus,
  );

export const fetchFailing = (response: () => Response) =>
  vi.fn(async () => response()) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;

const writeHeaders = (extra: Record<string, string> = {}) => ({
  origin: ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': IDEMPOTENCY_KEY,
  'x-request-id': REQUEST_ID,
  ...extra,
});

const readHeaders = { origin: ORIGIN, 'x-request-id': REQUEST_ID };

type App = ReturnType<typeof wiredApp>;
type Sender = (app: App, signal?: AbortSignal) => Promise<Response> | Response;

const post =
  (path: string, body: unknown, headers: Record<string, string> = {}): Sender =>
  (app, signal) =>
    app.request(path, {
      method: 'POST',
      headers: writeHeaders(headers),
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });

const get =
  (path: string): Sender =>
  (app, signal) =>
    app.request(path, {
      headers: readHeaders,
      ...(signal === undefined ? {} : { signal }),
    });

export const entryPath = `/api/v1/cms/entries/${ENTRY_ID}`;

/** BE03b:1056 pointer grammar: `/fields/{stableFieldId}` for every kind. */
export const appendBody = {
  ...revisionBody,
  changedPaths: [`/fields/${FIELD_ID}`],
};

export const appendRequest = (
  app: App,
  overrides: { headers?: Record<string, string>; body?: unknown } = {},
  signal?: AbortSignal,
) =>
  post(revisionPath, overrides.body ?? appendBody, {
    'if-match': '"1"',
    ...overrides.headers,
  })(app, signal);

export const resolveRequest: Sender = post(conflictPath, conflictBody, {
  'if-match': '"2"',
});
export const restoreRequest: Sender = post(restorePath, restoreBody, {
  'if-match': '"2"',
});
export const createRequest: Sender = post(createPath, createBody);
export const historyRequest: Sender = get(revisionPath);
export const draftDetailRequest: Sender = get(entryPath);
export const conflictDetailRequest: Sender = get(
  `${entryPath}/conflicts/${CONFLICT_ID}`,
);
export const authoringContextRequest: Sender = get(
  '/api/v1/cms/entries/authoring-context',
);
export const listRequest = (app: App, query = '', signal?: AbortSignal) =>
  get(`/api/v1/cms/entries${query}`)(app, signal);

export type ApiErrorBody = Readonly<{
  code: string;
  message: string;
  requestId: string;
  details: Readonly<Record<string, unknown>>;
}>;

export const readError = async (response: Response): Promise<ApiErrorBody> =>
  (await response.json()) as ApiErrorBody;

/** Contract-valid success payloads the faked PostgREST edge may answer. */
const TIMESTAMP = '2026-09-26T12:00:00.000Z';
const HASH64 = 'a'.repeat(64);

export const draftDetailPayload = {
  entry: {
    id: ENTRY_ID,
    version: '3',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  revision: {
    id: REVISION_ID,
    version: '5',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: HASH64,
  schemaVersionId: '50000000-0000-4000-8000-000000000005',
  validationState: 'valid',
  openConflict: null,
  fields: [],
  relations: [],
} as const;

export const historyPagePayload = {
  items: [],
  nextCursor: null,
  pageVersion: '2',
  compare: null,
} as const;

export const entryListPayload = {
  items: [
    {
      id: REVISION_ID,
      entryId: ENTRY_ID,
      entryLifecycle: 'active',
      entryUpdatedAt: TIMESTAMP,
      revisionNumber: '3',
      locale: 'en-US',
      state: 'draft',
      contentHash: HASH64,
      createdAt: TIMESTAMP,
      authorClass: 'human',
    },
  ],
  nextCursor: null,
  pageVersion: '7',
} as const;
