import type { RevisionHistoryPage } from '@wejammin/contracts';

import type {
  CmsEditorialDependencies,
  CmsEditorialResult,
} from '../../../apps/worker/src/cms-editorial/types';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const ENTRY_ID = '30000000-0000-4000-8000-000000000030';
const VISIBLE_UNASSIGNED_ENTRY_ID = '30000000-0000-4000-8000-000000000032';
const FIRST_ID = '40000000-0000-4000-8000-000000000001';
const SECOND_ID = '40000000-0000-4000-8000-000000000002';
const HASH = 'a'.repeat(64);
const LEFT_HASH = 'b'.repeat(64);
const RIGHT_HASH = 'c'.repeat(64);
// Test-owned opaque cursor for the browser's one-row en-US window only. The
// private RPC's signed/keyset cursor is covered separately by pgTAP.
const NEXT_PAGE_CURSOR = 'fixture-cms07-en-us-limit-1-page-2';
const INSTANT = '2026-09-27T12:00:00.000Z';

const rows: RevisionHistoryPage['items'] = [
  {
    id: SECOND_ID,
    revisionNumber: '2',
    locale: 'en-US',
    state: 'submitted',
    contentHash: HASH,
    createdAt: INSTANT,
    authorClass: 'editor',
  },
  {
    id: FIRST_ID,
    revisionNumber: '1',
    locale: 'en-US',
    state: 'draft',
    contentHash: HASH,
    createdAt: INSTANT,
    authorClass: '<img src=x onerror=alert(1)>',
  },
];

const ok = <T>(value: T): CmsEditorialResult<T> => ({ ok: true, value });
const denied = (): CmsEditorialResult<never> => ({
  ok: false,
  status: 401,
  code: 'UNAUTHENTICATED',
  message: 'The authentication session is invalid.',
});
const unavailable = (): CmsEditorialResult<never> => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'CMS editorial persistence is temporarily unavailable.',
});
const forbidden = (): CmsEditorialResult<never> => ({
  ok: false,
  status: 403,
  code: 'FORBIDDEN',
  message: 'This entry is visible but the actor lacks its read assignment.',
});
const notFound = (): CmsEditorialResult<never> => ({
  ok: false,
  status: 404,
  code: 'NOT_FOUND',
  message: 'Entry not found.',
});

/** A test-owned history port; never evidence of Supabase RLS or hosted reads. */
export const createCmsEditorialHistoryFixture = (
  hasValidSession: (request: Request) => Promise<boolean>,
): CmsEditorialDependencies => ({
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
  ports: {
    appendRevision: async () => unavailable(),
    listRevisions: async (input) => {
      if (input.path.entryId === VISIBLE_UNASSIGNED_ENTRY_ID)
        return forbidden();
      if (input.path.entryId !== ENTRY_ID) return notFound();
      const paginationContext =
        input.query.limit === 1 &&
        input.query.locale === 'en-US' &&
        input.query.state === undefined &&
        input.query.compareRevisionId === undefined;
      if (
        input.query.cursor &&
        (input.query.cursor !== NEXT_PAGE_CURSOR || !paginationContext)
      )
        return {
          ok: false,
          status: 409,
          code: 'CONFLICT',
          message: 'History cursor is no longer valid.',
        };
      const items = rows.filter(
        (row) =>
          (input.query.state === undefined ||
            row.state === input.query.state) &&
          (input.query.locale === undefined ||
            row.locale === input.query.locale),
      );
      const compareId = input.query.compareRevisionId;
      if (compareId !== undefined && !rows.some((row) => row.id === compareId))
        return {
          ok: false,
          status: 404,
          code: 'NOT_FOUND',
          message: 'Revision not found.',
        };
      return ok<RevisionHistoryPage>({
        items: items.slice(
          input.query.cursor ? 1 : 0,
          (input.query.cursor ? 1 : 0) + input.query.limit,
        ),
        nextCursor:
          paginationContext && input.query.cursor === undefined
            ? NEXT_PAGE_CURSOR
            : null,
        pageVersion: '2',
        compare:
          compareId === undefined
            ? null
            : {
                leftRevisionId: compareId,
                rightRevisionId: SECOND_ID,
                changes: [
                  {
                    path: '/title',
                    kind: 'changed',
                    leftHash: LEFT_HASH,
                    rightHash: RIGHT_HASH,
                  },
                ],
              },
      });
    },
    getEntryDraft: async (input) =>
      input.path.entryId === VISIBLE_UNASSIGNED_ENTRY_ID
        ? forbidden()
        : input.path.entryId === ENTRY_ID
          ? unavailable()
          : notFound(),
  },
});
