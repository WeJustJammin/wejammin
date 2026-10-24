import { describe, expect, it, vi } from 'vitest';

import {
  createPatternUpdateRpc,
  type PatternUpdateRpcInput,
} from './cms-composition-production-pattern-update-rpc';
import {
  configuration,
  URL_,
} from './cms-composition-production-pattern-update-rpc.test-support';
import {
  puId,
  PU_REQUEST_ID,
} from './cms-composition/pattern-update.test-support';
import { puSession } from './cms-composition/pattern-update-routes.test-support';

/** Transport faults of the named-RPC caller that the base suite leaves open; same fakes, same boundary. */
const input: PatternUpdateRpcInput = {
  operationId: 'CMS-03C-13',
  request: new Request(URL_, { headers: { 'x-request-id': PU_REQUEST_ID } }),
  requestId: PU_REQUEST_ID,
  session: puSession(),
};
const make = (verify: unknown, fetchImpl: typeof fetch = vi.fn() as never) =>
  createPatternUpdateRpc(configuration(fetchImpl), verify as never, 15_000);
const payload = { contentTypeId: puId(1) };

describe('createPatternUpdateRpc faults', () => {
  it('an abort that lands between the verifier answering and the continuation is 504, not a call', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const rpc = make(
      () => ({
        // A thenable that settles the verifier first and aborts the caller in the same turn.
        then: (settle: (value: unknown) => void) => {
          settle({ ok: true, value: {} });
          controller.abort();
        },
      }),
      fetchImpl as never,
    );
    expect(await rpc(input, payload, controller.signal)).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 15,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an unserialisable payload is a retryable 503 and no call is made', async () => {
    const fetchImpl = vi.fn();
    const rpc = make(async () => ({ ok: true, value: {} }), fetchImpl as never);
    const result = await rpc(
      input,
      {
        toJSON: () => {
          throw new Error('cannot serialise');
        },
      },
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      retryAfterSeconds: 15,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a fault that lands after the caller aborted is a 504', async () => {
    const controller = new AbortController();
    const rpc = make(async () => ({ ok: true, value: {} }));
    const result = await rpc(
      input,
      {
        toJSON: () => {
          controller.abort();
          throw new Error('cannot serialise');
        },
      },
      controller.signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 15,
    });
  });

  it('a body that cannot be released does not change the decided answer', async () => {
    const response = new Response(
      new ReadableStream({
        cancel: () => Promise.reject(new Error('cancel refused')),
        start: (c) => c.enqueue(new Uint8Array([60])),
      }),
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    const rpc = make(
      async () => ({ ok: true, value: {} }),
      vi.fn(async () => response) as never,
    );
    expect(
      await rpc(input, payload, new AbortController().signal),
    ).toMatchObject({ ok: false, status: 502 });
  });
});
