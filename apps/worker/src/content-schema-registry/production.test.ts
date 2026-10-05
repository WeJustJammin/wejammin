import { describe, expect, it, vi } from 'vitest';

import { CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS } from '@wejammin/contracts';

import { createProductionContentSchemaRegistryDependencies } from './production';
import {
  environment,
  USER_ID,
  PARTY_ID,
  REQUEST_ID,
  request,
  json,
  session,
  releasePrincipal,
  releaseHeaders,
  requestContext,
  options,
} from './production-test-support';

describe('S09 production content schema registry adapter', () => {
  it('derives authenticated capabilities and fresh step-up state from server authorities', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const resolveRequestContext = vi.fn(async () => requestContext);
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, {
        resolveRequestContext,
        now: () => Date.parse('2026-09-02T12:00:00.000Z'),
      }),
    );

    await expect(
      dependencies.resolveSession(request, new AbortController().signal),
    ).resolves.toEqual({ ok: true, value: session });
    expect(resolveRequestContext).toHaveBeenCalledWith(
      request,
      environment,
      expect.any(AbortSignal),
      expect.objectContaining({ authUserId: USER_ID, actingPartyId: PARTY_ID }),
    );
  });

  it.each(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)(
    'propagates the trusted server presentation scope %s without browser role input',
    async (presentationVariant) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
      const resolvePresentationVariant = vi.fn(async () => presentationVariant);
      const dependencies = createProductionContentSchemaRegistryDependencies(
        options(fetchImpl, { resolvePresentationVariant }),
      );

      await expect(
        dependencies.resolveSession(request, new AbortController().signal),
      ).resolves.toMatchObject({
        ok: true,
        value: { capabilities: session.capabilities, presentationVariant },
      });
      expect(resolvePresentationVariant).toHaveBeenCalledWith(
        expect.objectContaining({ authUserId: USER_ID }),
        request,
        environment,
        expect.any(AbortSignal),
      );
    },
  );

  it('keeps release verification injectable and preserves the exact rejected-principal boundary', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const verifier = vi.fn(async () => ({
      ok: false as const,
      status: 401 as const,
      code: 'INVALID_SIGNATURE',
      message: 'invalid signature',
      details: { sql: 'private' },
    }));
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, { verifyRelease: verifier }),
    );
    const input = {
      operationId: 'CMS-03A-05' as const,
      request,
      requestId: REQUEST_ID,
      rawBody: new Uint8Array([1, 2, 3]),
      headers: releaseHeaders,
    };
    await expect(
      dependencies.verifyRelease(input, new AbortController().signal),
    ).resolves.toMatchObject({ ok: false, status: 401 });
    expect(verifier).toHaveBeenCalledWith(input, expect.any(AbortSignal));

    const unavailable = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, { verifyRelease: undefined }),
    );
    await expect(
      unavailable.verifyRelease(input, new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('rejects injected release evidence that is not bound to the exact request bytes and headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const verifier = vi.fn(async () => ({
      ok: true as const,
      value: releasePrincipal,
    }));
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, { verifyRelease: verifier }),
    );
    const input = {
      operationId: 'CMS-03A-05' as const,
      request,
      requestId: REQUEST_ID,
      rawBody: new Uint8Array([1, 2, 3]),
      headers: releaseHeaders,
    };
    await expect(
      dependencies.verifyRelease(input, new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 502,
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('canonicalizes non-authentication verifier failures and never exposes verifier text', async () => {
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(
        vi.fn<typeof fetch>(async () => json([])),
        {
          verifyRelease: vi.fn(async () => ({
            ok: false as const,
            status: 403 as const,
            code: 'PRIVATE_POLICY_ERROR',
            message: 'private key registry and SQL details',
            details: { sql: 'secret' },
          })),
        },
      ),
    );
    const result = await dependencies.verifyRelease(
      {
        operationId: 'CMS-03A-05',
        request,
        requestId: REQUEST_ID,
        rawBody: new Uint8Array([1, 2, 3]),
        headers: releaseHeaders,
      },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
    expect(JSON.stringify(result)).not.toContain('private key registry');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
