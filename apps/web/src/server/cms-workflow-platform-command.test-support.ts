import { vi } from 'vitest';

import {
  ASSIGNMENT_ID,
  ENTRY_ID,
  HASH_A,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
  assignmentResourceFixture,
  dependencyManifestFixture,
  jsonResponse,
  previewResourceFixture,
  publicationResourceFixture,
  reviewFixture,
  scheduleResourceFixture,
  versionSetFixture,
} from '../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';
import type { CmsWorkflowCommandOperationId } from './cms-workflow-platform-command';

export const ORIGIN = 'https://app.example.test';
export const CSRF = 'csrf-token-000000000001';
export const KEY = 'idem-key-000000000001';

export interface CommandCase {
  readonly operationId: CmsWorkflowCommandOperationId;
  readonly params: Readonly<{ entryId?: string; reviewId?: string }>;
  readonly browserPath: string;
  readonly upstreamPath: string;
  readonly body: Record<string, unknown>;
  readonly ifMatch: string;
  readonly successStatus: 200 | 201 | 202;
  readonly resource: unknown;
  /** A contract-valid body that names another identity than the request. */
  readonly mismatched: unknown;
  readonly etag: string | null;
  readonly location: string | null;
}

const reviewAfterDecision = reviewFixture({
  version: '3',
  state: 'approved',
  recordedDecisionCount: 1,
  decidedAt: '2026-10-09T12:00:00Z',
});

export const COMMAND_CASES: Readonly<
  Record<CmsWorkflowCommandOperationId, CommandCase>
> = {
  'CMS-03B-05': {
    operationId: 'CMS-03B-05',
    params: { entryId: ENTRY_ID },
    browserPath: `/api/v1/cms/entries/${ENTRY_ID}/reviews`,
    upstreamPath: `/api/v1/cms/entries/${ENTRY_ID}/reviews`,
    body: {
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      frozenHash: HASH_A,
      dependencyManifest: dependencyManifestFixture,
    },
    ifMatch: '"7"',
    successStatus: 201,
    resource: reviewFixture({ version: '1' }),
    mismatched: reviewFixture({ version: '1', revisionId: SCHEMA_VERSION_ID }),
    etag: '"1"',
    location: `/api/v1/cms/reviews/${REVIEW_ID}`,
  },
  'CMS-03B-06': {
    operationId: 'CMS-03B-06',
    params: { reviewId: REVIEW_ID },
    browserPath: `/api/v1/cms/reviews/${REVIEW_ID}/decision`,
    upstreamPath: `/api/v1/cms/reviews/${REVIEW_ID}/decision`,
    body: {
      reviewId: REVIEW_ID,
      decision: 'approve',
      reason: 'The candidate matches its frozen dependencies.',
      expectedVersion: '2',
    },
    ifMatch: '"2"',
    successStatus: 200,
    resource: reviewAfterDecision,
    mismatched: reviewFixture({
      id: SCHEMA_VERSION_ID,
      version: '3',
      state: 'approved',
      recordedDecisionCount: 1,
      decidedAt: '2026-10-09T12:00:00Z',
    }),
    etag: '"3"',
    location: null,
  },
  'CMS-03B-07': {
    operationId: 'CMS-03B-07',
    params: {},
    browserPath: '/api/v1/cms/publication-schedules',
    upstreamPath: '/api/v1/cms/publication-schedules',
    body: {
      revisionId: REVISION_ID,
      action: 'publish',
      localDateTime: '2026-11-01T09:30:00',
      timezone: 'America/New_York',
      resolvedUtc: '2026-11-01T14:30:00Z',
      tzdbVersion: '2026e',
      disambiguation: 'none',
      audience: 'members',
      expectedVersion: '5',
    },
    ifMatch: '"5"',
    successStatus: 202,
    resource: scheduleResourceFixture(),
    mismatched: scheduleResourceFixture({ revisionId: SCHEMA_VERSION_ID }),
    etag: '"1"',
    location: `/api/v1/cms/publication-schedules/${ASSIGNMENT_ID}`,
  },
  'CMS-03B-08': {
    operationId: 'CMS-03B-08',
    params: {},
    browserPath: '/api/v1/cms/previews',
    upstreamPath: '/api/v1/cms/previews',
    body: {
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      locale: 'en-US',
      audience: 'members',
      route: '/music/artist/spring-2026-tour',
      versionSet: versionSetFixture,
    },
    ifMatch: '"7"',
    successStatus: 201,
    resource: previewResourceFixture(),
    mismatched: previewResourceFixture({ audience: 'staff' }),
    etag: null,
    location: null,
  },
  'CMS-03B-09': {
    operationId: 'CMS-03B-09',
    params: {},
    browserPath: '/api/v1/cms/publications',
    upstreamPath: '/api/v1/cms/publications',
    body: {
      entryId: ENTRY_ID,
      revisionId: REVISION_ID,
      frozenHash: HASH_A,
      expectedVersionSet: versionSetFixture,
      audience: 'members',
      expectedVersion: '5',
    },
    ifMatch: '"5"',
    successStatus: 202,
    resource: publicationResourceFixture(),
    mismatched: publicationResourceFixture({ audience: 'staff' }),
    etag: '"1"',
    location: `/api/v1/cms/publications/${ASSIGNMENT_ID}`,
  },
  'CMS-03B-18': {
    operationId: 'CMS-03B-18',
    params: { reviewId: REVIEW_ID },
    browserPath: `/api/v1/cms/reviews/${REVIEW_ID}/assignments`,
    upstreamPath: `/api/v1/cms/reviews/${REVIEW_ID}/assignments`,
    body: {
      action: 'create',
      expectedVersion: '2',
      reviewerPersonId: REVIEWER_PERSON_ID,
      expiresAt: '2026-10-10T12:00:00Z',
    },
    ifMatch: '"2"',
    successStatus: 201,
    resource: assignmentResourceFixture(),
    mismatched: assignmentResourceFixture({ reviewId: SCHEMA_VERSION_ID }),
    etag: '"1"',
    location: `/api/v1/cms/reviews/${REVIEW_ID}/assignments/${ASSIGNMENT_ID}`,
  },
};

export const REVOKE_CASE: CommandCase = {
  ...COMMAND_CASES['CMS-03B-18'],
  body: {
    action: 'revoke',
    expectedVersion: '2',
    assignmentId: ASSIGNMENT_ID,
  },
  successStatus: 200,
  resource: assignmentResourceFixture({ state: 'revoked' }),
  mismatched: assignmentResourceFixture({
    id: SCHEMA_VERSION_ID,
    state: 'revoked',
  }),
  location: null,
};

export const commandRequest = (
  testCase: CommandCase,
  overrides: Readonly<{
    body?: BodyInit;
    headers?: Readonly<Record<string, string | null>>;
    url?: string;
    method?: string;
  }> = {},
): Request => {
  const headers = new Headers({
    cookie: `wj_access=a; wj_csrf=${CSRF}`,
    origin: ORIGIN,
    'x-csrf-token': CSRF,
    'idempotency-key': KEY,
    'if-match': testCase.ifMatch,
    'content-type': 'application/json',
  });
  for (const [name, value] of Object.entries(overrides.headers ?? {}))
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  return new Request(overrides.url ?? `${ORIGIN}${testCase.browserPath}`, {
    method: overrides.method ?? 'POST',
    headers,
    body: overrides.body ?? JSON.stringify(testCase.body),
  });
};

export const upstreamSuccess = (testCase: CommandCase): Response => {
  const headers: Record<string, string> = { 'cache-control': 'no-store' };
  if (testCase.etag !== null) headers.etag = testCase.etag;
  if (testCase.location !== null) headers.location = testCase.location;
  return jsonResponse(testCase.successStatus, testCase.resource, headers);
};

/** A private PLATFORM_API binding that answers queued responses and records requests. */
export const bindingFor = (...queue: readonly (Response | Error)[]) => {
  const seen: Request[] = [];
  const remaining = [...queue];
  const fetchStub = vi.fn((request: Request) => {
    seen.push(request);
    const next = remaining.shift() ?? new Error('unexpected upstream call');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { fetch: fetchStub, requests: () => seen };
};
