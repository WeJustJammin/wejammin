import { describe, expect, it, vi } from 'vitest';
import { createRequestId } from '@wejammin/contracts';

import {
  createContentSchemaRegistryPorts,
  resolveContentSchemaRegistryPage,
} from '../../server/content-schema-registry-context';
import { applyContentSchemaRegistryRecoveryHeaders } from '../../server/content-schema-registry-context-presentation';
import {
  ContentSchemaRegistryPlatformError,
  createContentSchemaRegistryPlatformPorts,
} from '../../server/content-schema-registry-platform-api';
import {
  ACTOR_ID,
  detail,
  PARTY_ID,
} from './content-schema-registry-server-test-values';

describe('content schema registry server boundaries', () => {
  const upstreamRequestId = createRequestId(ACTOR_ID);

  it('keeps rate limits exact and renders a safe inline error state', async () => {
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling'),
      route: 'list',
      ports: createContentSchemaRegistryPorts({
        verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
        now: () => 100,
        resolveAuthority: () => ({
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
        }),
        loadList: () => {
          throw new ContentSchemaRegistryPlatformError('rate_limited', 429, {
            apiError: {
              code: 'RATE_LIMITED',
              message: 'The registry is busy. Try again shortly.',
              requestId: upstreamRequestId,
              details: {},
            },
            retryAfterSeconds: 9,
            etag: '"5"',
          });
        },
        loadDetail: () => detail,
      }),
      requestId: ACTOR_ID,
    });

    expect(result).toMatchObject({
      kind: 'error',
      status: 429,
      page: {
        access: 'read-only',
        initialList: {
          status: 'error',
          error: { code: 'RATE_LIMITED' },
          retryable: true,
          httpStatus: 429,
          retryAfterSeconds: 9,
        },
      },
    });
    if (result.kind !== 'error') throw new Error('expected rate-limit error');
    expect(result.page).not.toHaveProperty('actorId');
    expect(result.page).not.toHaveProperty('actingPartyId');
    const headers = new Headers();
    applyContentSchemaRegistryRecoveryHeaders(headers, result.page);
    expect(headers.get('x-content-schema-registry-retryable')).toBe('true');
    expect(headers.get('retry-after')).toBe('9');
  });

  it('keeps dependency failures degraded with a truthful status', async () => {
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling'),
      route: 'list',
      ports: createContentSchemaRegistryPorts({
        verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
        now: () => 100,
        resolveAuthority: () => ({
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
        }),
        loadList: () => {
          throw new ContentSchemaRegistryPlatformError(
            'dependency_unavailable',
            503,
            { retryable: true, retryAfterSeconds: 5 },
          );
        },
        loadDetail: () => detail,
      }),
      requestId: ACTOR_ID,
    });

    expect(result).toMatchObject({
      kind: 'degraded',
      status: 503,
      page: {
        initialList: {
          status: 'degraded',
          code: 'DEPENDENCY_UNAVAILABLE',
          retryable: true,
          retryAfterSeconds: 5,
        },
      },
    });
  });

  it('keeps initial validation status, recovery metadata, and trusted authority context', async () => {
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling'),
      route: 'list',
      ports: createContentSchemaRegistryPorts({
        verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
        now: () => 100,
        resolveAuthority: () => ({
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
        }),
        loadList: () => {
          throw new ContentSchemaRegistryPlatformError(
            'validation_failed',
            422,
            {
              apiError: {
                code: 'VALIDATION_FAILED',
                message: 'Check the highlighted schema fields.',
                requestId: upstreamRequestId,
                details: {
                  currentVersion: '7',
                  violations: [{ path: '/limit' }],
                },
              },
              retryAfterSeconds: null,
              etag: '"7"',
            },
          );
        },
        loadDetail: () => detail,
      }),
      requestId: ACTOR_ID,
    });

    expect(result).toMatchObject({
      kind: 'error',
      status: 422,
      page: {
        access: 'read-only',
        initialList: {
          status: 'error',
          httpStatus: 422,
        },
      },
    });
    // FE03: the typed ApiError request id of the failed read reaches the
    // error state so the user can quote it; the page-level id never does.
    if (result.kind !== 'error') throw new Error('expected an error result');
    expect(result.page.initialList).toMatchObject({
      error: { requestId: upstreamRequestId },
    });
    expect(Object.keys(result.page)).not.toContain('requestId');
  });

  it('keeps a platform outage during session verification degraded', async () => {
    const ports = createContentSchemaRegistryPlatformPorts({
      fetch: vi.fn(async () => {
        throw new Error('platform unavailable');
      }),
    });
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.test/app/cms-content-modeling', {
        headers: { cookie: 'wj_access=opaque-session' },
      }),
      route: 'list',
      ports,
      requestId: ACTOR_ID,
    });

    expect(result).toMatchObject({
      kind: 'degraded',
      status: 503,
      page: {
        access: 'disabled',
        initialList: { status: 'degraded', httpStatus: 503 },
      },
    });
  });
});
