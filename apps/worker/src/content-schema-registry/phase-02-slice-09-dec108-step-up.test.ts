import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { mapRpcFailure } from './production-errors';
import {
  createProductionContentSchemaRegistryDependencies,
  type ContentSchemaRegistryDependencies,
} from './production';
import type { ContentSchemaRegistryPortInput } from './types';
import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
  error,
  ok,
  validActivation,
} from './phase-02-slice-09-test-values';
import {
  makeDec108Harness,
  requestFor,
  sessionFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';
import { versionPath } from './phase-02-slice-09-dec108-test-values';

const STEP_UP_OPS = ['CMS-03A-12', 'CMS-03A-14'] as const;
const NO_STEP_UP_OPS = [
  'CMS-03A-09',
  'CMS-03A-10',
  'CMS-03A-11',
  'CMS-03A-13',
] as const;

const activateRequest = (headers: Record<string, string> = {}): Request =>
  new Request(`https://api.example.test${versionPath('activate')}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://cms-console.example.test',
      authorization: 'Bearer verified-session',
      'idempotency-key': 'cms-dec108-key-004',
      'if-match': '"1"',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(validActivation),
  });

describe('DEC-108 401 STEP_UP_REQUIRED (BE03a security: activation, decision, assignment)', () => {
  it.each(STEP_UP_OPS)(
    '%s without recent binding-bound MFA returns exactly 401 STEP_UP_REQUIRED and never reaches the port',
    async (operationId) => {
      const spec = specFor(operationId);
      const harness = makeDec108Harness({
        session: sessionResult(spec, { mfaFresh: false }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
      expect(body.requestId).toBe(REQUEST_ID);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(harness.ports[spec.portName]).not.toHaveBeenCalled();
    },
  );

  it('CMS-03A-04 keeps the same exact step-up details (regression guard)', async () => {
    const harness = makeDec108Harness({
      session: sessionResult(specFor('CMS-03A-09'), {
        mfaFresh: false,
      }),
    });
    const response = await harness.app.request(activateRequest());
    expect(response.status).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe('STEP_UP_REQUIRED');
    expect(body.details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
    expect(harness.ports['activateSchema']).not.toHaveBeenCalled();
  });

  it.each(STEP_UP_OPS)(
    '%s never answers a stale MFA with reauthenticate or 400/403',
    async (operationId) => {
      const spec = specFor(operationId);
      const harness = makeDec108Harness({
        session: sessionResult(spec, { mfaFresh: false }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('STEP_UP_REQUIRED');
      expect(text).not.toContain('reauthenticate');
    },
  );

  it.each(STEP_UP_OPS)(
    '%s reports a missing capability as 403 before it asks for step-up',
    async (operationId) => {
      const spec = specFor(operationId);
      const harness = makeDec108Harness({
        session: ok(sessionFor(spec, { capabilities: [], mfaFresh: false })),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(403);
    },
  );

  it.each(NO_STEP_UP_OPS)(
    '%s does not require step-up MFA (BE03a lists it only for 04, 12 and 14)',
    async (operationId) => {
      const spec = specFor(operationId);
      const harness = makeDec108Harness({
        session: sessionResult(spec, { mfaFresh: false }),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(response.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
    },
  );

  it.each(STEP_UP_OPS.map(specFor))(
    '$operationId forwards an RPC-raised STEP_UP_REQUIRED with only the allowlisted details',
    async (spec) => {
      const harness = makeDec108Harness({
        session: sessionResult(spec),
        port: error(
          401,
          'STEP_UP_REQUIRED',
          'Recent verification is required.',
          {
            recoveryAction: 'step_up',
            allowedMethods: ['totp', 'Bad Method!', 'x'.repeat(40)],
            sql: 'select 1',
          },
        ),
      });
      const response = await harness.app.request(requestFor(spec));
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
    },
  );
});

describe('DEC-108 STEP_UP_REQUIRED from the production RPC adapter', () => {
  const environment: WorkerBindings = {
    APP_ENVIRONMENT: 'staging',
    APP_RELEASE: 'slice-09-step-up',
    SUPABASE_SECRET_KEY: 'sb_secret_slice_09_step_up',
    SUPABASE_URL: 'https://supabase.example.test',
  };

  it.each([
    ['CMS-03A-12', 'decideSchemaReview'],
    ['CMS-03A-14', 'assignSchemaReview'],
  ] as const)(
    '%s maps an RPC 401 STEP_UP_REQUIRED body to the exact BE00 failure',
    async (operationId, portName) => {
      const fetchImpl = vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ message: 'STEP_UP_REQUIRED' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
      );
      const dependencies: ContentSchemaRegistryDependencies =
        createProductionContentSchemaRegistryDependencies({
          environment,
          fetchImpl,
          humanOrigins: ['https://cms.example.test'],
          releaseOrigins: ['https://release.example.test'],
        });
      const port = (
        dependencies.ports as unknown as Record<
          string,
          (
            input: ContentSchemaRegistryPortInput,
            signal: AbortSignal,
          ) => Promise<unknown>
        >
      )[portName];
      expect(typeof port).toBe('function');
      const result = await port?.(
        {
          operationId,
          requestId: REQUEST_ID,
          request: new Request('https://api.example.test/x'),
          session: {
            userId: USER_ID,
            actingPartyId: PARTY_ID,
            capabilities: ['cms.schema_review'],
            mfaFresh: true,
          },
          idempotencyKey: 'cms-dec108-key-001',
          ifMatch: '1',
        } as unknown as ContentSchemaRegistryPortInput,
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        ok: false,
        status: 401,
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      });
    },
  );

  it('maps the RPC failure body independent of operation (regression guard)', () => {
    expect(mapRpcFailure(401, { message: 'STEP_UP_REQUIRED' })).toMatchObject({
      status: 401,
      code: 'STEP_UP_REQUIRED',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });
});
