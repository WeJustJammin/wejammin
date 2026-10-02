import { afterEach, describe, expect, it, vi } from 'vitest';

import { authError } from '../authentication/boundary';
import { markMfaCircuitOpen } from '../authentication/mfa-provider-breaker';
import {
  RESET_ID,
  makeResetHarness,
  resetBody,
  resetRequest,
  resetResponse,
  stepUpAgo,
} from './admin-mfa-reset.test-support';
import {
  TARGET_ID,
  bindings,
  contextFor,
} from './phase-02-slice-08-worker.test-support';

/**
 * BE05b observability for CFG-05B-06: one `admin.mfa-factor.reset` event per
 * request carrying the reset id (when one exists), the target hash, the state,
 * the removed-factor count and the outcome, plus a closed `signal` that counts
 * denied, stale-step-up, reconciling and circuit-open requests. No factor
 * identifier, secret, token or reason text ever appears.
 */
afterEach(() => {
  vi.useRealTimers();
});

const run = async (options: Parameters<typeof makeResetHarness>[0] = {}) => {
  const harness = makeResetHarness(options);
  const response = await harness.app.fetch(resetRequest(), bindings);
  const events = harness.lines
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((event) => event.eventName === 'admin.mfa-factor.reset');
  return { harness, response, events };
};

const attributes = (event: Record<string, unknown> | undefined) =>
  (event?.attributes ?? {}) as Record<string, unknown>;

describe('CFG-05B-06 telemetry', () => {
  it('[P2-S09-AC-948] a completed reset logs the reset id, target hash, state, removed-factor count and outcome', async () => {
    const { harness, events } = await run();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outcome: 'success',
      operation: 'CFG-05B-06',
    });
    expect(attributes(events[0])).toMatchObject({
      resetId: RESET_ID,
      state: 'completed',
      removedFactorCount: 2,
      signal: 'completed',
    });
    expect(events[0]?.metrics).toStrictEqual({
      completed: 1,
      removedFactorCount: 2,
    });
    expect(attributes(events[0]).targetHash).toMatch(/^[0-9a-f]{64}$/u);
    const text = harness.lines.join('\n');
    for (const forbidden of [
      TARGET_ID,
      resetBody.reason,
      harness.session.authUserId,
    ])
      expect(text).not.toContain(forbidden);
  });

  it('[P2-S09-AC-948] a reconciling reset is counted by signal reconciling', async () => {
    const { events } = await run({
      port: async () => ({
        ok: true,
        value: resetResponse({ state: 'reconciling', removedFactorCount: 1 }),
      }),
    });
    expect(events).toHaveLength(1);
    expect(attributes(events[0])).toMatchObject({
      signal: 'reconciling',
      resetId: RESET_ID,
    });
  });

  it('[P2-S09-AC-948] a request without the capability is counted by signal denied and carries no reset id', async () => {
    const { events, harness } = await run({ context: contextFor([]) });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: 'rejected' });
    expect(attributes(events[0])).toMatchObject({ signal: 'denied' });
    expect(attributes(events[0])).not.toHaveProperty('resetId');
    expect(harness.port).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-948] a stale step-up is counted by signal stale_step_up', async () => {
    const { events } = await run({ session: stepUpAgo(601) });
    expect(events).toHaveLength(1);
    expect(attributes(events[0])).toMatchObject({ signal: 'stale_step_up' });
  });

  it('[P2-S09-AC-948] an open provider circuit is counted by signal circuit_open and a plain outage by identity_unavailable', async () => {
    const open = await run({
      port: async () =>
        markMfaCircuitOpen(
          authError(
            503,
            'IDENTITY_UNAVAILABLE',
            'The identity service is temporarily unavailable.',
          ),
        ),
    });
    expect(open.response.status).toBe(503);
    expect(open.events).toHaveLength(1);
    expect(open.events[0]).toMatchObject({ outcome: 'failure' });
    expect(attributes(open.events[0])).toMatchObject({
      signal: 'circuit_open',
    });
    const plain = await run({
      port: async () =>
        authError(
          503,
          'IDENTITY_UNAVAILABLE',
          'The identity service is temporarily unavailable.',
        ),
    });
    expect(attributes(plain.events[0])).toMatchObject({
      signal: 'identity_unavailable',
    });
  });

  it('[P2-S09-AC-948] a rate-limited request is counted by signal rate_limited', async () => {
    const { events } = await run({
      rateLimits: [
        {
          ok: true,
          value: {
            allowed: false,
            limit: 5,
            remaining: 0,
            resetAt: Math.floor(Date.now() / 1000) + 60,
          },
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(attributes(events[0])).toMatchObject({ signal: 'rate_limited' });
  });
});
