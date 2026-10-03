import type { ActingContextListResource } from '@wejammin/contracts';

import type {
  AuthenticationResult,
  AuthenticationSession,
} from '../../../apps/worker/src/authentication/types';
import type { ContentSchemaRegistryPorts } from '../../../apps/worker/src/content-schema-registry/types';
import type { WorkerDependencies } from '../../../apps/worker/src/index';

import { laneAdminWorkspace, laneRequestContext } from './s09-lane-admin';
import {
  authenticationSessionFor,
  laneClaimOf,
  registrySessionFor,
  verifyLaneRequest,
} from './s09-lane-auth';
import { laneGrantPorts } from './s09-lane-grants';
import {
  LANE_ACTING_LABEL,
  LANE_ACTING_PARTY_ID,
  isLaneUserId,
  lanePersonId,
  laneRoleOfUser,
  type LaneRole,
} from './s09-lane-ids';
import { laneJobs } from './s09-lane-jobs';
import { armAmbiguousVerify, laneMfaMethods } from './s09-lane-mfa';
import { laneRegistryPorts } from './s09-lane-registry';
import { iso, worldFor } from './s09-lane-world';
import type { LaneRole } from './s09-lane-ids';

/**
 * Composition of the stateful lane over the legacy static Worker fixture.
 * A request carrying a verified lane cookie pair is served by the lane ports;
 * every other request keeps the previous behavior byte for byte.
 */

type AnyPort = (input: never, signal: AbortSignal) => Promise<unknown>;

/** Per-call dispatch: lane when the request is a lane session, else legacy. */
export const dispatchRegistryPorts = (
  legacy: ContentSchemaRegistryPorts,
): ContentSchemaRegistryPorts => {
  const lane = {
    ...laneRegistryPorts,
    ...laneGrantPorts,
  } as unknown as Record<string, AnyPort>;
  const legacyPorts = legacy as unknown as Record<string, AnyPort>;
  const merged: Record<string, AnyPort> = {};
  // Ports only the lane implements answer a non-lane session like the legacy
  // fixture does for an unwired port: persistence temporarily unavailable.
  for (const name of new Set([
    ...Object.keys(legacyPorts),
    ...Object.keys(lane),
  ])) {
    const legacyPort = legacyPorts[name];
    const lanePort = lane[name];
    merged[name] =
      lanePort === undefined
        ? (legacyPort as AnyPort)
        : (input, signal) =>
            laneClaimOf((input as unknown as { request: Request }).request) !==
              null || legacyPort === undefined
              ? lanePort(input, signal)
              : legacyPort(input, signal);
  }
  return merged as unknown as ContentSchemaRegistryPorts;
};

export const laneActingContexts =
  (): AuthenticationResult<ActingContextListResource> => ({
    ok: true,
    value: {
      projectionVersion: '1',
      items: [
        {
          contextId: LANE_ACTING_PARTY_ID,
          partyId: LANE_ACTING_PARTY_ID,
          kind: 'organization',
          label: LANE_ACTING_LABEL,
          avatarRef: null,
          selectable: true,
          authorityFreshUntil: iso(Date.now() + 3_600_000),
        },
      ],
      nextCursor: null,
      hasMore: false,
    },
  });

type LegacyDependencies = Readonly<{
  auth: unknown;
  identityAuthority: unknown;
}>;

/** Dependencies the lane adds or wraps on top of the legacy composition. */
export const laneDependencies = (
  legacy: LegacyDependencies,
): Record<string, unknown> => {
  const legacyAuth = legacy.auth;
  const legacyActing = legacy.identityAuthority;
  return {
    auth: {
      ...(legacyAuth as object),
      ...laneMfaMethods,
      resolveSession: async (request: Request, ...rest: unknown[]) => {
        const claim = await verifyLaneRequest(request);
        if (claim !== null)
          return { ok: true as const, value: authenticationSessionFor(claim) };
        return (
          legacyAuth as unknown as {
            resolveSession: (r: Request, ...a: unknown[]) => Promise<never>;
          }
        ).resolveSession(request, ...rest);
      },
    } as unknown as WorkerDependencies['auth'],
    identityAuthority: {
      ...(legacyActing as object),
      // /me/identity (read by the admin pages before any capability check).
      readPerson: (input: { session: AuthenticationSession }) =>
        isLaneUserId(input.session.authUserId)
          ? {
              ok: true as const,
              value: {
                personId: lanePersonId(
                  laneRoleOfUser(input.session.authUserId) as LaneRole,
                ),
                partyKind: 'person' as const,
                accountState: 'active' as const,
                version: '1',
                facets: [],
                aliases: [],
              },
            }
          : (
              legacyActing as unknown as {
                readPerson?: (i: unknown) => unknown;
              }
            ).readPerson?.(input),
      readActingContexts: (input: { session: AuthenticationSession }) =>
        isLaneUserId(input.session.authUserId)
          ? laneActingContexts()
          : (
              legacyActing as unknown as {
                readActingContexts: (i: unknown) => unknown;
              }
            ).readActingContexts(input),
    } as unknown as WorkerDependencies['identityAuthority'],
    jobs: laneJobs as unknown as WorkerDependencies['jobs'],
    resolveRequestContext: (request: Request) => laneRequestContext(request),
    adminWorkspace:
      laneAdminWorkspace as unknown as WorkerDependencies['adminWorkspace'],
  };
};

/**
 * Test-only control, loopback harness only: lets a test age one role's step-up
 * proof past its ten-minute window (what elapsed time does in production)
 * without waiting. It cannot create, approve or complete any domain record.
 */
export const handleLaneControl = async (
  request: Request,
): Promise<Response | null> => {
  const url = new URL(request.url);
  if (
    url.pathname === '/_s09/lane/ambiguous-verify' &&
    request.method === 'POST'
  ) {
    try {
      const { testId } = (await request.json()) as { testId?: unknown };
      if (typeof testId !== 'string' || !/^[0-9a-f]{8}$/u.test(testId))
        return Response.json({ armed: false }, { status: 400 });
      armAmbiguousVerify(testId);
      return Response.json({ armed: true });
    } catch {
      return Response.json({ armed: false }, { status: 400 });
    }
  }
  if (
    url.pathname === '/_s09/lane/degrade-reads' &&
    request.method === 'POST'
  ) {
    try {
      const { testId, on } = (await request.json()) as {
        testId?: unknown;
        on?: unknown;
      };
      if (
        typeof testId !== 'string' ||
        !/^[0-9a-f]{8}$/u.test(testId) ||
        typeof on !== 'boolean'
      )
        return Response.json({ degraded: false }, { status: 400 });
      worldFor(testId).degradedReads = on;
      return Response.json({ degraded: on });
    } catch {
      return Response.json({ degraded: false }, { status: 400 });
    }
  }
  if (
    url.pathname === '/_s09/lane/remove-capability' &&
    request.method === 'POST'
  ) {
    try {
      const { testId, role, capability } = (await request.json()) as {
        testId?: unknown;
        role?: unknown;
        capability?: unknown;
      };
      if (
        typeof testId !== 'string' ||
        !/^[0-9a-f]{8}$/u.test(testId) ||
        typeof role !== 'string' ||
        typeof capability !== 'string'
      )
        return Response.json({ removed: false }, { status: 400 });
      const world = worldFor(testId);
      const removed = (world.removedCapabilities[role as LaneRole] ??= []);
      removed.push(capability);
      return Response.json({ removed: true });
    } catch {
      return Response.json({ removed: false }, { status: 400 });
    }
  }
  if (url.pathname !== '/_s09/lane/expire-step-up' || request.method !== 'POST')
    return null;
  try {
    const body = (await request.json()) as { testId?: unknown; role?: unknown };
    const { testId, role } = body;
    if (
      typeof testId !== 'string' ||
      !/^[0-9a-f]{8}$/u.test(testId) ||
      typeof role !== 'string'
    )
      return Response.json({ expired: false }, { status: 400 });
    delete worldFor(testId).stepUpAt[role as LaneRole];
    return Response.json({ expired: true });
  } catch {
    return Response.json({ expired: false }, { status: 400 });
  }
};

export { registrySessionFor, verifyLaneRequest };
