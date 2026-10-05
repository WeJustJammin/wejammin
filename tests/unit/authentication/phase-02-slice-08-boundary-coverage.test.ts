import { describe, expect, it, vi } from 'vitest';

import { AuthEmptyBodySchema } from '@wejammin/contracts';
import { parseJsonBody } from '../../../apps/worker/src/authentication/boundary';

const requestWithText = (text: () => string | Promise<string>): Request =>
  ({
    headers: new Headers({ 'content-type': 'application/json' }),
    text: vi.fn(() => {
      const value = text();
      return typeof value === 'string' ? Promise.resolve(value) : value;
    }),
  }) as unknown as Request;

/**
 * The boundary checks the signal at several synchronous and asynchronous
 * checkpoints, in this read order: 1 parseJsonBody entry, 2 readRequestText
 * entry, 3 the body read resolving, 4 after readRequestText, 5 after the size
 * check. (The former synchronous re-check after the abort listener was
 * installed was redundant: nothing awaits between it and the entry check.)
 * Returning true on a chosen read makes each checkpoint deterministic without
 * relying on event-loop timing.
 */
const signalAbortingOnRead = (abortOnRead: number): AbortSignal => {
  let reads = 0;
  return {
    get aborted(): boolean {
      reads += 1;
      return reads === abortOnRead;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as AbortSignal;
};

const expectTimeout = async (
  request: Request,
  signal: AbortSignal,
): Promise<void> => {
  await expect(
    parseJsonBody(request, AuthEmptyBodySchema, signal),
  ).resolves.toMatchObject({
    ok: false,
    status: 504,
    code: 'UPSTREAM_TIMEOUT',
  });
};

describe('Slice 08 authentication boundary coverage', () => {
  it('rejects an already-aborted body signal before reading the request', async () => {
    const controller = new AbortController();
    controller.abort();

    await expectTimeout(
      requestWithText(() => '{}'),
      controller.signal,
    );
  });

  it('handles a signal that aborts at the readRequestText entry checkpoint', async () => {
    await expectTimeout(
      requestWithText(() => '{}'),
      signalAbortingOnRead(2),
    );
  });

  it('handles a signal that aborts as the body read resolves', async () => {
    await expectTimeout(
      requestWithText(() => '{}'),
      signalAbortingOnRead(3),
    );
  });

  it('maps a synchronous request.text failure while an abort signal is active', async () => {
    await expect(
      parseJsonBody(
        requestWithText(() => {
          throw new Error('stream failed synchronously');
        }),
        AuthEmptyBodySchema,
        signalAbortingOnRead(99),
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('maps an asynchronous request.text rejection while an abort signal is active', async () => {
    await expect(
      parseJsonBody(
        requestWithText(() => Promise.reject(new Error('stream failed'))),
        AuthEmptyBodySchema,
        signalAbortingOnRead(99),
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('rejects when the signal aborts after reading but before the size check', async () => {
    await expectTimeout(
      requestWithText(() => '{}'),
      signalAbortingOnRead(4),
    );
  });

  it('rejects when the signal aborts after the body-size check', async () => {
    await expectTimeout(
      requestWithText(() => '{}'),
      signalAbortingOnRead(5),
    );
  });
});
