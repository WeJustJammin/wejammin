import { createLogger } from '@wejammin/observability/logging';
import { expect, vi } from 'vitest';

import { createApp as createAuthenticationApp } from '../authentication/phase-02-slice-02.test-support';
import {
  bindings,
  CSRF,
  ORIGIN,
  REQUEST_ID,
  session,
} from '../authentication/phase-02-slice-02.test-fixtures';
import { createWorkerApp, type WorkerDependencies } from '../index';

export { bindings, CSRF, ORIGIN, REQUEST_ID, session };

export const PARTY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const PROFILE_PERSON_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const SECTION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const REEL_ITEM_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const CREDIT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const MEDIA_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
export const RIGHTS_ID = '12121212-1212-4212-8212-121212121212';
export const OBSERVATION_ID = '13131313-1313-4313-8313-131313131313';
export const EVENT_ID = '14141414-1414-4414-8414-141414141414';
export const MESSAGE_ID = '15151515-1515-4515-8515-151515151515';
export const REQUEST_TOKEN = 'slice06-profile-opaque-cursor-012345';

export type ProfilePortInput = Readonly<{
  operationId: string;
  request: Request;
  body?: Readonly<Record<string, unknown>>;
  path?: Readonly<Record<string, string>>;
  idempotencyKey?: string;
  ifMatch?: string;
  session?: unknown;
}>;

export type ProfileSuccess = Readonly<{ ok: true; value: unknown }>;
export type ProfileFailure = Readonly<{
  ok: false;
  status: number;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}>;
export type ProfilePortResult = ProfileSuccess | ProfileFailure;
export type ProfilePort = (
  input: ProfilePortInput,
  env: typeof bindings,
  signal: AbortSignal,
) => Promise<ProfilePortResult>;

/**
 * Deliberate RED seam. The runtime is expected to add this dependency group to
 * WorkerDependencies and register all eleven PRF-PROF operations behind it.
 */
export type ProfilePortfolioDependencies = Readonly<{
  readPublicProfile: ProfilePort;
  readSectionRevisions: ProfilePort;
  putSection: ProfilePort;
  putEmphasis: ProfilePort;
  readPortfolio: ProfilePort;
  readReel: ProfilePort;
  createReelItem: ProfilePort;
  updateReelItem: ProfilePort;
  removeReelItem: ProfilePort;
  ingestProfileFactObservation: ProfilePort;
  readEmphasis: ProfilePort;
  emitEvent: (
    event: unknown,
    env: typeof bindings,
    signal: AbortSignal,
  ) => void | Promise<void>;
}>;

const meta = { requestId: REQUEST_ID } as const;
const factRef = {
  sourceType: 'credit',
  sourceId: CREDIT_ID,
  sourceVersion: '3',
} as const;

export const responses = {
  publicProfile: {
    data: {
      partyId: PARTY_ID,
      projectionVersion: '3',
      cacheKey: `profile:${PARTY_ID}:3:en`,
      layers: [
        { code: 'header', state: 'ready', facts: [] },
        { code: 'now', state: 'empty' },
        { code: 'record', state: 'empty' },
        { code: 'detail', state: 'empty' },
      ],
      generatedAt: '2026-09-01T05:00:00.000Z',
    },
    meta,
  },
  sectionRevisions: { data: [], meta },
  section: {
    data: {
      id: SECTION_ID,
      partyId: PARTY_ID,
      sectionCode: 'biography',
      blocks: [{ kind: 'paragraph', text: 'A safe profile section.' }],
      authorPersonId: PROFILE_PERSON_ID,
      actingPartyId: PARTY_ID,
      state: 'active',
      version: '2',
      createdAt: '2026-09-01T05:00:00.000Z',
      activatedAt: '2026-09-01T05:00:00.000Z',
    },
    meta,
  },
  emphasis: {
    data: {
      partyId: PARTY_ID,
      surface: 'public',
      defaultFilter: { roleCodes: ['performer'] },
      orderedRefs: [factRef],
      version: '4',
      updatedAt: '2026-09-01T05:00:00.000Z',
    },
    meta,
  },
  portfolio: {
    data: {
      items: [],
      visibleTotals: {},
      filters: { roleCode: null, from: null, to: null },
      projectionVersion: '3',
    },
    meta,
  },
  reel: {
    data: [],
    meta: { ...meta, projectionVersion: '3' },
  },
  reelItem: {
    data: {
      id: REEL_ITEM_ID,
      partyId: PARTY_ID,
      creditRef: factRef,
      mediaRef: { sourceType: 'media', sourceId: MEDIA_ID, sourceVersion: '3' },
      roleCode: 'performer',
      rightsBasis: 'ownership',
      rightsRef: {
        sourceType: 'media',
        sourceId: RIGHTS_ID,
        sourceVersion: '3',
      },
      state: 'draft',
      order: 0,
      version: '1',
      createdAt: '2026-09-01T05:00:00.000Z',
      updatedAt: '2026-09-01T05:00:00.000Z',
    },
    meta,
  },
  observation: {
    data: {
      observationId: OBSERVATION_ID,
      accepted: true,
      dedupeState: 'new',
      projectionVersion: '4',
      invalidationEventId: EVENT_ID,
    },
    meta,
  },
} as const;

const success = (value: unknown): ProfileSuccess => ({ ok: true, value });

export const failure = (
  status: number,
  code: string,
  message = 'The profile operation could not be completed.',
  details: Readonly<Record<string, unknown>> = {},
): ProfileFailure => ({ ok: false, status, code, message, details });

const defaultPorts = (): ProfilePortfolioDependencies => ({
  readPublicProfile: vi.fn(async () => success(responses.publicProfile)),
  readSectionRevisions: vi.fn(async () => success(responses.sectionRevisions)),
  putSection: vi.fn(async () => success(responses.section)),
  putEmphasis: vi.fn(async () => success(responses.emphasis)),
  readPortfolio: vi.fn(async () => success(responses.portfolio)),
  readReel: vi.fn(async () => success(responses.reel)),
  createReelItem: vi.fn(async () => success(responses.reelItem)),
  updateReelItem: vi.fn(async () => success(responses.reelItem)),
  removeReelItem: vi.fn(async () => success(responses.reelItem)),
  ingestProfileFactObservation: vi.fn(async () =>
    success(responses.observation),
  ),
  readEmphasis: vi.fn(async () => success(responses.emphasis)),
  emitEvent: vi.fn(async () => undefined),
});

export const createProfilePortfolioApp = (
  overrides: Partial<ProfilePortfolioDependencies> = {},
) => {
  const base = createAuthenticationApp();
  const profilePortfolio = { ...defaultPorts(), ...overrides };
  const dependencies = {
    auth: base.auth,
    profilePortfolio,
    captureException: vi.fn(),
    createLogger: () =>
      createLogger({
        environment: 'staging',
        release: 'phase-02-slice-06-red',
        service: 'wejammin-api',
      }),
    now: () => Date.now(),
  } as unknown as WorkerDependencies;
  return {
    app: createWorkerApp(dependencies),
    auth: base.auth,
    dependencies,
    profilePortfolio,
  };
};

const withSession = (headers: Headers): void => {
  headers.set('cookie', `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`);
  headers.set('x-csrf-token', CSRF);
};

export const readRequest = (
  path: string,
  query?: string,
  authenticated = false,
): Request => {
  const headers = new Headers({
    accept: 'application/json',
    origin: ORIGIN,
    'x-request-id': REQUEST_ID,
  });
  if (authenticated) withSession(headers);
  return new Request(
    `${ORIGIN}${path}${query === undefined ? '' : `?${query}`}`,
    {
      method: 'GET',
      headers,
    },
  );
};

export const jsonRequest = (
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: Readonly<Record<string, unknown>>,
  options: Readonly<{
    authenticated?: boolean;
    idempotencyKey?: string | null;
    ifMatch?: string | null;
    contentType?: string;
    query?: string;
    internal?: boolean;
  }> = {},
): Request => {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': options.contentType ?? 'application/json',
    origin: ORIGIN,
    'x-request-id': REQUEST_ID,
  });
  if (options.idempotencyKey !== null)
    headers.set('idempotency-key', options.idempotencyKey ?? 'slice06-red-key');
  if (options.ifMatch !== null && options.ifMatch !== undefined)
    headers.set('if-match', options.ifMatch);
  if (options.authenticated !== false) withSession(headers);
  if (options.internal) {
    headers.set('x-producer-id', 'shard04');
    headers.set('x-producer-signature', 'slice06-valid-signature');
  }
  return new Request(
    `${ORIGIN}${path}${options.query === undefined ? '' : `?${options.query}`}`,
    {
      method,
      headers,
      body: JSON.stringify(body),
    },
  );
};
export const expectApiError = async (
  response: Response,
  status: number,
  code: string,
  details?: Record<string, unknown>,
): Promise<void> => {
  expect(response.status).toBe(status);
  const payload = (await response.json()) as Record<string, unknown>;
  expect(payload).toMatchObject({ code, requestId: REQUEST_ID });
  if (details !== undefined) expect(payload.details).toEqual(details);
  expect(Object.keys(payload).sort()).toEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
};
