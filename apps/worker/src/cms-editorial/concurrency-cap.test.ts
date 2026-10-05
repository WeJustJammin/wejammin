// WP-S10-2b QA-RED: deterministic per-actor concurrency cap + rate-key isolation.
//
// BE03b locks two rules that the Worker does not yet satisfy:
//   * 03b line 1300: concurrent revision writes cap at three per actor; a fourth
//     concurrent write is refused with 429 before any insert, and the cap is
//     deterministic for one actor's session;
//   * 03b line 1300: rate buckets key the user bucket by actor and the party
//     bucket by acting party, so the two scopes never share a bucket.
//
// The report-only rate seam (cms-editorial-production-rate.ts bucketDigestFor)
// already keys the two scopes, so the digest tests pass as ready coverage. The
// cross-cutting cap on the composed append port does not exist, so the cap tests
// fail for the missing implementation.
import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsEditorialDependencies } from '../cms-editorial-production';
import { bucketDigestFor } from '../cms-editorial-production-rate';
import {
  ENTRY_ID,
  PARTY_ID,
  USER_ID,
  environment,
  portInput,
} from '../cms-editorial-production.test-support';

type DigestInput = Parameters<typeof bucketDigestFor>[0];

const rateInput = (overrides: Partial<DigestInput> = {}): DigestInput => ({
  operationId: 'CMS-03B-01',
  request: new Request(
    'https://api.example.test/api/v1/cms/entries/' + ENTRY_ID,
    { method: 'POST' },
  ),
  actorId: USER_ID,
  actingPartyId: PARTY_ID,
  principalClass: 'human',
  rateClass: 'cms-entry-write',
  limit: 120,
  windowSeconds: 60,
  rateScope: 'user',
  ...overrides,
});

const session = (userId: string) => ({
  userId,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.author'],
  mfaFresh: true,
});

/** A transport that never settles, so each admitted call stays in flight. */
const stalledFetch = () => vi.fn(() => new Promise<Response>(() => undefined));

const composeCap = (fetchImpl: typeof fetch) =>
  createProductionCmsEditorialDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    // Small deadline so abandoned in-flight calls settle as 504 instead of
    // keeping the process alive; the cap decision itself is synchronous.
    deadlineMs: 20,
  });

describe('CMS-03B-01 editorial rate-key isolation (existing coverage)', () => {
  it('derives a lowercase 64-hex sha-256 bucket digest', async () => {
    const digest = await bucketDigestFor(rateInput());
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('isolates the user and party buckets for the same actor', async () => {
    const user = await bucketDigestFor(rateInput({ rateScope: 'user' }));
    const party = await bucketDigestFor(rateInput({ rateScope: 'party' }));
    expect(user).not.toBe(party);
    const userAgain = await bucketDigestFor(rateInput({ rateScope: 'user' }));
    expect(userAgain).toBe(user);
  });

  it('keys distinct actors separately within one scope', async () => {
    const first = await bucketDigestFor(
      rateInput({ actorId: USER_ID, rateScope: 'user' }),
    );
    const second = await bucketDigestFor(
      rateInput({ actorId: PARTY_ID, rateScope: 'user' }),
    );
    expect(first).not.toBe(second);
  });
});

describe('CMS-03B-01 deterministic per-actor concurrency cap (RED)', () => {
  it('refuses a fourth concurrent revision write per actor before any RPC call', async () => {
    const fetchImpl = stalledFetch();
    const dependencies = composeCap(fetchImpl as unknown as typeof fetch);
    const append = dependencies.ports.appendRevision;
    const input = portInput();

    const inFlight = [0, 1, 2].map(() =>
      append(input, new AbortController().signal),
    );
    const fourth = await append(input, new AbortController().signal);

    expect(fourth).toMatchObject({
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    void inFlight;
  });

  it('applies the cap per actor rather than globally', async () => {
    const fetchImpl = stalledFetch();
    const dependencies = composeCap(fetchImpl as unknown as typeof fetch);
    const append = dependencies.ports.appendRevision;
    const actorA = portInput({ session: session(USER_ID) });
    const actorB = portInput({ session: session(PARTY_ID) });

    const aInFlight = [0, 1, 2].map(() =>
      append(actorA, new AbortController().signal),
    );
    const bInFlight = [0, 1, 2].map(() =>
      append(actorB, new AbortController().signal),
    );
    const aFourth = await append(actorA, new AbortController().signal);

    expect(aFourth).toMatchObject({ ok: false, status: 429 });
    // Both actors' first three writes were admitted (six RPC calls), so the
    // refusal is scoped to the actor that exceeded its own cap.
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    void aInFlight;
    void bInFlight;
  });
});
