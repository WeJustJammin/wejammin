import { describe, expect, it, vi } from 'vitest';

import type { ConfigurationPort } from './types';
import {
  CORRELATION_ID,
  REQUEST_ID,
  action,
  actionRequest,
  actionResponse,
  definitionRequest,
  definitionId,
  definitionResponse,
  effectiveQuery,
  effectiveRequest,
  effectiveResponse,
  expectError,
  makeHarness,
  proposal,
  proposalRequest,
  proposalResponse,
  releaseRequest,
} from './phase-02-slice-07.test-support';

describe('Phase 2 Slice 07 Worker route behavioral acceptance', () => {
  it.each([
    {
      criterion: 'P2-S07-AC-005,P2-S07-AC-051',
      operationId: 'CFG-05A-01' as const,
      method: 'POST' as const,
      path: '/api/v1/internal/config/definitions',
      request: () => releaseRequest(definitionRequest),
      response: definitionResponse,
      status: 201,
      etag: '"1"',
      cacheControl: 'no-store',
    },
    {
      criterion: 'P2-S07-AC-011,P2-S07-AC-054',
      operationId: 'CFG-05A-02' as const,
      method: 'GET' as const,
      path: effectiveQuery,
      request: () => effectiveRequest(),
      response: effectiveResponse,
      status: 200,
      etag: '"1"',
      cacheControl: 'private, no-store',
    },
    {
      criterion: 'P2-S07-AC-017,P2-S07-AC-057',
      operationId: 'CFG-05A-03' as const,
      method: 'POST' as const,
      path: `/api/v1/admin/settings/${definitionId}/changes`,
      request: () => proposalRequest(),
      response: proposalResponse,
      status: 201,
      etag: '"1"',
      cacheControl: 'no-store',
    },
    {
      criterion: 'P2-S07-AC-023,P2-S07-AC-060',
      operationId: 'CFG-05A-04' as const,
      method: 'POST' as const,
      path: `/api/v1/admin/settings/changes/${definitionId}/actions`,
      request: () => actionRequest(),
      response: actionResponse,
      status: 200,
      etag: '"2"',
      cacheControl: 'no-store',
    },
  ])(
    '[$criterion] executes $method $path in createWorkerApp and returns the exact strict success body',
    async ({
      operationId,
      request: makeRequest,
      response: expected,
      status,
      etag,
      cacheControl,
    }) => {
      const port = vi.fn<ConfigurationPort>(async (input) => {
        expect(input.operationId).toBe(operationId);
        return { ok: true as const, value: expected };
      });
      const harness = makeHarness({ port });

      const actual = await harness.app.request(makeRequest());

      expect(actual.status).toBe(status);
      await expect(actual.json()).resolves.toEqual(expected);
      expect(actual.headers.get('etag')).toBe(etag);
      expect(actual.headers.get('cache-control')).toBe(cacheControl);
      expect(actual.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(actual.headers.get('x-correlation-id')).toBe(CORRELATION_ID);
      expect(port).toHaveBeenCalledOnce();
    },
  );

  it.each([
    {
      criterion: 'P2-S07-AC-006,P2-S07-AC-051',
      makeRequest: () =>
        releaseRequest({ ...definitionRequest, unknownField: true }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/',
    },
    {
      criterion: 'P2-S07-AC-006,P2-S07-AC-051',
      makeRequest: () =>
        releaseRequest({ ...definitionRequest, precedence: ['user'] }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/precedence',
    },
    {
      criterion: 'P2-S07-AC-012,P2-S07-AC-054',
      makeRequest: () => effectiveRequest(`${effectiveQuery}&unexpected=1`),
      status: 400 as const,
      code: 'INVALID_REQUEST',
      message: 'The query parameters are invalid.',
      path: undefined,
    },
    {
      criterion: 'P2-S07-AC-018,P2-S07-AC-057',
      makeRequest: () => proposalRequest({ ...proposal, unknownField: true }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/',
    },
    {
      criterion: 'P2-S07-AC-018,P2-S07-AC-156',
      makeRequest: () =>
        proposalRequest({
          ...proposal,
          uploadIntent: { objectKey: 'caller-controlled', bytes: 'unsafe' },
        }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/',
    },
    {
      criterion: 'P2-S07-AC-018,P2-S07-AC-057',
      makeRequest: () => proposalRequest({ ...proposal, scopeType: 'tenant' }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/scopeType',
    },
    {
      criterion: 'P2-S07-AC-024,P2-S07-AC-060',
      makeRequest: () => actionRequest({ ...action, unknownField: true }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/',
    },
    {
      criterion: 'P2-S07-AC-024,P2-S07-AC-060',
      makeRequest: () => actionRequest({ ...action, action: 'schedule' }),
      status: 422 as const,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      path: '/scheduledFor',
    },
  ])(
    '[$criterion] rejects unknown or invalid Zod input before any configuration port call',
    async ({ makeRequest, status, code, message, path }) => {
      const harness = makeHarness();

      const response = await harness.app.request(makeRequest());

      expect(response.status).toBe(status);
      const body = (await response.json()) as {
        code: string;
        details: { violations?: readonly { path: string; message: string }[] };
        message: string;
      };
      expect(body.code).toBe(code);
      expect(body.message).toBe(message);
      if (path === undefined) {
        expect(body.details).toEqual({});
      } else {
        expect(body.details.violations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path,
              message: 'The value is invalid.',
            }),
          ]),
        );
      }
      expect(harness.port).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'P2-S07-AC-008',
      () => releaseRequest(definitionRequest, { 'idempotency-key': undefined }),
    ],
    [
      'P2-S07-AC-020',
      () => proposalRequest(proposal, { 'idempotency-key': undefined }),
    ],
    [
      'P2-S07-AC-026',
      () => actionRequest(action, { 'idempotency-key': undefined }),
    ],
  ] as const)(
    '[%s] rejects a mutation without Idempotency-Key before port execution',
    async (_criterion, makeRequest) => {
      const harness = makeHarness();

      const response = await harness.app.request(makeRequest());

      await expectError(
        response,
        400,
        'INVALID_REQUEST',
        'A valid Idempotency-Key is required.',
      );
      // BE00 step 8: the idempotency header follows authentication,
      // authorization and the quota, and always precedes the operation.
      expect(harness.port).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['P2-S07-AC-008', () => proposalRequest(proposal, { 'if-match': '1' })],
    ['P2-S07-AC-026', () => actionRequest(action, { 'if-match': '1' })],
  ] as const)(
    '[%s] rejects an unquoted If-Match version before the configuration port',
    async (_criterion, makeRequest) => {
      const harness = makeHarness();

      const response = await harness.app.request(makeRequest());

      await expectError(
        response,
        400,
        'INVALID_REQUEST',
        'A valid If-Match version is required.',
      );
      expect(harness.port).not.toHaveBeenCalled();
    },
  );
});
