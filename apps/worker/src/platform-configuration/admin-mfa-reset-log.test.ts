import { describe, expect, it, vi } from 'vitest';

import { logReset, type Trace } from './admin-mfa-reset-route';

const trace = (patch: Partial<Trace> = {}): Trace => ({
  authUserId: null,
  targetPersonId: null,
  failure: null,
  ...patch,
});

const logged = async (response: Response, patch: Partial<Trace> = {}) => {
  const info = vi.fn();
  const warn = vi.fn();
  const values: Readonly<Record<string, unknown>> = {
    correlationId: 'correlation',
    requestId: 'request',
    logger: { info, warn },
  };
  await logReset(
    { get: (key: string) => values[key] } as never,
    trace(patch),
    response,
    0,
    () => 5,
  );
  const call = [...info.mock.calls, ...warn.mock.calls][0];
  return call?.[0] as
    | Readonly<{
        attributes: Readonly<Record<string, unknown>>;
        metrics: Readonly<Record<string, number>>;
        outcome: string;
      }>
    | undefined;
};

const json = (value: unknown, status: number) =>
  new Response(JSON.stringify(value), { status });

describe('logReset signals and body reading', () => {
  it('counts a 202 as reconciling or completed from the reported state', async () => {
    expect(
      (await logged(json({ state: 'reconciling' }, 202)))?.attributes,
    ).toMatchObject({ signal: 'reconciling', state: 'reconciling' });
    expect(
      (await logged(json({ state: 'completed' }, 202)))?.attributes,
    ).toMatchObject({ signal: 'completed', state: 'completed' });
  });

  it('logs a response that is not JSON with no state or counts', async () => {
    const event = await logged(
      new Response('upstream exploded', { status: 500 }),
    );
    expect(event?.attributes).toMatchObject({
      signal: 'failed',
      state: null,
      removedFactorCount: null,
    });
    expect(event?.outcome).toBe('failure');
    expect(event?.metrics).toEqual({ failed: 1 });
  });

  it.each(['null', '7', '"text"'])(
    'treats the JSON scalar %s as an empty body',
    async (body) => {
      const event = await logged(new Response(body, { status: 400 }));
      expect(event?.attributes).toMatchObject({
        signal: 'rejected',
        state: null,
      });
    },
  );

  it('maps a failure body without a code by status alone', async () => {
    expect((await logged(json({}, 403)))?.attributes).toMatchObject({
      signal: 'denied',
    });
    expect((await logged(json({}, 401)))?.attributes).toMatchObject({
      signal: 'rejected',
    });
    expect((await logged(json({}, 429)))?.attributes).toMatchObject({
      signal: 'rate_limited',
    });
  });
});
