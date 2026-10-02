import { ActingContextListResponseSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  S09_DISCLOSURE_LABEL,
  S09_DISCLOSURE_PARTY_ID,
  S09_DISCLOSURE_PROFILE_IDS,
  createS09DisclosureFixture,
} from './s09-disclosure-fixture';
import { verifyLocalSessionRequest } from './s09-session-authority';

const SESSION_SIGNING_SECRET = 's09-real-route-session-secret';
const USER_ID = '10000000-0000-4000-8000-000000000001';
const UNKNOWN_SESSION_ID = '80000000-0000-4000-8000-000000000099';
const T0 = Date.parse('2026-10-01T18:00:00.000Z');
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

const base64Url = (value: Uint8Array | string): string =>
  Buffer.from(value).toString('base64url');

const accessToken = async (
  options: Readonly<{
    sessionId?: string;
    sub?: string;
    exp?: number;
    forged?: boolean;
  }> = {},
): Promise<string> => {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      exp: options.exp ?? Math.floor(Date.now() / 1_000) + 3_600,
      session_id: options.sessionId ?? S09_DISCLOSURE_PROFILE_IDS.verified,
      sub: options.sub ?? USER_ID,
    }),
  );
  const signingInput = header + '.' + payload;
  const signature = options.forged
    ? 'forged-signature'
    : base64Url(
        new Uint8Array(
          await crypto.subtle.sign(
            'HMAC',
            await crypto.subtle.importKey(
              'raw',
              new TextEncoder().encode(SESSION_SIGNING_SECRET),
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign'],
            ),
            new TextEncoder().encode(signingInput),
          ),
        ),
      );
  return signingInput + '.' + signature;
};

const harnessRequest = (
  options: Readonly<{
    token?: string;
    includeReference?: boolean;
  }> = {},
): Request => {
  const cookies = [
    ...(options.includeReference === false ? [] : ['wj_session_ref=reference']),
    ...(options.token === undefined ? [] : ['wj_access=' + options.token]),
  ];
  return new Request(
    'https://platform-api.internal/api/v1/me/acting-contexts',
    { headers: cookies.length === 0 ? {} : { cookie: cookies.join('; ') } },
  );
};

afterEach(() => {
  vi.useRealTimers();
});

describe('local signed session verification keeps every authority guard', () => {
  it('returns the verified user and session id for a genuine signed token', async () => {
    const claim = await verifyLocalSessionRequest(
      USER_ID,
      new Set(),
      harnessRequest({ token: await accessToken() }),
    );
    expect(claim).toEqual({
      userId: USER_ID,
      sessionId: S09_DISCLOSURE_PROFILE_IDS.verified,
    });
  });

  it('rejects a missing reference cookie or missing access token', async () => {
    const token = await accessToken();
    expect(
      await verifyLocalSessionRequest(
        USER_ID,
        new Set(),
        harnessRequest({ token, includeReference: false }),
      ),
    ).toBeNull();
    expect(
      await verifyLocalSessionRequest(
        USER_ID,
        new Set(),
        harnessRequest({ includeReference: true }),
      ),
    ).toBeNull();
  });

  it('rejects forged, expired, revoked, wrong-user, and malformed tokens', async () => {
    const revoked = S09_DISCLOSURE_PROFILE_IDS.required;
    const cases: readonly [string, Request, ReadonlySet<string>][] = [
      [
        'forged',
        harnessRequest({ token: await accessToken({ forged: true }) }),
        new Set(),
      ],
      [
        'expired',
        harnessRequest({
          token: await accessToken({
            exp: Math.floor(Date.now() / 1_000) - 60,
          }),
        }),
        new Set(),
      ],
      [
        'revoked',
        harnessRequest({ token: await accessToken({ sessionId: revoked }) }),
        new Set([revoked]),
      ],
      [
        'wrong-user',
        harnessRequest({
          token: await accessToken({ sub: S09_DISCLOSURE_PARTY_ID }),
        }),
        new Set(),
      ],
      ['malformed', harnessRequest({ token: 'not-a-jwt' }), new Set()],
      [
        'non-local-session-id',
        harnessRequest({
          token: await accessToken({ sessionId: S09_DISCLOSURE_PARTY_ID }),
        }),
        new Set(),
      ],
    ];
    for (const [label, request, revokedSessionIds] of cases)
      expect(
        await verifyLocalSessionRequest(USER_ID, revokedSessionIds, request),
        label,
      ).toBeNull();
  });
});

describe('S09 disclosure fixture profiles', () => {
  it('maps only the three fixed profile ids and falls back to unknown', () => {
    const fixture = createS09DisclosureFixture();
    expect(fixture.profileFor(S09_DISCLOSURE_PROFILE_IDS.verified)).toBe(
      'verified',
    );
    expect(fixture.profileFor(S09_DISCLOSURE_PROFILE_IDS.required)).toBe(
      'required',
    );
    expect(fixture.profileFor(S09_DISCLOSURE_PROFILE_IDS.unavailable)).toBe(
      'unavailable',
    );
    expect(fixture.profileFor(UNKNOWN_SESSION_ID)).toBe('unknown');
    expect(fixture.profileFor('not-a-session')).toBe('unknown');
  });

  it('anchors verified freshness once per signed session and never renews it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const fixture = createS09DisclosureFixture();
    const first = fixture.stepUpFreshUntilFor(
      S09_DISCLOSURE_PROFILE_IDS.verified,
    );
    expect(first).toBe(new Date(T0 + FRESHNESS_WINDOW_MS).toISOString());

    vi.setSystemTime(T0 + 60_000);
    expect(
      fixture.stepUpFreshUntilFor(S09_DISCLOSURE_PROFILE_IDS.verified),
    ).toBe(first);
    vi.setSystemTime(T0 + 11 * 60_000);
    expect(
      fixture.stepUpFreshUntilFor(S09_DISCLOSURE_PROFILE_IDS.verified),
    ).toBe(first);
  });

  it('emits no step-up freshness for required, unavailable, or unknown sessions', () => {
    const fixture = createS09DisclosureFixture();
    for (const sessionId of [
      S09_DISCLOSURE_PROFILE_IDS.required,
      S09_DISCLOSURE_PROFILE_IDS.unavailable,
      UNKNOWN_SESSION_ID,
    ])
      expect(fixture.stepUpFreshUntilFor(sessionId)).toBeNull();
  });

  it('resolves the human label only for verified and required sessions', () => {
    const fixture = createS09DisclosureFixture();
    for (const claimSessionId of [
      S09_DISCLOSURE_PROFILE_IDS.verified,
      S09_DISCLOSURE_PROFILE_IDS.required,
    ]) {
      const session = fixture.mintIdentitySession(claimSessionId);
      const result = fixture.readActingContexts({ session });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(
        ActingContextListResponseSchema.safeParse(result.value).success,
      ).toBe(true);
      expect(result.value.projectionVersion).toBe('1');
      expect(result.value.nextCursor).toBeNull();
      expect(result.value.hasMore).toBe(false);
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]).toMatchObject({
        contextId: S09_DISCLOSURE_PARTY_ID,
        partyId: S09_DISCLOSURE_PARTY_ID,
        kind: 'organization',
        label: S09_DISCLOSURE_LABEL,
        avatarRef: null,
        selectable: true,
      });
      expect(
        Date.parse(result.value.items[0]?.authorityFreshUntil ?? ''),
      ).toBeGreaterThan(Date.now());
    }
  });

  it('fails closed with a sanitized 503 for unavailable and unknown sessions', () => {
    const fixture = createS09DisclosureFixture();
    for (const claimSessionId of [
      S09_DISCLOSURE_PROFILE_IDS.unavailable,
      UNKNOWN_SESSION_ID,
    ]) {
      const session = fixture.mintIdentitySession(claimSessionId);
      const result = fixture.readActingContexts({ session });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result).toMatchObject({
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    }
  });

  it('mints a distinct internal identity session per call without private ids', () => {
    const fixture = createS09DisclosureFixture();
    const first = fixture.mintIdentitySession(
      S09_DISCLOSURE_PROFILE_IDS.verified,
    );
    const second = fixture.mintIdentitySession(
      S09_DISCLOSURE_PROFILE_IDS.verified,
    );
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: S09_DISCLOSURE_PARTY_ID,
      accountState: 'active',
      personId: null,
      stepUpAt: null,
    });
  });
});
