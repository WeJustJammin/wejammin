import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  PROVIDER_FACTOR_ID,
  createWorld,
  iso,
  json,
  mintJar,
  rpcRefusal,
  send,
  type Handler,
  type World,
} from './dec111-composition.test-support';
import {
  BASE,
  P_DELETE,
  P_VERIFY,
  type OperationNumber,
} from './dec111-wire-scenarios.test-support';

/**
 * BE01a observability for MFA factors and step-up, through the production
 * composition: one `identity.mfa.operation` event per request carrying the
 * operation, the safe reason, step-up shortfalls, lockouts, provider latency
 * and circuit state and reconciling marks, as logs and metrics. Never a code,
 * secret, URI, token, factor or provider identifier.
 */
const EVENT = 'identity.mfa.operation';
let lines: Record<string, unknown>[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  lines = [];
  vi.spyOn(console, 'info').mockImplementation((entry: unknown) => {
    if (typeof entry === 'object' && entry !== null)
      lines.push(entry as Record<string, unknown>);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const operationEvents = () => lines.filter((line) => line.eventName === EVENT);
const attributes = (event: Record<string, unknown> | undefined) =>
  (event?.attributes ?? {}) as Record<string, unknown>;

const call = async (
  op: OperationNumber,
  handlers: Readonly<Record<string, Handler>> = {},
  jarOptions: Parameters<typeof mintJar>[0] = {},
  world: World = {},
) => {
  const harness = createWorld({ ...world, handlers });
  const response = await send(harness.app, {
    ...BASE[op],
    jar: await mintJar(jarOptions),
  });
  return { harness, response };
};

describe('MFA and step-up telemetry', () => {
  it('[P2-S09-AC-908] emits exactly one event per request with the operation and a safe outcome, and never a code, secret, token or provider id', async () => {
    const { response } = await call(21);
    expect(response.status).toBe(200);
    const events = operationEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      operation: 'AUTH-API-21',
      outcome: 'success',
    });
    expect(attributes(events[0])).toMatchObject({
      operationId: 'AUTH-API-21',
      stepUpRequired: false,
      lockout: false,
    });
    const text = JSON.stringify(lines);
    for (const secret of [
      '123456',
      'caller-access-token-secret',
      'caller-refresh-token-secret',
      PROVIDER_FACTOR_ID,
    ])
      expect(text).not.toContain(secret);
  });

  it('[P2-S09-AC-908] reports verification failures by reason and charges one verification-failure metric', async () => {
    const { response } = await call(21, {
      [P_VERIFY]: () =>
        json({ error_code: 'mfa_verification_failed', msg: 'x' }, 400),
    });
    expect(response.status).toBe(422);
    const [event] = operationEvents();
    expect(attributes(event)).toMatchObject({
      operationId: 'AUTH-API-21',
      reasonCode: 'code_incorrect',
    });
    expect(event?.metrics).toMatchObject({ verificationFailure: 1 });
    expect(event?.outcome).toBe('rejected');
  });

  it('[P2-S09-AC-908] counts STEP_UP_REQUIRED by operation', async () => {
    const { response } = await call(19, {}, { stepUpAt: iso(-601) });
    expect(response.status).toBe(401);
    const [event] = operationEvents();
    expect(attributes(event)).toMatchObject({
      operationId: 'AUTH-API-19',
      errorCode: 'STEP_UP_REQUIRED',
      stepUpRequired: true,
    });
    expect(event?.metrics).toMatchObject({ stepUpRequired: 1 });
  });

  it('[P2-S09-AC-908] reports lockouts', async () => {
    const { response } = await call(18, {
      auth_mfa_enrollment_verify_prepare: () =>
        rpcRefusal('MFA_VERIFICATION_LOCKED:742'),
    });
    expect(response.status).toBe(429);
    const [event] = operationEvents();
    expect(attributes(event)).toMatchObject({
      operationId: 'AUTH-API-18',
      lockout: true,
    });
    expect(event?.metrics).toMatchObject({ lockout: 1 });
  });

  it('[P2-S09-AC-908] reports provider latency and a closed circuit for a provider call', async () => {
    await call(21);
    const [event] = operationEvents();
    expect(attributes(event)).toMatchObject({ circuit: 'closed' });
    const metrics = event?.metrics as Record<string, number>;
    expect(metrics.providerCalls).toBe(1);
    expect(metrics.providerLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('[P2-S09-AC-908] reports an open circuit after five provider failures', async () => {
    const harness = createWorld({
      handlers: {
        [P_DELETE]: () => new Response('{}', { status: 500 }),
      },
    });
    const jar = await mintJar();
    for (let index = 0; index < 5; index += 1)
      await send(harness.app, { ...BASE[19], jar });
    lines = [];
    const refused = await send(harness.app, { ...BASE[19], jar });
    expect(refused.status).toBe(503);
    const [open] = operationEvents();
    expect(attributes(open)).toMatchObject({
      operationId: 'AUTH-API-19',
      circuit: 'open',
    });
    expect(open?.metrics).toMatchObject({ circuitOpen: 1 });
  });

  it('[P2-S09-AC-908] marks reconciling when a post-send provider timeout leaves the factor reconciling', async () => {
    const abortAtSend: Handler = () => {
      throw new DOMException('aborted', 'AbortError');
    };
    const { response } = await call(18, { [P_VERIFY]: abortAtSend });
    expect(response.status).toBe(504);
    const [event] = operationEvents();
    expect(attributes(event)).toMatchObject({
      operationId: 'AUTH-API-18',
      reconciling: true,
    });
    expect(event?.metrics).toMatchObject({ reconciling: 1 });
  });
});
