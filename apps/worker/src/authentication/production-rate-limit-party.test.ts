/**
 * A per-party bucket is the quota of a whole acting party, so it must not
 * depend on which client address a member's request arrives from. A user or
 * unauthenticated bucket keeps its client-address scope.
 */
import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { normalizeAuthProductionOptions } from './production-configuration';
import { createOperationalDependencies } from './production-rate-limit';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'rate-limit-party',
  SUPABASE_SECRET_KEY: 'sb_secret_rate_limit_party',
  SUPABASE_URL: 'https://supabase.example.test',
};
const USER = '10000000-0000-4000-8000-00000000000a';
const PARTY = '20000000-0000-4000-8000-0000000000aa';
const DIGEST = 'c'.repeat(64);

const bucketDigests = async (
  buckets: ReadonlyArray<
    Readonly<{ authUserId: string | null; actingPartyId: string | null }>
  >,
  address: string,
): Promise<readonly string[]> => {
  const fetchImpl = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          allowed: true,
          limit: 60,
          remaining: 59,
          resetAt: 1_757_000_000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  const dependencies = createOperationalDependencies(
    normalizeAuthProductionOptions({ environment, fetchImpl }),
  );
  for (const bucket of buckets)
    await dependencies.rateLimit(
      {
        operationId: 'CMS-03A-09',
        request: new Request('https://api.example.test/cms', {
          headers: { 'cf-connecting-ip': address },
        }),
        authUserId: bucket.authUserId,
        actingPartyId: bucket.actingPartyId,
        identifierDigest: DIGEST,
        limit: 60,
        windowSeconds: 60,
      },
      environment,
      new AbortController().signal,
    );
  return fetchImpl.mock.calls.map(
    ([, init]) =>
      (JSON.parse(String(init?.body)) as { p_bucket_digest: string })
        .p_bucket_digest,
  );
};

const scopedDigests = async (
  bucket: Readonly<{
    scope: 'party' | 'user';
    authUserId: string | null;
    actingPartyId: string | null;
  }>,
  address: string,
): Promise<readonly string[]> => {
  const fetchImpl = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          allowed: true,
          limit: 60,
          remaining: 59,
          resetAt: 1_757_000_000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  const dependencies = createOperationalDependencies(
    normalizeAuthProductionOptions({ environment, fetchImpl }),
  );
  await dependencies.rateLimit(
    {
      operationId: 'CMS-03A-09',
      request: new Request('https://api.example.test/cms', {
        headers: { 'cf-connecting-ip': address },
      }),
      ...bucket,
      identifierDigest: DIGEST,
      limit: 60,
      windowSeconds: 60,
    },
    environment,
    new AbortController().signal,
  );
  return fetchImpl.mock.calls.map(
    ([, init]) =>
      (JSON.parse(String(init?.body)) as { p_bucket_digest: string })
        .p_bucket_digest,
  );
};

describe('shared limiter bucket scope', () => {
  it('keys a party bucket (no user id, an acting party) independent of the client address', async () => {
    const party = [{ authUserId: null, actingPartyId: PARTY }] as const;
    const [first] = await bucketDigests(party, '203.0.113.7');
    const [second] = await bucketDigests(party, '198.51.100.9');
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).toBe(second);
  });

  it('still separates parties and keeps the user bucket distinct from the party bucket', async () => {
    const [partyA, partyB, user] = await bucketDigests(
      [
        { authUserId: null, actingPartyId: PARTY },
        {
          authUserId: null,
          actingPartyId: '20000000-0000-4000-8000-0000000000bb',
        },
        { authUserId: USER, actingPartyId: PARTY },
      ],
      '203.0.113.7',
    );
    expect(new Set([partyA, partyB, user]).size).toBe(3);
  });

  it('keeps a user bucket and an unauthenticated bucket scoped to the client address', async () => {
    const buckets = [
      { authUserId: USER, actingPartyId: PARTY },
      { authUserId: null, actingPartyId: null },
    ] as const;
    const near = await bucketDigests(buckets, '203.0.113.7');
    const far = await bucketDigests(buckets, '198.51.100.9');
    expect(near[0]).not.toBe(far[0]);
    expect(near[1]).not.toBe(far[1]);
  });

  it('keys an explicit user scope by operation and user only, ignoring party and address', async () => {
    const withScope = (
      address: string,
      actingPartyId: string | null,
    ): Promise<readonly string[]> =>
      scopedDigests(
        { scope: 'user', authUserId: USER, actingPartyId },
        address,
      );
    const [first] = await withScope('203.0.113.7', PARTY);
    const [second] = await withScope('198.51.100.9', null);
    expect(first).toBe(second);
  });

  it('keys an explicit party scope by operation and party only, ignoring user and address', async () => {
    const [first] = await scopedDigests(
      { scope: 'party', authUserId: null, actingPartyId: PARTY },
      '203.0.113.7',
    );
    const [second] = await scopedDigests(
      { scope: 'party', authUserId: USER, actingPartyId: PARTY },
      '198.51.100.9',
    );
    expect(first).toBe(second);
  });

  it('refuses a scoped bucket whose identity is missing instead of sharing one', async () => {
    const dependencies = createOperationalDependencies(
      normalizeAuthProductionOptions({
        environment,
        fetchImpl: vi.fn<typeof fetch>(),
      }),
    );
    for (const scope of ['user', 'party'] as const) {
      expect(
        await dependencies.rateLimit(
          {
            operationId: 'CMS-03A-09',
            request: new Request('https://api.example.test/cms'),
            scope,
            authUserId: null,
            actingPartyId: null,
            identifierDigest: null,
            limit: 60,
            windowSeconds: 60,
          },
          environment,
          new AbortController().signal,
        ),
      ).toMatchObject({ ok: false, status: 400 });
    }
  });
});
