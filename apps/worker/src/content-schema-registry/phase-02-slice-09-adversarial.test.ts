import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentSchemaRegistryResult } from './index';
import { dependencyDeadline } from './admission';

import {
  expectError,
  makeHarness,
  jsonRequest,
  readRequest,
  releaseHeaders,
  releaseRequest,
} from './phase-02-slice-09-adversarial-test-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  RELEASE_ORIGIN,
  REQUEST_ID,
  SIGNATURE,
  validDraft,
  validField,
  validRelation,
  ok,
} from './phase-02-slice-09-test-values';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('S09 adversarial worker admission and recovery', () => {
  it('[P2-S09-AC-216] rejects hostile human payloads before authority, rate, or persistence side effects', async () => {
    const attacks = [
      { ...validDraft, ownerCapability: 'javascript:alert(1)' },
      { ...validDraft, workflowKey: '${process.env.SECRET}' },
      {
        ...validDraft,
        fields: [{ ...validField, key: 'select;drop' }],
      },
      {
        ...validDraft,
        fields: [{ ...validField, constraints: { pattern: '(a+)+$' } }],
      },
      {
        ...validDraft,
        relations: [
          { ...validRelation, projectionKey: 'users;DROP TABLE users' },
        ],
      },
      {
        ...validDraft,
        relations: [{ ...validRelation, targetType: 'private/users' }],
      },
      {
        ...validDraft,
        capabilityBindings: [
          { capabilityKey: '__proto__', capabilityVersion: '1' },
        ],
      },
      { ...validDraft, unexpected: '<style>body{display:none}</style>' },
    ];

    for (const attack of attacks) {
      const harness = makeHarness();
      const before = structuredClone(attack);
      const response = await harness.app.request(
        jsonRequest('/api/v1/cms/content-types', attack),
      );
      await expectError(response, 422, 'VALIDATION_FAILED');
      expect(attack).toEqual(before);
      expect(harness.resolveSession).not.toHaveBeenCalled();
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.ports.createTypeDraft).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-216] rejects raw signature-byte fuzz and aliases before JSON parsing or verification', async () => {
    const malformed = [
      '',
      'A'.repeat(85) + '==',
      'A'.repeat(87) + '==',
      'A'.repeat(86) + '=',
      'A'.repeat(86) + '++',
      'A'.repeat(43) + '-'.repeat(43) + '==',
    ];
    for (const candidate of malformed) {
      const harness = makeHarness();
      const response = await harness.app.request(
        releaseRequest(
          '/api/v1/cms/blocks/versions',
          {},
          {
            'X-WeJammin-Release-Signature': candidate,
          },
        ),
      );
      await expectError(response, 400, 'INVALID_REQUEST');
      expect(harness.verifyRelease).not.toHaveBeenCalled();
      expect(harness.ports.registerBlock).not.toHaveBeenCalled();
    }

    const aliasHarness = makeHarness();
    const aliasResponse = await aliasHarness.app.request(
      releaseRequest(
        '/api/v1/cms/blocks/versions',
        {},
        {
          'x-release-signature': SIGNATURE,
        },
      ),
    );
    await expectError(aliasResponse, 400, 'INVALID_REQUEST');
    expect(aliasHarness.verifyRelease).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-216, P2-S09-AC-281] verifies exact raw bytes before parsing an invalid signed body', async () => {
    const harness = makeHarness();
    const raw = '{"blockKey":<not-json>}';
    const response = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/blocks/versions`, {
        method: 'POST',
        headers: {
          origin: RELEASE_ORIGIN,
          'content-type': 'application/json',
          'idempotency-key': 'release-test-key-001',
          'x-request-id': REQUEST_ID,
          ...releaseHeaders(),
        },
        body: raw,
      }),
    );
    await expectError(response, 400, 'INVALID_REQUEST');
    expect(harness.verifyRelease).toHaveBeenCalledWith(
      expect.objectContaining({ rawBody: new TextEncoder().encode(raw) }),
      expect.any(AbortSignal),
    );
    expect(harness.ports.registerBlock).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-214, P2-S09-AC-216] enforces CORS and preflight allowlists without wildcard credentials', async () => {
    const allowed = makeHarness();
    const response = await allowed.app.request(readRequest());
    expect(response.headers.get('access-control-allow-origin')).toBe(
      CMS_ORIGIN,
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(response.headers.get('vary')).toBe('Origin');
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const denied = makeHarness();
    const deniedResponse = await denied.app.request(
      readRequest('/api/v1/cms/content-types', {
        origin: 'https://evil.example',
      }),
    );
    await expectError(deniedResponse, 403, 'FORBIDDEN');
    expect(denied.ports.listContentTypes).not.toHaveBeenCalled();

    const preflight = makeHarness();
    const preflightResponse = await preflight.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'OPTIONS',
        headers: { origin: CMS_ORIGIN, 'x-request-id': REQUEST_ID },
      }),
    );
    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers.get('cache-control')).toBe('no-store');
    expect(
      preflightResponse.headers.get('access-control-allow-methods'),
    ).toContain('GET');

    const deniedPreflight = makeHarness();
    const deniedPreflightResponse = await deniedPreflight.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil.example',
          'x-request-id': REQUEST_ID,
        },
      }),
    );
    await expectError(deniedPreflightResponse, 403, 'FORBIDDEN');
  });

  it('[P2-S09-AC-214, P2-S09-AC-217] emits rate headers, Retry-After, no-store, and safe recovery for a denied request', async () => {
    const harness = makeHarness({
      rate: ok({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: 1_788_345_630,
      }),
    });
    const response = await harness.app.request(readRequest());
    const body = await expectError(response, 429, 'RATE_LIMITED');
    expect(response.headers.get('ratelimit-limit')).toBe('10');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('1788345630');
    expect(response.headers.get('retry-after')).toBe('30');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.details).toEqual({
      limit: 10,
      resetAt: '2026-09-02T10:40:30.000Z',
      retryAfterSeconds: 30,
    });
    expect(harness.ports.listContentTypes).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-214, P2-S09-AC-217] maps a hanging dependency to a deterministic 504 and aborts it', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = dependencyDeadline((signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<ContentSchemaRegistryResult<never>>(() => undefined);
    }, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toMatchObject({
      ok: false,
      status: 504,
      code: 'DEPENDENCY_DEADLINE_EXCEEDED',
    });
    expect(aborted).toBe(true);
  });
});
