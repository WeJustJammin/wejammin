import { describe, expect, it, vi } from 'vitest';

import { emitMfaOperation } from './mfa-telemetry';

type Logged = Readonly<{
  attributes: Readonly<{ errorCode: unknown; reasonCode: unknown }>;
}>;

const emit = async (status: number, body: string) => {
  const info = vi.fn();
  const warn = vi.fn();
  const values: Readonly<Record<string, unknown>> = {
    operation: 'AUTH-API-18',
    correlationId: 'correlation',
    requestId: 'request',
    startedAt: Date.now(),
    logger: { info, warn },
  };
  const context = {
    get: (key: string) => values[key],
    res: new Response(body, { status }),
    req: { raw: new Request('https://api.example.test/') },
  };
  await emitMfaOperation(context as never);
  const call = [...warn.mock.calls, ...info.mock.calls][0];
  return call?.[0] as Logged | undefined;
};

describe('emitMfaOperation response-body reading', () => {
  it('reports no codes when a failure body is not JSON', async () => {
    const logged = await emit(500, 'upstream exploded');
    expect(logged?.attributes).toMatchObject({
      errorCode: null,
      reasonCode: null,
    });
  });

  it.each(['null', '"text"', '7'])(
    'reports no codes when the failure body is the JSON scalar %s',
    async (body) => {
      const logged = await emit(502, body);
      expect(logged?.attributes).toMatchObject({
        errorCode: null,
        reasonCode: null,
      });
    },
  );

  it('derives the reason from the first violation code and ignores a violation without one', async () => {
    const withCode = await emit(
      422,
      JSON.stringify({
        code: 'VALIDATION_FAILED',
        details: { violations: [{ code: 'code_incorrect' }] },
      }),
    );
    expect(withCode?.attributes).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      reasonCode: 'code_incorrect',
    });
    const withoutCode = await emit(
      422,
      JSON.stringify({
        code: 'VALIDATION_FAILED',
        details: { violations: [{ path: '/code' }] },
      }),
    );
    expect(withoutCode?.attributes).toMatchObject({ reasonCode: null });
    const empty = await emit(
      422,
      JSON.stringify({
        code: 'VALIDATION_FAILED',
        details: { violations: [] },
      }),
    );
    expect(empty?.attributes).toMatchObject({ reasonCode: null });
  });
});
