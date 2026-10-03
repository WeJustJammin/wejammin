import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkerContext } from '../index';
import {
  NOW,
  createWorld,
  mintJar,
  rpcRefusal,
  send,
  type Handler,
} from './dec111-composition.test-support';
import {
  BASE,
  type OperationNumber,
} from './dec111-wire-scenarios.test-support';
import { emitMfaOperation } from './mfa-telemetry';

/**
 * BE01a "Observability and Abuse Controls": 100% traces for enrollment,
 * removal and verification failures. Each failing request must leave exactly
 * one retained `identity.mfa.operation` event even when the sampler would drop
 * every unretained event (the real logger, with `Math.random` pinned just
 * below 1), and the event must be written as high-risk with the `always`
 * sampling class so a lower default sampling rate can never drop it.
 */
const EVENT = 'identity.mfa.operation';
const REQUESTS = 20;
let lines: Record<string, unknown>[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  lines = [];
  vi.spyOn(console, 'info').mockImplementation((entry: unknown) => {
    if (typeof entry === 'object' && entry !== null)
      lines.push(entry as Record<string, unknown>);
  });
  vi.spyOn(Math, 'random').mockReturnValue(0.999_999);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const providerDown: Handler = () => new Response('{}', { status: 500 });
const databaseDown: Handler = () => rpcRefusal('boom', 500);

const FAILURES: ReadonlyArray<
  readonly [string, OperationNumber, Record<string, Handler>]
> = [
  ['enrollment start', 17, { 'POST /auth/v1/factors': providerDown }],
  [
    'enrollment verification',
    18,
    { auth_mfa_enrollment_verify_prepare: databaseDown },
  ],
  ['factor removal', 19, { auth_mfa_removal_begin: databaseDown }],
  [
    'step-up verification',
    21,
    { auth_step_up_challenge_verify_prepare: databaseDown },
  ],
];

describe('100% retention of enrollment, removal and verification failure traces', () => {
  it.each(FAILURES)(
    '[P2-S09-AC-908] every failed %s request leaves one WARN identity.mfa.operation event with the sampler dropping everything unretained',
    async (_label, operation, handlers) => {
      const world = createWorld({ handlers });
      const jar = await mintJar({
        accessClaims: {
          aal: 'aal2',
          amr: [{ method: 'totp', timestamp: Math.floor(NOW / 1000) - 60 }],
        },
      });
      const statuses: number[] = [];
      for (let index = 0; index < REQUESTS; index += 1)
        statuses.push(
          (await send(world.app, { ...BASE[operation], jar })).status,
        );
      expect(statuses.every((status) => status === 503)).toBe(true);
      const events = lines.filter((line) => line.eventName === EVENT);
      expect(events).toHaveLength(REQUESTS);
      expect(events.every((event) => event.severity === 'WARN')).toBe(true);
      expect(
        events.every((event) => event.operation === `AUTH-API-${operation}`),
      ).toBe(true);
    },
  );
});

const contextFor = (operation: string, status: number) => {
  const logger = { warn: vi.fn(), info: vi.fn() };
  const values: Record<string, unknown> = {
    operation,
    correlationId: '22222222-2222-4222-8222-222222222222',
    requestId: '11111111-1111-4111-8111-111111111111',
    startedAt: Date.now(),
    logger,
  };
  const context = {
    get: (key: string) => values[key],
    res: new Response(JSON.stringify({ code: 'INTERNAL_ERROR', details: {} }), {
      status,
    }),
    req: {
      raw: new Request('https://api.example.test/api/v1/account/mfa/factors'),
    },
  } as unknown as WorkerContext;
  return { context, logger };
};

describe('traced MFA operations are written high-risk with the always sampling class', () => {
  it.each([
    ['enrollment start', 'AUTH-API-17'],
    ['enrollment verification', 'AUTH-API-18'],
    ['factor removal', 'AUTH-API-19'],
    ['step-up verification', 'AUTH-API-21'],
  ] as const)(
    '[P2-S09-AC-908] a failed %s is logged with highRisk true and samplingClass always',
    async (_label, operation) => {
      const { context, logger } = contextFor(operation, 500);
      await emitMfaOperation(context);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0]?.[1]).toStrictEqual({
        highRisk: true,
        samplingClass: 'always',
      });
    },
  );

  it.each([
    ['factor list', 'AUTH-API-16'],
    ['step-up challenge creation', 'AUTH-API-20'],
  ] as const)(
    '[P2-S09-AC-908] a failed %s is not marked high-risk',
    async (_label, operation) => {
      const { context, logger } = contextFor(operation, 500);
      await emitMfaOperation(context);
      expect(logger.warn.mock.calls[0]?.[1]).toStrictEqual({
        highRisk: false,
        samplingClass: 'always',
      });
    },
  );

  it('[P2-S09-AC-908] a successful traced operation is logged at info and is not high-risk', async () => {
    const { context, logger } = contextFor('AUTH-API-19', 200);
    await emitMfaOperation(context);
    expect(logger.info.mock.calls[0]?.[1]).toStrictEqual({
      highRisk: false,
      samplingClass: 'always',
    });
  });
});
