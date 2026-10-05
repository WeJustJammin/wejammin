import { describe, expect, it, vi } from 'vitest';

import { CreateOrganizationRequestSchema } from '@wejammin/contracts';

import {
  ORIGIN,
  REQUEST_ID,
  bindings,
} from '../authentication/phase-02-slice-02.test-fixtures';
import {
  createApp,
  failure,
} from '../authentication/phase-02-slice-02.test-support';
import type { AuthenticationDependencies } from '../authentication/types';
import type { WorkerContext, WorkerDependencies } from '../index';
import {
  enforceRelationshipRate,
  parseRelationshipJsonBody,
  resolveRelationshipSession,
} from './relationship-handler-support';

const request = (): Request =>
  new Request(`${ORIGIN}/coverage-rate`, {
    headers: { origin: ORIGIN, 'x-request-id': REQUEST_ID },
  });

const rateResponse = async (
  rateLimit: AuthenticationDependencies['rateLimit'],
): Promise<Response> => {
  const { app, auth } = createApp({ rateLimit });
  app.get('/coverage-rate', async (context) => {
    const response = await enforceRelationshipRate(
      context,
      { auth } as unknown as WorkerDependencies,
      'ORG-01',
      null,
    );
    return response ?? context.text('unlimited');
  });
  return app.fetch(request(), bindings);
};

describe('Phase 2 Slice 04 relationship-support coverage', () => {
  it('preserves a non-validation body-parser error', async () => {
    const parsed = await parseRelationshipJsonBody(
      new Request(`${ORIGIN}/api/v1/organizations`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'self_member', typeCodes: ['band'] }),
      }),
      CreateOrganizationRequestSchema,
    );

    expect(parsed).toMatchObject({
      ok: false,
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      details: { allowedMediaTypes: ['application/json'] },
    });
  });

  it('fails closed when session authority is not configured', async () => {
    await expect(
      resolveRelationshipSession(
        null as unknown as WorkerContext,
        {} as WorkerDependencies,
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('skips relationship rate limiting when auth is not configured', async () => {
    await expect(
      enforceRelationshipRate(
        null as unknown as WorkerContext,
        {} as WorkerDependencies,
        'ORG-01',
        null,
      ),
    ).resolves.toBeNull();
  });

  it('preserves a typed rate-limit failure', async () => {
    const response = await rateResponse(
      vi.fn(async () =>
        failure(409, 'AUTHORITY_STALE', 'The authority changed.'),
      ),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTHORITY_STALE',
    });
  });

  it('maps a direct rate abort to the deadline boundary', async () => {
    const response = await rateResponse(
      vi.fn(async () =>
        Promise.reject(new DOMException('aborted', 'AbortError')),
      ),
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_TIMEOUT',
    });
  });

  it('preserves a typed error thrown by the rate adapter', async () => {
    const typedFailure = failure(
      409,
      'AUTHORITY_STALE',
      'The authority changed.',
    );
    const response = await rateResponse(
      vi.fn(async () => Promise.reject(typedFailure)),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTHORITY_STALE',
    });
  });
});
