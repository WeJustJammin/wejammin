import type { LocaleVariantResource } from '@wejammin/contracts';

import type {
  CmsLocaleDependencies,
  CmsLocaleResult,
} from '../../../apps/worker/src/cms-composition/locale-routes';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const ENTRY_ID = 'd1000000-0000-4000-8000-000000000001';
const SOURCE_REVISION_ID = 'd1000000-0000-4000-8000-000000000002';
const INSTANT = '2026-09-27T12:00:00.000Z';

const ok = <T>(value: T): CmsLocaleResult<T> => ({ ok: true, value });
const denied = (): CmsLocaleResult<never> => ({
  ok: false,
  status: 401,
  code: 'UNAUTHENTICATED',
  message: 'The authentication session is invalid.',
});

/** Local in-memory port: exercises built HTTP routes, never Supabase or RLS. */
export const createCmsLocaleFixture = (
  hasValidSession: (request: Request) => Promise<boolean>,
): CmsLocaleDependencies => {
  let currentVersion = '1';
  return {
    humanOrigins: ['http://127.0.0.1:4324'],
    now: Date.now,
    resolveSession: async (request) =>
      (await hasValidSession(request))
        ? ok({
            userId: USER_ID,
            actingPartyId: '20000000-0000-4000-8000-000000000002',
            capabilities: ['cms.author'],
            mfaFresh: false,
          })
        : denied(),
    rateLimit: async (input) =>
      ok({
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000_000_000,
      }),
    authorLocale: async (input) => {
      if (
        input.path.entryId !== ENTRY_ID ||
        input.body.sourceRevisionId !== SOURCE_REVISION_ID
      )
        return {
          ok: false,
          status: 404,
          code: 'LOCALE_SOURCE_NOT_FOUND',
          message: 'Locale source not found.',
        };
      if (input.ifMatch !== currentVersion)
        return {
          ok: false,
          status: 409,
          code: 'LOCALE_VERSION_CONFLICT',
          message: 'Locale version changed.',
          details: {
            expectedVersion: input.ifMatch,
            currentVersion,
          },
        };
      currentVersion = String(BigInt(currentVersion) + 1n);
      const resource: LocaleVariantResource = {
        id: 'd1000000-0000-4000-8000-000000000004',
        version: currentVersion,
        contentHash: 'b'.repeat(64),
        createdAt: INSTANT,
        updatedAt: INSTANT,
        state: 'draft',
        entryId: ENTRY_ID,
        revisionId: `d1000000-0000-4000-8000-${currentVersion.padStart(12, '0')}`,
        locale: input.body.locale,
        sourceRevisionId: SOURCE_REVISION_ID,
        fallbackChain: input.body.fallbackChain,
        noFallbackFieldIds: input.body.noFallbackFieldIds,
      };
      return ok(resource);
    },
    telemetry: () => undefined,
  };
};
