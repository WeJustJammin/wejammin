import type { CmsLocaleReadInput } from './cms-composition/locale-routes';
import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

/** Shared fixtures of the `cms-composition-production-locale-related*.coverage.test.ts` suites. */
export const NOW = Date.parse('2026-09-27T12:00:00Z');
export const OTHER_USER = 'e0000000-0000-4000-8000-000000000099';
export const OTHER_PARTY = 'e0000000-0000-4000-8000-000000000098';

export const authority = {
  now: () => NOW,
  auth: {
    resolveSession: async () => ({
      ok: true as const,
      value: {
        authUserId: USER_ID,
        sessionId: '60000000-0000-4000-8000-000000000006',
        accountState: 'active' as const,
        personId: '70000000-0000-4000-8000-000000000007',
        actingPartyId: PARTY_ID,
        expiresAt: '2026-09-27T13:00:00Z',
        stepUpAt: null,
      },
    }),
  },
  resolveCapabilities: ['cms.author'],
};

export const signal = () => new AbortController().signal;
export const throwingResponse = (): Response =>
  new Proxy(Response.json({}), {
    get(target, property, receiver) {
      if (property === 'ok' || property === 'headers')
        throw new Error('provider private header');
      return Reflect.get(target, property, receiver);
    },
  });

export const localeReadInput = (request: Request): CmsLocaleReadInput => ({
  operationId: 'cmsLocaleVariantRead',
  request,
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  path: { entryId: 'd1000000-0000-4000-8000-000000000001', locale: 'fr-FR' },
});
