import { describe, expect, it, vi } from 'vitest';

import { createProductionWorkerApp } from '../../apps/worker/src/index';
import {
  productionCookie,
  productionFetch,
  responseJson,
} from '../../apps/worker/src/platform-configuration/phase-02-slice-08-production.test-support';
import {
  ACTOR_ID,
  PARTY_ID,
  bindings,
  inboxResponse,
} from '../../apps/worker/src/platform-configuration/phase-02-slice-08-worker.test-support';
import { resolveAdminWorkspace } from '../../apps/web/src/server/admin-workspace-context';
import { resolvePlatformConfigurationPage } from '../../apps/web/src/server/platform-configuration-context';

/**
 * Production composition: the REAL Worker platform-configuration routes sit
 * behind the REAL web platform-api client. The only fakes are the Supabase
 * RPC transport under the Worker and the identity-authority reads (owned by
 * another slice). Nothing here injects a capability header or resolver, so a
 * capability a page needs must travel the way production carries it.
 */
const WEB_ORIGIN = 'https://app.wejammin.test';
const DEFINITION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';

const effectiveValue = {
  definitionId: DEFINITION_ID,
  definitionVersionId: VERSION_ID,
  key: 'web.theme',
  valueKind: 'boolean',
  ownerCapability: 'settings.profile.write',
  typedValue: true,
  sourceScope: 'platform',
  sourceSubjectId: null,
  sourceValueVersionId: null,
  isDefault: true,
  effectiveFrom: null,
  effectiveTo: null,
  evaluatedAt: '2026-09-02T03:00:00.000Z',
  evaluatorVersion: '7',
  correlationId: DEFINITION_ID,
  compatibility: 'exact',
} as const;

type Composition = Readonly<{
  binding: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  supabase: ReturnType<typeof vi.fn>;
}>;

const compose = (
  sessionCapabilities: readonly string[] | 'unavailable',
  inbox: unknown = inboxResponse,
): Composition => {
  const base = productionFetch(
    sessionCapabilities === 'unavailable'
      ? { invalid: true }
      : sessionCapabilities,
    sessionCapabilities === 'unavailable' ? 503 : 200,
  );
  const supabase = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const operation = new URL(String(input)).pathname.split('/').at(-1);
      if (operation === 'cfg_resolve_effective_value')
        return responseJson(effectiveValue);
      if (operation === 'admin_inbox') return responseJson(inbox);
      return base(input, init);
    },
  );
  const worker = createProductionWorkerApp(bindings, supabase as typeof fetch);
  return {
    supabase,
    binding: {
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const { pathname } = new URL(request.url);
        if (pathname === '/api/v1/me/identity')
          return responseJson({
            personId: ACTOR_ID,
            partyKind: 'person',
            accountState: 'active',
            version: '1',
            facets: [],
            aliases: [],
          });
        if (pathname === '/api/v1/me/acting-contexts')
          return responseJson({
            projectionVersion: '1',
            items: [
              {
                contextId: PARTY_ID,
                partyId: PARTY_ID,
                kind: 'person',
                label: 'Verified context',
                avatarRef: null,
                selectable: true,
                authorityFreshUntil: '2099-01-01T00:00:00.000Z',
              },
            ],
            nextCursor: null,
            hasMore: false,
          });
        return worker.fetch(request, bindings);
      },
    },
  };
};

const pageRequest = async (path: string): Promise<Request> =>
  new Request(`${WEB_ORIGIN}${path}`, {
    headers: { cookie: await productionCookie() },
  });

const settingsPage = async (composition: Composition) => {
  const result = await resolvePlatformConfigurationPage({
    request: await pageRequest(
      '/app/platform-configuration-admin?key=web.theme',
    ),
    binding: composition.binding,
    key: 'web.theme',
    requestId: '11111111-1111-4111-8111-111111111111',
    surface: 'index',
  });
  if (result.kind !== 'ready') throw new Error(`unexpected ${result.kind}`);
  return result.page;
};

const adminWorkspace = async (
  composition: Composition,
  tab: 'inbox' | 'capabilities' | 'audit',
) =>
  resolveAdminWorkspace({
    request: await pageRequest(`/app/platform-configuration-admin?tab=${tab}`),
    binding: composition.binding,
    tab,
    requestId: '11111111-1111-4111-8111-111111111111',
  });

const NON_ACTING_INBOX = {
  ...inboxResponse,
  items: inboxResponse.items.map((item) => ({ ...item, canAct: false })),
} as const;

describe('Slice 07 settings page through the production composition', () => {
  it('carries the Worker session capabilities to the settings registry, effective value and rollback affordances', async () => {
    const page = await settingsPage(
      compose(['settings.approve', 'settings.rollback', 'cms.editor']),
    );
    expect(page.state).toBe('ready');
    expect(page.effective?.key).toBe('web.theme');
    // Rollback authority and approval render as `full`, not a silently
    // disabled read-only page.
    expect(page.access).toBe('full');
    expect(page.capabilitySnapshot).toEqual(
      expect.arrayContaining(['settings.approve', 'settings.rollback']),
    );
    expect(page.capabilitySnapshot).not.toContain('cms.editor');
  });

  it('renders the editor affordance for a holder of the definition owner capability', async () => {
    const page = await settingsPage(compose(['settings.profile.write']));
    expect(page.state).toBe('ready');
    expect(page.effective?.key).toBe('web.theme');
    expect(page.access).toBe('full');
    expect(page.capabilitySnapshot).toEqual(['settings.profile.write']);
  });

  it('keeps a holder of a different settings capability read-only on a definition they do not own', async () => {
    const page = await settingsPage(compose(['settings.other.write']));
    expect(page.state).toBe('ready');
    expect(page.access).toBe('read-only');
  });

  it('does not treat the legacy settings.editor alias as editor authority', async () => {
    const page = await settingsPage(
      compose(['settings.editor', 'configuration.editor']),
    );
    expect(page.access).toBe('read-only');
  });

  it('fails closed to read-only with no capabilities when the Worker capability projection is unavailable', async () => {
    const page = await settingsPage(compose('unavailable'));
    expect(page.access).toBe('read-only');
    expect(page.capabilitySnapshot).toEqual([]);
  });

  it('never accepts a capability response header as authority', async () => {
    const composition = compose([]);
    const upstream = composition.binding.fetch;
    const page = await settingsPage({
      ...composition,
      binding: {
        fetch: async (input, init) => {
          const response = await upstream(input, init);
          const headers = new Headers(response.headers);
          headers.set('x-configuration-capabilities', 'settings.rollback');
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        },
      },
    });
    expect(page.access).toBe('read-only');
    expect(page.capabilitySnapshot).toEqual([]);
  });
});

describe('Slice 08 admin workspace through the production composition', () => {
  it.each(['inbox', 'capabilities', 'audit'] as const)(
    'grants the capability-grant holder the %s tab from the Worker session capabilities',
    async (tab) => {
      const workspace = await adminWorkspace(
        compose(
          ['admin.inbox.read', 'admin.capability.grant', 'admin.audit.read'],
          NON_ACTING_INBOX,
        ),
        tab,
      );
      expect(workspace.kind).toBe('ready');
      expect(workspace.capabilities).toEqual(
        expect.arrayContaining([
          'admin.inbox.read',
          'admin.capability.grant',
          'admin.audit.read',
        ]),
      );
      expect(workspace.access).toBe('full');
    },
  );

  it('keeps an inbox-only reader read-only and never leaks grant authority', async () => {
    const workspace = await adminWorkspace(
      compose(['admin.inbox.read'], NON_ACTING_INBOX),
      'capabilities',
    );
    expect(workspace.capabilities).toEqual(['admin.inbox.read']);
    expect(workspace.access).toBe('read-only');
  });

  it('fails closed to no capabilities when the Worker capability projection is unavailable', async () => {
    const composition = compose(
      ['admin.inbox.read', 'admin.capability.grant'],
      NON_ACTING_INBOX,
    );
    const upstream = composition.binding.fetch;
    const workspace = await adminWorkspace(
      {
        ...composition,
        binding: {
          fetch: async (input, init) => {
            const request =
              input instanceof Request ? input : new Request(input, init);
            return new URL(request.url).pathname ===
              '/api/v1/admin/capability-snapshot'
              ? new Response('{}', { status: 503 })
              : upstream(request);
          },
        },
      },
      'capabilities',
    );
    expect(workspace.capabilities).toEqual([]);
    expect(workspace.access).toBe('read-only');
  });

  it('never accepts a capability response header as authority', async () => {
    const composition = compose(['admin.inbox.read'], NON_ACTING_INBOX);
    const upstream = composition.binding.fetch;
    const workspace = await adminWorkspace(
      {
        ...composition,
        binding: {
          fetch: async (input, init) => {
            const response = await upstream(input, init);
            const headers = new Headers(response.headers);
            headers.set(
              'x-configuration-capabilities',
              'admin.capability.grant',
            );
            return new Response(response.body, {
              status: response.status,
              headers,
            });
          },
        },
      },
      'capabilities',
    );
    expect(workspace.capabilities).toEqual(['admin.inbox.read']);
    expect(workspace.access).toBe('read-only');
  });
});
