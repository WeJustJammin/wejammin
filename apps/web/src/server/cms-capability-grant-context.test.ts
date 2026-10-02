import { describe, expect, it } from 'vitest';

import {
  GRANT_ACTOR_ID,
  GRANT_CONTEXT_LABEL,
  GRANT_PARTY_ID,
  GRANT_STEP_UP_FRESH_UNTIL,
  grantBinding,
  grantPageRequest,
  resolveGrantPage,
} from './cms-capability-grant-context.test-support';
import {
  GRANT_ID,
  SUBJECT_ID,
  grantListPage,
  grantResource,
} from './cms-capability-grant.test-support';

/**
 * FE03 `/app/cms-content-modeling/capability-grants`: a protected server-first
 * owner console. The upstream CMS-03A-18 2xx is the only owner proof; an
 * authenticated non-owner is a 403, and no private identifier reaches the page.
 */

const pageOf = <T extends { kind: string }>(result: T) =>
  'page' in result ? (result.page as unknown as Record<string, unknown>) : null;

describe('[DEC-119] console guard', () => {
  it('[P2-S09-AC-1022] redirects an absent session without calling the platform', async () => {
    const { result, bound } = await resolveGrantPage(
      {},
      { request: grantPageRequest({ cookie: null }) },
    );
    expect(result.kind).toBe('unauthenticated');
    expect(bound.fetch).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-1022] treats an upstream 401 as an unauthenticated session', async () => {
    const { result } = await resolveGrantPage({
      status: 401,
      errorCode: 'UNAUTHENTICATED',
    });
    expect(result.kind).toBe('unauthenticated');
  });

  it('[P2-S09-AC-991] [P2-S09-AC-1022] reports an authenticated non-owner as forbidden with no data', async () => {
    const { result } = await resolveGrantPage({ status: 403 });
    expect(result).toStrictEqual({ kind: 'forbidden' });
  });

  it('conceals an upstream 404 as not_found', async () => {
    const { result } = await resolveGrantPage({
      status: 404,
      errorCode: 'NOT_FOUND',
    });
    expect(result).toStrictEqual({ kind: 'not_found' });
  });

  it('[P2-S09-AC-992] answers 502 degraded for a contract-invalid list and renders no rows', async () => {
    const { result } = await resolveGrantPage({ body: { items: [{ id: 1 }] } });
    expect(result.kind).toBe('degraded');
    const page = pageOf(result);
    expect(page?.access).toBe('disabled');
    expect(JSON.stringify(page)).not.toContain(SUBJECT_ID);
  });

  it.each([502, 503, 504])(
    '[P2-S09-AC-992] degrades on upstream %i with every command disabled',
    async (status) => {
      const { result } = await resolveGrantPage({ status, errorCode: 'X' });
      expect(result.kind).toBe('degraded');
      expect(pageOf(result)?.access).toBe('disabled');
    },
  );

  it('[P2-S09-AC-992] degrades when the binding is unreachable', async () => {
    const { result } = await resolveGrantPage({ throws: true });
    expect(result.kind).toBe('degraded');
  });

  it('keeps a 429 as a retryable error state', async () => {
    const { result } = await resolveGrantPage({
      status: 429,
      errorCode: 'RATE_LIMITED',
      retryAfter: '7',
    });
    expect(result.kind).toBe('error');
    const list = pageOf(result)?.initialList as Record<string, unknown>;
    expect(list.status).toBe('error');
    expect(list.retryable).toBe(true);
    expect(list.retryAfterSeconds).toBe(7);
  });
});

describe('[DEC-119] authorized owner page', () => {
  it('[P2-S09-AC-990] [P2-S09-AC-995] renders the first page of grants with the derived state', async () => {
    const { result } = await resolveGrantPage({
      body: grantListPage([
        grantResource(),
        grantResource({
          id: '8e5b04f7-2d91-7a6c-b3d8-1f70c4a95e26',
          state: 'lapsed',
        }),
      ]),
    });
    expect(result.kind).toBe('authorized');
    const page = pageOf(result);
    expect(page).toMatchObject({
      variant: 'ownerFull',
      access: 'full',
      state: 'ready',
      canonicalUrl: '/app/cms-content-modeling/capability-grants',
    });
    const list = page?.initialList as {
      status: string;
      data: { items: unknown[] };
    };
    expect(list.status).toBe('success');
    expect(list.data.items).toHaveLength(2);
  });

  it('[P2-S09-AC-996] is empty with no-records when no filter is set and filter-miss otherwise', async () => {
    const none = await resolveGrantPage({ body: grantListPage([]) });
    expect(pageOf(none.result)?.initialList).toStrictEqual({
      status: 'empty',
      reason: 'no-records',
    });
    const filtered = await resolveGrantPage(
      { body: grantListPage([]) },
      { request: grantPageRequest({ search: '?capability=cms.editor' }) },
    );
    expect(pageOf(filtered.result)?.initialList).toStrictEqual({
      status: 'empty',
      reason: 'filter-miss',
    });
  });

  it('computes the term window on the server (today through today plus 89)', async () => {
    const { result } = await resolveGrantPage();
    expect(pageOf(result)?.termWindow).toStrictEqual({
      minDate: '2026-10-02',
      maxDate: '2026-12-30',
    });
  });

  it('forwards only validated page-state filters upstream, never the person filter', async () => {
    const { bound } = await resolveGrantPage(
      {},
      {
        request: grantPageRequest({
          search: `?capability=cms.author&state=active&subjectPersonId=${SUBJECT_ID}&evil=1&sort=validThrough`,
        }),
      },
    );
    const read = bound.requests.find((request) =>
      request.url.includes('/api/v1/cms/capability-grants'),
    );
    const url = new URL(read?.url ?? '');
    expect(url.pathname).toBe('/api/v1/cms/capability-grants');
    expect(url.searchParams.get('capability')).toBe('cms.author');
    expect(url.searchParams.get('state')).toBe('active');
    expect(url.searchParams.get('sort')).toBe('validThrough');
    expect(url.searchParams.has('subjectPersonId')).toBe(false);
    expect(url.searchParams.has('evil')).toBe(false);
  });

  it('sends a no-store read carrying only session cookies', async () => {
    const { bound } = await resolveGrantPage(
      {},
      {
        request: grantPageRequest({
          cookie: 'wj_access=opaque; wj_csrf=csrf-cookie; tracking=omit',
        }),
      },
    );
    const read = bound.requests[0];
    expect(read?.method).toBe('GET');
    expect(read?.headers.get('cache-control')).toBe('no-store');
    expect(read?.headers.get('cookie')).toContain('wj_access=opaque');
    expect(read?.headers.get('cookie')).not.toContain('tracking');
  });

  it('carries the display label and the expiring step-up window only', async () => {
    const { result } = await resolveGrantPage();
    const page = pageOf(result);
    expect(page?.actingContextLabel).toBe(GRANT_CONTEXT_LABEL);
    expect(page?.stepUpState).toBe('verified');
    expect(page?.stepUpFreshUntil).toBe(GRANT_STEP_UP_FRESH_UNTIL);
  });

  it('[P2-S09-AC-1023] requires step-up when the Worker supplies no freshness window', async () => {
    const { result } = await resolveGrantPage({ omitStepUp: true });
    expect(pageOf(result)?.stepUpState).toBe('required');
    expect(pageOf(result)).not.toHaveProperty('stepUpFreshUntil');
  });

  it('carries the CSRF cookie value for native forms', async () => {
    const { result } = await resolveGrantPage();
    expect(pageOf(result)?.csrfToken).toBe('csrf-cookie');
  });

  it('never carries an actor, party, grantor or binding identifier', async () => {
    const { result } = await resolveGrantPage({
      body: grantListPage([grantResource({ id: GRANT_ID })]),
    });
    const serialized = JSON.stringify(pageOf(result));
    expect(serialized).not.toContain(GRANT_ACTOR_ID);
    expect(serialized).not.toContain(GRANT_PARTY_ID);
    expect(serialized).not.toMatch(/actorId|actingPartyId|bindingId|grantor/iu);
    // The subject is the one person identifier this owner-only page may carry.
    expect(serialized).toContain(SUBJECT_ID);
  });

  it('does not call the platform twice for the list', async () => {
    const { bound } = await resolveGrantPage();
    expect(
      bound.requests.filter((request) =>
        request.url.includes('/api/v1/cms/capability-grants'),
      ),
    ).toHaveLength(1);
  });
});

describe('[DEC-119] binding factory', () => {
  it('refuses to build ports over a missing service binding', async () => {
    const { createCmsCapabilityGrantPlatformPorts } =
      await import('./cms-capability-grant-platform-api');
    expect(() => createCmsCapabilityGrantPlatformPorts(undefined)).toThrow(
      TypeError,
    );
  });

  it('exposes a stable binding double for the other grant tests', () => {
    expect(grantBinding().binding.fetch).toBeTypeOf('function');
  });
});
