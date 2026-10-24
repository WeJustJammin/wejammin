import { describe, expect, it, vi } from 'vitest';

import { factsOf } from './observability-facts';
import { instrumentComposition } from './observability-instrument';

/*
 * [P2-S12-AC-264] The registration wrapper records the trace stages a request really reached and nothing else:
 * it passes every argument and result through unchanged and a result it cannot read never changes the route's
 * outcome (observation is non-authoritative).
 */

const request = (): Request => new Request('https://api.example.test/x');
const signal = new AbortController().signal;

type Deps = {
  resolveSession: (request: Request, signal: AbortSignal) => Promise<unknown>;
  write: (input: { request: Request }, signal: AbortSignal) => Promise<string>;
  read: (input: { request: Request }, signal: AbortSignal) => Promise<string>;
  now: () => number;
};

const deps = (overrides: Partial<Deps> = {}): Deps => ({
  resolveSession: async () => ({
    ok: true,
    value: { actingPartyId: 'party' },
  }),
  write: async () => 'written',
  read: async () => 'read',
  now: () => 7,
  ...overrides,
});

describe('instrumentComposition', () => {
  it('marks the principal stage and the acting context when the session resolver answers', async () => {
    const wrapped = instrumentComposition(deps(), { writes: ['write'] });
    const req = request();
    await wrapped.resolveSession(req, signal);
    expect(factsOf(req).stages).toEqual(['principal_assignment']);
    expect(factsOf(req).actingContext).toBe('party');
    const none = request();
    await instrumentComposition(
      deps({
        resolveSession: async () => ({
          ok: true,
          value: { actingPartyId: null },
        }),
      }),
      {},
    ).resolveSession(none, signal);
    expect(factsOf(none).actingContext).toBe('none');
  });

  it('marks idempotency and RPC for a write port and the RPC alone for a read port', async () => {
    const wrapped = instrumentComposition(deps(), {
      writes: ['write'],
      reads: ['read'],
    });
    const w = request();
    expect(await wrapped.write({ request: w }, signal)).toBe('written');
    expect(factsOf(w).stages).toEqual(['idempotency', 'rpc']);
    const r = request();
    expect(await wrapped.read({ request: r }, signal)).toBe('read');
    expect(factsOf(r).stages).toEqual(['rpc']);
  });

  it('passes the same arguments and the very same result through', async () => {
    const result = { ok: true, value: { actingPartyId: 'party' } };
    const resolveSession = vi.fn(async () => result);
    const write = vi.fn(async () => 'written');
    const wrapped = instrumentComposition(deps({ resolveSession, write }), {
      writes: ['write'],
    });
    const req = request();
    const input = { request: req };
    expect(await wrapped.resolveSession(req, signal)).toBe(result);
    await wrapped.write(input, signal);
    expect(resolveSession).toHaveBeenCalledWith(req, signal);
    expect(write).toHaveBeenCalledWith(input, signal);
    expect(wrapped.now()).toBe(7);
  });

  it('keeps an unnamed member untouched and marks nothing for it', () => {
    const original = deps();
    const wrapped = instrumentComposition(original, { writes: ['write'] });
    expect(wrapped.read).toBe(original.read);
    expect(wrapped.now).toBe(original.now);
  });

  it('never changes the outcome for a session result that throws on access (debug-by-test)', async () => {
    const hostile = new Proxy(
      { ok: true, value: {} },
      {
        get(target, key) {
          if (key === 'ok') throw new Error('private');
          return Reflect.get(target, key);
        },
      },
    );
    const wrapped = instrumentComposition(
      deps({ resolveSession: async () => hostile }),
      {},
    );
    const req = request();
    // The wrapper returns the hostile result untouched; the route's own envelope check owns the failure.
    expect(await wrapped.resolveSession(req, signal)).toBe(hostile);
    expect(factsOf(req).actingContext).toBeUndefined();
  });

  it('lets a rejected port propagate as it is', async () => {
    const wrapped = instrumentComposition(
      deps({
        write: async () => {
          throw new Error('provider down');
        },
      }),
      { writes: ['write'] },
    );
    await expect(wrapped.write({ request: request() }, signal)).rejects.toThrow(
      'provider down',
    );
  });

  it('ignores a port input without a Request instead of throwing', async () => {
    const wrapped = instrumentComposition(deps(), { writes: ['write'] });
    await expect(
      wrapped.write({} as { request: Request }, signal),
    ).resolves.toBe('written');
  });
});
