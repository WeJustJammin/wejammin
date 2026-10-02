import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_MFA_RESET_CAPABILITY,
  ADMIN_MFA_RESET_ROUTE,
  resolveAdminMfaResetPage,
} from './admin-mfa-reset-page-context';
import { resolvePlatformConfigurationPage } from './platform-configuration-context';
import type {
  PlatformConfigurationCapabilityResolutionInput,
  PlatformConfigurationPlatformApiBinding,
} from './platform-configuration-platform-api';
import type { MfaFactorsRead } from './step-up-mfa-read';
import {
  REQUEST_ID,
  factorsResource,
  pageRequest,
} from './step-up-mfa-context.test-support';

const ACTOR_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const PARTY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * A private binding shaped like production: identity and acting-context reads
 * answer over `fetch`, and the server-only authority bridge is the same
 * `resolveCapabilities` seam the real configuration resolver consumes.
 */
const SNAPSHOT_PATH = '/api/v1/admin/capability-snapshot';

type SnapshotUpstream = (request: Request) => Response | Promise<Response>;

const binding = (
  resolveCapabilities?: PlatformConfigurationPlatformApiBinding['resolveCapabilities'],
  snapshot?: SnapshotUpstream,
): PlatformConfigurationPlatformApiBinding =>
  ({
    fetch: vi.fn((input: RequestInfo | URL) => {
      const { pathname } = new URL((input as Request).url);
      if (pathname === SNAPSHOT_PATH && snapshot !== undefined)
        return Promise.resolve(snapshot(input as Request));
      if (pathname === '/api/v1/me/identity')
        return Promise.resolve(
          json({
            personId: ACTOR_ID,
            partyKind: 'person',
            accountState: 'active',
            version: '1',
            facets: [],
            aliases: [],
          }),
        );
      if (pathname === '/api/v1/me/acting-contexts')
        return Promise.resolve(
          json({
            projectionVersion: '1',
            items: [
              {
                contextId: PARTY_ID,
                partyId: PARTY_ID,
                kind: 'person',
                label: 'Verified context',
                avatarRef: null,
                selectable: true,
                authorityFreshUntil: '2026-09-03T00:00:00.000Z',
              },
            ],
            nextCursor: null,
            hasMore: false,
          }),
        );
      return Promise.reject(new Error(`unexpected upstream ${pathname}`));
    }),
    ...(resolveCapabilities === undefined ? {} : { resolveCapabilities }),
  }) as PlatformConfigurationPlatformApiBinding;

const freshMfa: MfaFactorsRead = {
  kind: 'ok',
  resource: factorsResource({
    stepUp: { fresh: true, freshUntil: '2026-10-02T12:10:00Z' },
  }),
  etagVersion: '4',
};

/** Resolve through the real production configuration resolver (no stubbed deps.resolveConfiguration). */
const resolve = (b: PlatformConfigurationPlatformApiBinding) =>
  resolveAdminMfaResetPage(
    {
      request: pageRequest(ADMIN_MFA_RESET_ROUTE),
      binding: b,
      requestId: REQUEST_ID,
    },
    {
      resolveConfiguration: resolvePlatformConfigurationPage,
      readMfa: () => Promise.resolve(freshMfa),
    },
  );

describe('resolveAdminMfaResetPage through the production configuration resolver', () => {
  it('renders for an actor whose acting-party-bound projection holds admin.identity.mfa_reset', async () => {
    const seen: PlatformConfigurationCapabilityResolutionInput[] = [];
    const result = await resolve(
      binding((input) => {
        seen.push(input);
        return input.actingPartyId === PARTY_ID
          ? [ADMIN_MFA_RESET_CAPABILITY]
          : [];
      }),
    );
    expect(result).toMatchObject({ kind: 'ready', variant: 'adminStepUp' });
    // Acting-party bound: the projection was requested for the verified
    // actor and party, never for caller-supplied identifiers.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      actorId: ACTOR_ID,
      actingPartyId: PARTY_ID,
    });
  });

  it('still answers the disclosure-safe 404 when the projection lacks the capability', async () => {
    expect(await resolve(binding(() => ['configuration.read']))).toEqual({
      kind: 'not_found',
    });
  });

  it('fails closed with 404 when no server-only projection bridge is configured', async () => {
    expect(await resolve(binding())).toEqual({ kind: 'not_found' });
  });

  it('keeps the empty snapshot for ordinary key-less reads that do not ask for the projection', async () => {
    const result = await resolvePlatformConfigurationPage({
      request: pageRequest('/app/platform-configuration-admin'),
      binding: binding(() => [ADMIN_MFA_RESET_CAPABILITY]),
      key: null,
      requestId: REQUEST_ID,
      surface: 'index',
    });
    expect(result).toMatchObject({
      kind: 'ready',
      page: { capabilitySnapshot: [] },
    });
  });
});

/**
 * Production shape: a Cloudflare service binding exposes only `fetch`, so the
 * capability bridge must be the protected Worker snapshot read, not a stub.
 */
describe('resolveAdminMfaResetPage through a fetch-only production binding', () => {
  const snapshot =
    (capabilities: readonly string[]): SnapshotUpstream =>
    () =>
      json({ capabilities });

  it('renders for an authorized admin using the protected Worker capability snapshot', async () => {
    const requests: Request[] = [];
    const b = binding(
      undefined,
      (request) => (
        requests.push(request),
        snapshot([ADMIN_MFA_RESET_CAPABILITY])(request)
      ),
    );
    expect(await resolve(b)).toMatchObject({
      kind: 'ready',
      variant: 'adminStepUp',
    });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.method).toBe('GET');
    expect(new URL(request!.url).search).toBe('');
    // Only the verified session cookies cross; never caller authority claims.
    expect(request?.headers.get('x-configuration-capabilities')).toBeNull();
  });

  it('answers 404 when the snapshot lacks the capability', async () => {
    expect(
      await resolve(binding(undefined, snapshot(['admin.inbox.read']))),
    ).toEqual({ kind: 'not_found' });
  });

  it.each([
    ['503 upstream', () => json({ code: 'DEPENDENCY_UNAVAILABLE' }, 503)],
    ['403 upstream', () => json({ code: 'FORBIDDEN' }, 403)],
    ['non-json body', () => new Response('x', { status: 200 })],
    [
      'malformed payload',
      () => json({ capabilities: 'admin.identity.mfa_reset' }),
    ],
    [
      'unknown extra field',
      () =>
        json({ capabilities: [ADMIN_MFA_RESET_CAPABILITY], actorId: ACTOR_ID }),
    ],
    ['thrown fetch', () => Promise.reject(new Error('down'))],
  ] as const)('fails closed with 404 on %s', async (_label, upstream) => {
    expect(await resolve(binding(undefined, upstream))).toEqual({
      kind: 'not_found',
    });
  });

  it('does not request the snapshot on ordinary key-less reads', async () => {
    const seen = vi.fn(snapshot([ADMIN_MFA_RESET_CAPABILITY]));
    const b = binding(undefined, seen);
    await resolvePlatformConfigurationPage({
      request: pageRequest('/app/platform-configuration-admin'),
      binding: b,
      key: null,
      requestId: REQUEST_ID,
      surface: 'index',
    });
    expect(seen).not.toHaveBeenCalled();
  });
});
