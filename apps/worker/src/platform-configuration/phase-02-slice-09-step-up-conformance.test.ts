import { createLogger } from '@wejammin/observability/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isFreshProof, stepUpRequiredError } from '../authentication/step-up';
import { createWorkerApp } from '../index';
import { isConfigurationStepUpFresh } from './admin-route-support';
import {
  bindings,
  capabilityRequest,
  makeHarness,
  sessionFor,
} from './phase-02-slice-08-worker.test-support';
import type { ConfigurationPort } from './types';

/**
 * BE00 "STEP_UP_REQUIRED is always HTTP 401 with recoveryAction step_up and
 * allowedMethods equal to the configured method ids", with the one DEC-111
 * freshness window (-30 s <= now - proof <= 600 s), for every platform
 * configuration operation that demands a recent step-up.
 */
afterEach(() => {
  vi.useRealTimers();
});

const NOW = Date.parse('2026-10-02T14:00:00Z');
const ago = (seconds: number): string =>
  new Date(Date.now() - seconds * 1000).toISOString();
const EXPECTED = stepUpRequiredError().details;

describe('platform configuration step-up window', () => {
  it.each([
    ['absent', null, false],
    ['just minted', 0, true],
    ['exactly 600 s old', 600, true],
    ['601 s old', 601, false],
    ['30 s ahead (tolerated skew)', -30, true],
    ['31 s ahead', -31, false],
  ] as const)(
    '[P2-S09-AC-885] %s matches the shared DEC-111 window',
    (_label, age, expected) => {
      const stepUpAt =
        age === null ? null : new Date(NOW - age * 1000).toISOString();
      expect(
        isConfigurationStepUpFresh({ ...sessionFor(), stepUpAt }, NOW),
      ).toBe(expected);
      expect(isFreshProof(stepUpAt, NOW)).toBe(expected);
    },
  );
});

describe('CFG-05B-04 step-up shortfall', () => {
  it.each([
    ['absent', null],
    ['601 s old', 601],
    ['31 s ahead', -31],
  ] as const)(
    '[P2-S09-AC-909] a %s proof is 401 STEP_UP_REQUIRED with recoveryAction and allowedMethods, never 403, before any port call',
    async (_label, age) => {
      const harness = makeHarness({
        session: {
          ...sessionFor(),
          stepUpAt: age === null ? null : ago(age),
        },
      });
      const response = await harness.app.fetch(capabilityRequest(), bindings);
      const body = (await response.json()) as {
        code: string;
        details: unknown;
      };
      expect(response.status).toBe(401);
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toStrictEqual(EXPECTED);
      expect(harness.ports.capabilityAction).not.toHaveBeenCalled();
    },
  );

  it('[P2-S09-AC-909] a proof 30 s in the future is accepted exactly like the DEC-111 verifier', async () => {
    const harness = makeHarness({
      session: { ...sessionFor(), stepUpAt: ago(-30) },
    });
    const response = await harness.app.fetch(capabilityRequest(), bindings);
    expect(response.status).toBe(201);
    expect(harness.ports.capabilityAction).toHaveBeenCalledTimes(1);
  });
});

describe('settings change step-up shortfall', () => {
  const definitionId = '018f2f72-4b5a-7c9d-8e1f-123456789abc';
  const proposal = {
    scopeType: 'party',
    scopeId: definitionId,
    environment: 'production',
    typedValue: true,
    interval: {
      effectiveFrom: '2026-09-02T03:00:00.000Z',
      effectiveTo: '2026-09-03T03:00:00.000Z',
    },
    expectedDefinitionVersion: '1',
    impactManifest: { consumers: ['web.profile'] },
    rollbackCandidate: false,
    reason: 'Enable the governed profile projection.',
    consumerKeys: ['web.profile'],
  } as const;

  it.each([
    ['absent', null],
    ['601 s old', 601],
  ] as const)(
    '[P2-S09-AC-909] a %s proof is 401 STEP_UP_REQUIRED with the registry details',
    async (_label, age) => {
      const port = vi.fn<ConfigurationPort>();
      const auth = {
        resolveSession: vi.fn(async () => ({
          ok: true as const,
          value: {
            ...sessionFor(),
            actingPartyId: definitionId,
            stepUpAt: age === null ? null : ago(age),
          },
        })),
        rateLimit: vi.fn(async () => ({
          ok: true as const,
          value: {
            allowed: true,
            limit: 100,
            remaining: 99,
            resetAt: 2_000_000_000,
          },
        })),
      };
      const app = createWorkerApp({
        auth: auth as never,
        captureException: () => undefined,
        createLogger: () =>
          createLogger({
            environment: 'test',
            release: 'step-up',
            service: 'worker',
          }),
        now: () => Date.now(),
        platformConfiguration: { proposeChange: port } as never,
      });
      const response = await app.request(
        new Request(
          `https://api.wejammin.test/api/v1/admin/settings/${definitionId}/changes`,
          {
            method: 'POST',
            headers: {
              origin: 'https://api.wejammin.test',
              authorization: 'Bearer verified-session',
              'content-type': 'application/json',
              'idempotency-key': 'step-up-proposal-001',
            },
            body: JSON.stringify(proposal),
          },
        ),
      );
      const body = (await response.json()) as {
        code: string;
        details: unknown;
      };
      expect(response.status).toBe(401);
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toStrictEqual(EXPECTED);
      expect(port).not.toHaveBeenCalled();
    },
  );
});
