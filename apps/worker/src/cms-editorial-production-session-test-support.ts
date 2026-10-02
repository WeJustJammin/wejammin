import type { AuthenticationSession } from './authentication/types';
import {
  compose,
  json,
  PARTY_ID,
  revisionResource,
  USER_ID,
  vi,
} from './cms-editorial-production.test-support';

export { USER_ID } from './cms-editorial-production.test-support';

export const NOW = Date.parse('2026-09-26T12:00:00.000Z');
export const SESSION_ID = '60000000-0000-4000-8000-000000000006';
export const PERSON_ID = '70000000-0000-4000-8000-000000000007';

export const authenticationSession = (
  overrides: Partial<AuthenticationSession> = {},
): AuthenticationSession => ({
  authUserId: USER_ID,
  sessionId: SESSION_ID,
  accountState: 'active',
  personId: PERSON_ID,
  actingPartyId: PARTY_ID,
  expiresAt: '2026-09-26T13:00:00.000Z',
  stepUpAt: '2026-09-26T11:55:00.000Z',
  ...overrides,
});

export const resolveWith = (
  value: unknown,
  overrides: Record<string, unknown> = {},
) => {
  const resolveSession = vi.fn(async () => value);
  return {
    resolveSession,
    dependencies: compose(
      vi.fn(async () => json(revisionResource, 201)) as unknown as typeof fetch,
      {
        now: () => NOW,
        auth: { resolveSession: resolveSession as never },
        resolveCapabilities: ['cms.author'],
        ...overrides,
      },
    ),
  };
};
