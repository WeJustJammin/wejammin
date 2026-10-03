/**
 * The combined per-user and per-party decision keeps whichever bucket leaves
 * the least room: a party refusal first, then the fewer remaining requests,
 * then the lower limit. The user bucket is always allowed when the party
 * bucket is consulted.
 */
import { describe, expect, it, vi } from 'vitest';

import type { AuthRateLimitInput } from '../authentication/types';
import type { WorkerBindings } from '../index';
import { createRateLimiter } from './production-rate';

const USER_ID = '10000000-0000-4000-8000-00000000000a';
const PARTY_ID = '20000000-0000-4000-8000-0000000000aa';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'rate-decisions',
  SUPABASE_SECRET_KEY: 'sb_secret_rate_decisions',
  SUPABASE_URL: 'https://supabase.example.test',
};

type Decision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

const decide = async (user: Decision, party: Decision) => {
  const limiter = vi.fn(async (input: AuthRateLimitInput) => ({
    ok: true as const,
    value: input.scope === 'party' ? party : user,
  }));
  const rateLimit = createRateLimiter({
    environment,
    auth: { rateLimit: limiter },
  } as never);
  const result = await rateLimit(
    {
      operationId: 'CMS-03A-09',
      request: new Request('https://api.example.test/cms'),
      actorId: USER_ID,
      actingPartyId: PARTY_ID,
      principalClass: 'human',
      rateClass: 'cms-definition-write',
      limit: user.limit,
      partyLimit: party.limit,
      windowSeconds: 60,
    } as never,
    new AbortController().signal,
  );
  expect(limiter).toHaveBeenCalledTimes(2);
  if (!result.ok) throw new Error('expected an allowed or refused decision');
  return result.value;
};

const decision = (
  limit: number,
  remaining: number,
  allowed = true,
): Decision => ({
  allowed,
  limit,
  remaining,
  resetAt: 1_757_000_000,
});

describe('combined user and party rate decision', () => {
  it('reports a party refusal over an allowed user decision', async () => {
    const party = decision(60, 0, false);
    await expect(decide(decision(30, 29), party)).resolves.toEqual(party);
  });

  it('keeps the bucket with fewer remaining requests', async () => {
    const user = decision(30, 2);
    const party = decision(60, 40);
    await expect(decide(user, party)).resolves.toEqual(user);
    const tighterParty = decision(60, 1);
    await expect(decide(user, tighterParty)).resolves.toEqual(tighterParty);
  });

  it('breaks a remaining tie by the lower limit, preferring the user on a full tie', async () => {
    const lowerLimitUser = decision(30, 10);
    await expect(decide(lowerLimitUser, decision(60, 10))).resolves.toEqual(
      lowerLimitUser,
    );
    const lowerLimitParty = decision(20, 10);
    await expect(decide(decision(30, 10), lowerLimitParty)).resolves.toEqual(
      lowerLimitParty,
    );
    const equalUser = decision(30, 10);
    await expect(decide(equalUser, decision(30, 10))).resolves.toBe(equalUser);
  });
});
