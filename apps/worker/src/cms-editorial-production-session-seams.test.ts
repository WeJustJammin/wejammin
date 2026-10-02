// Session-resolution seam coverage for the CMS-03B editorial production
// adapter: fail-closed composition, session mapping, capability seams, and
// fail-closed error mapping. RPC-context derivation lives in the sibling file.
import { describe, it } from 'vitest';

import {
  compose,
  expect,
  PARTY_ID,
  portInput,
  request,
  USER_ID,
  vi,
} from './cms-editorial-production.test-support';
import {
  NOW,
  authenticationSession,
  resolveWith,
} from './cms-editorial-production-session-test-support';

describe('cms editorial session resolution', () => {
  it('keeps the composed RPC transport available after session setup', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession(),
    });
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
  });

  it('fails closed when no authentication seam is composed', async () => {
    const dependencies = compose(vi.fn() as unknown as typeof fetch, {
      now: () => NOW,
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('returns the caller-supplied resolveSession seam unchanged', async () => {
    const seam = vi.fn(async () => ({
      ok: true as const,
      value: {
        userId: USER_ID,
        actingPartyId: PARTY_ID,
        capabilities: ['cms.author'],
        mfaFresh: true,
      },
    }));
    const dependencies = compose(vi.fn() as unknown as typeof fetch, {
      resolveSession: seam as never,
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(seam).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it('maps a successful session into server-derived values', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession(),
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        userId: USER_ID,
        actingPartyId: PARTY_ID,
        capabilities: ['cms.author'],
        mfaFresh: true,
      },
    });
  });

  it('treats an aborted authentication call as a deadline', async () => {
    const { dependencies } = resolveWith(undefined, {});
    const seam = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const composed = compose(vi.fn() as unknown as typeof fetch, {
      now: () => NOW,
      auth: { resolveSession: seam as never },
    });
    const result = await composed.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(dependencies).toBeDefined();
    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it('fails closed when authentication throws unexpectedly', async () => {
    const seam = vi.fn(async () => {
      throw new Error('provider exploded');
    });
    const composed = compose(vi.fn() as unknown as typeof fetch, {
      now: () => NOW,
      auth: { resolveSession: seam as never },
    });
    const result = await composed.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(JSON.stringify(result)).not.toContain('provider exploded');
  });

  it('propagates a typed authentication failure', async () => {
    const { dependencies } = resolveWith({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'The authentication session is invalid.',
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('maps an unsupported authentication status to a 503', async () => {
    const { dependencies } = resolveWith({
      ok: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'too large',
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('rejects a non-active account state with a 403', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession({ accountState: 'suspended' }),
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('rejects an expired session with a 401 recovery action', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession({ expiresAt: '2026-09-26T11:00:00.000Z' }),
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      details: { recoveryAction: 'reauthenticate' },
    });
  });

  it('rejects a non-UUID actor identifier with a 401', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession({ authUserId: 'not-a-uuid' }),
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('fails closed when no capability seam is composed', async () => {
    const { dependencies } = resolveWith(
      { ok: true, value: authenticationSession() },
      { resolveCapabilities: undefined },
    );
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('rejects an invalid capability list', async () => {
    const { dependencies } = resolveWith(
      { ok: true, value: authenticationSession() },
      { resolveCapabilities: ['NotACapability'] },
    );
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('accepts a resolver-supplied capability list', async () => {
    const { dependencies } = resolveWith(
      { ok: true, value: authenticationSession() },
      { resolveCapabilities: () => ['cms.author', 'cms.publish'] },
    );
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { capabilities: ['cms.author', 'cms.publish'] },
    });
  });

  it('fails closed when the capability resolver throws', async () => {
    const { dependencies } = resolveWith(
      { ok: true, value: authenticationSession() },
      {
        resolveCapabilities: () => {
          throw new Error('capability store down');
        },
      },
    );
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('fails closed when an async resolver returns an invalid capability list', async () => {
    const { dependencies } = resolveWith(
      { ok: true, value: authenticationSession() },
      { resolveCapabilities: async () => ['NotACapability'] },
    );
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('treats a stale step-up proof as not fresh', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession({ stepUpAt: '2026-09-26T10:00:00.000Z' }),
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: true, value: { mfaFresh: false } });
  });

  it('treats an absent step-up proof as not fresh', async () => {
    const { dependencies } = resolveWith({
      ok: true,
      value: authenticationSession({ stepUpAt: null }),
    });
    const result = await dependencies.resolveSession(
      request(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: true, value: { mfaFresh: false } });
  });
});
