import { vi } from 'vitest';
import type { PreflightEvidence } from '@wejammin/contracts';

import { createCmsEditorialApp } from './index';
import type { CmsEditorialDependencies, CmsEditorialPorts } from './types';
import {
  approvedReviewResource,
  assignmentCreateBody,
  assignmentId,
  assignmentResource,
  decisionBody,
  entryId,
  evidence,
  idempotencyKey,
  origin,
  partyId,
  previewBody,
  previewResource,
  publicationBody,
  publicationResource,
  queuePage,
  requestId,
  reviewDetailResource,
  reviewId,
  reviewResource,
  scheduleBody,
  scheduleId,
  scheduleResource,
  submitBody,
  userId,
  workflowResource,
} from './workflow-fixtures.test-support';

/** The harness and the six command cases of the Slice 11 route suites. */
export type WorkflowPortName = keyof CmsEditorialPorts;
type PortOverride = (input: never, signal: AbortSignal) => Promise<unknown>;

export type WorkflowHarnessOptions = Readonly<{
  capabilities?: readonly string[];
  actingPartyId?: string | null;
  mfaFresh?: boolean;
  rateAllowed?: boolean;
  unauthenticated?: boolean;
  /** Replace the default success of one port (the fake still records its calls). */
  port?: Readonly<Partial<Record<WorkflowPortName, PortOverride>>>;
  omitPorts?: readonly WorkflowPortName[];
  omitQualityGate?: boolean;
  qualityGate?: CmsEditorialDependencies['qualityGate'];
  timeAuthority?: CmsEditorialDependencies['timeAuthority'];
  rateLimit?: CmsEditorialDependencies['rateLimit'];
  deadlineMs?: number;
  /** Mount without an injected clock (the route falls back to the host clock). */
  omitClock?: boolean;
}>;

const ok = <T>(value: T) => ({ ok: true as const, value });

const defaultPorts = {
  submitReview: async () => ok(reviewResource),
  recordDecision: async () => ok(approvedReviewResource),
  schedulePublication: async () => ok(scheduleResource),
  mintPreview: async () => ok(previewResource),
  publishRevision: async () => ok(publicationResource),
  assignEditorialReviewer: async () => ok(assignmentResource),
  getEntryWorkflow: async () => ok(workflowResource),
  getEditorialReview: async () => ok(reviewDetailResource),
  listEditorialReviews: async () => ok(queuePage),
} as const satisfies Partial<Record<WorkflowPortName, PortOverride>>;

/** Mount the app over fake ports; every fake is a `vi.fn` that records calls. */
export const workflowHarness = (options: WorkflowHarnessOptions = {}) => {
  const ports: Record<string, ReturnType<typeof vi.fn>> = {};
  const merged: Record<string, PortOverride> = {
    ...defaultPorts,
    ...options.port,
  };
  for (const [name, implementation] of Object.entries(merged))
    if (!(options.omitPorts ?? []).includes(name as WorkflowPortName))
      ports[name] = vi.fn(implementation);
  const session = {
    userId,
    actingPartyId:
      options.actingPartyId === undefined ? partyId : options.actingPartyId,
    capabilities: options.capabilities ?? [
      'cms.author',
      'cms.editor',
      'cms.reviewer',
      'cms.publisher',
    ],
    mfaFresh: options.mfaFresh ?? true,
  };
  const resolveSession = vi.fn(async () =>
    options.unauthenticated === true
      ? {
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'No session.',
        }
      : ok(session),
  );
  const rateLimit = vi.fn(
    options.rateLimit ??
      (async (input: { limit: number }) =>
        ok({
          allowed: options.rateAllowed ?? true,
          limit: input.limit,
          remaining: Math.max(0, input.limit - 1),
          resetAt: 60_000,
        })),
  );
  const qualityGate = vi.fn(
    options.qualityGate ??
      (async (): Promise<PreflightEvidence | null> => evidence),
  );
  const telemetry = vi.fn();
  const dependencies = {
    ports,
    resolveSession,
    rateLimit,
    humanOrigins: [origin],
    ...(options.omitClock === true
      ? {}
      : { now: () => Date.parse('2026-10-08T12:00:00Z') }),
    telemetry,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    ...(options.omitQualityGate === true ? {} : { qualityGate }),
    ...(options.timeAuthority === undefined
      ? {}
      : { timeAuthority: options.timeAuthority }),
  } as unknown as CmsEditorialDependencies;
  return {
    app: createCmsEditorialApp(dependencies),
    ports,
    resolveSession,
    rateLimit,
    qualityGate,
    telemetry,
  };
};

export type WorkflowApp = ReturnType<typeof workflowHarness>['app'];

export const postJson = (
  app: WorkflowApp,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'if-match': '"2"',
        'x-request-id': requestId,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

export const getJson = (
  app: WorkflowApp,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'GET',
      headers: { origin, 'x-request-id': requestId, ...headers },
    }),
  );

/** A copy of `value` without `key` (the lint-clean way to build an invalid variant). */
export const without = <T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(value).filter(([name]) => name !== key),
  ) as Omit<T, K>;

export const errorBody = async (
  response: Response,
): Promise<{
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
}> =>
  (await response.json()) as {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };

/** One Slice 11 command as the generic admission suite drives it. */
export type CommandCase = Readonly<{
  operationId: string;
  path: string;
  body: Record<string, unknown>;
  port: WorkflowPortName;
  status: 200 | 201 | 202;
  etag: string | null;
  location: string | null;
  stepUp: boolean;
  /** A session capability set the Worker gate must refuse (null: scope is the RPC's). */
  deniedCapabilities: readonly string[] | null;
  /** The runtime body member that must equal the If-Match operand, if any. */
  versionMember: 'expectedVersion' | null;
  evidence: boolean;
  /** A path/body member pair that must agree, if the route binds one. */
  boundId: Readonly<{ member: string; value: string }> | null;
}>;

export const commandCases: readonly CommandCase[] = [
  {
    operationId: 'CMS-03B-05',
    path: `/api/v1/cms/entries/${entryId}/reviews`,
    body: submitBody,
    port: 'submitReview',
    status: 201,
    etag: '"1"',
    location: `/api/v1/cms/reviews/${reviewId}`,
    stepUp: false,
    deniedCapabilities: ['cms.reviewer', 'cms.publisher'],
    versionMember: null,
    evidence: true,
    boundId: { member: 'entryId', value: entryId },
  },
  {
    operationId: 'CMS-03B-06',
    path: `/api/v1/cms/reviews/${reviewId}/decision`,
    body: decisionBody,
    port: 'recordDecision',
    status: 200,
    etag: '"2"',
    location: null,
    stepUp: true,
    deniedCapabilities: ['cms.author', 'cms.editor', 'cms.publisher'],
    versionMember: 'expectedVersion',
    evidence: false,
    boundId: { member: 'reviewId', value: reviewId },
  },
  {
    operationId: 'CMS-03B-07',
    path: '/api/v1/cms/publication-schedules',
    body: scheduleBody,
    port: 'schedulePublication',
    status: 202,
    etag: '"1"',
    location: `/api/v1/cms/publication-schedules/${scheduleId}`,
    stepUp: true,
    deniedCapabilities: ['cms.author', 'cms.editor', 'cms.reviewer'],
    versionMember: 'expectedVersion',
    evidence: true,
    boundId: null,
  },
  {
    operationId: 'CMS-03B-08',
    path: '/api/v1/cms/previews',
    body: previewBody,
    port: 'mintPreview',
    status: 201,
    etag: null,
    location: null,
    stepUp: false,
    deniedCapabilities: null,
    versionMember: null,
    evidence: false,
    boundId: null,
  },
  {
    operationId: 'CMS-03B-09',
    path: '/api/v1/cms/publications',
    body: publicationBody,
    port: 'publishRevision',
    status: 202,
    etag: '"3"',
    location: `/api/v1/cms/publications/${scheduleId}`,
    stepUp: true,
    deniedCapabilities: ['cms.author', 'cms.editor', 'cms.reviewer'],
    versionMember: 'expectedVersion',
    evidence: true,
    boundId: null,
  },
  {
    operationId: 'CMS-03B-18',
    path: `/api/v1/cms/reviews/${reviewId}/assignments`,
    body: assignmentCreateBody,
    port: 'assignEditorialReviewer',
    status: 201,
    etag: '"1"',
    location: `/api/v1/cms/reviews/${reviewId}/assignments/${assignmentId}`,
    stepUp: true,
    deniedCapabilities: null,
    versionMember: 'expectedVersion',
    evidence: false,
    boundId: null,
  },
];

/** One Slice 11 safe read as the generic read suite drives it. */
export type ReadCase = Readonly<{
  operationId: string;
  path: string;
  port: WorkflowPortName;
  /** A query that must be refused 400 (closed key set). */
  badQuery: string;
  /** The bound path identifier, when the route has one. */
  boundId: string | null;
}>;

export const readCases: readonly ReadCase[] = [
  {
    operationId: 'CMS-03B-15',
    path: `/api/v1/cms/entries/${entryId}/workflow`,
    port: 'getEntryWorkflow',
    badQuery: '?entryId=x',
    boundId: entryId,
  },
  {
    operationId: 'CMS-03B-16',
    path: `/api/v1/cms/reviews/${reviewId}`,
    port: 'getEditorialReview',
    badQuery: '?cursor=x',
    boundId: reviewId,
  },
  {
    operationId: 'CMS-03B-17',
    path: '/api/v1/cms/reviews',
    port: 'listEditorialReviews',
    badQuery: '?owner=x',
    boundId: null,
  },
];
