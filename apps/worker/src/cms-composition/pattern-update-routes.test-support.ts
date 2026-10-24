import { Hono } from 'hono';
import { vi } from 'vitest';

import type { CmsEditorialSession } from '../cms-editorial/types';
import { ciPage } from './composition-instances.test-support';
import { registerCmsPatternUpdateRoutes } from './pattern-update-routes';
import type { CmsPatternUpdateDependencies } from './pattern-update-ports';
import {
  acceptResource,
  diffResource,
  PU_ENTRY_ETAG,
  PU_ORIGIN,
  PU_PARTY_ID,
  PU_REQUEST_ID,
  PU_USER_ID,
  selectorPage,
} from './pattern-update.test-support';

/** The authorized editor of the owner party; the capability list is the variable of most refusals. */
export const puSession = (
  capabilities: readonly string[] = ['cms.author'],
): CmsEditorialSession => ({
  userId: PU_USER_ID,
  actingPartyId: PU_PARTY_ID,
  capabilities,
  mfaFresh: true,
});

export const allowRate = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 2_000,
  },
});

/**
 * An isolated registrar over spy ports: every dependency answers the happy path unless overridden, so a test varies
 * exactly one thing. `request` always carries the allowed origin and a fixed request id.
 */
export const createPatternUpdateHarness = (
  overrides: Partial<CmsPatternUpdateDependencies> = {},
) => {
  const resolveSession = vi.fn<CmsPatternUpdateDependencies['resolveSession']>(
    async () => ({ ok: true, value: puSession() }),
  );
  const rateLimit = vi.fn<CmsPatternUpdateDependencies['rateLimit']>(allowRate);
  const readSelector = vi.fn<CmsPatternUpdateDependencies['readSelector']>(
    async () => ({ ok: true, value: selectorPage() }),
  );
  const readUpdateDiff = vi.fn<CmsPatternUpdateDependencies['readUpdateDiff']>(
    async () => ({ ok: true, value: diffResource() }),
  );
  const readInstances = vi.fn<CmsPatternUpdateDependencies['readInstances']>(
    async () => ({ ok: true, value: ciPage() }),
  );
  const applyUpdate = vi.fn<CmsPatternUpdateDependencies['applyUpdate']>(
    async () => ({ ok: true, value: acceptResource(1), etag: PU_ENTRY_ETAG }),
  );
  const telemetry = vi.fn<CmsPatternUpdateDependencies['telemetry']>();
  const dependencies: CmsPatternUpdateDependencies = {
    humanOrigins: [PU_ORIGIN],
    now: () => 1_000,
    resolveSession,
    rateLimit,
    readSelector,
    readUpdateDiff,
    readInstances,
    applyUpdate,
    telemetry,
    ...overrides,
  };
  const app = new Hono();
  registerCmsPatternUpdateRoutes(app, dependencies);
  return {
    dependencies,
    resolveSession,
    rateLimit,
    readSelector,
    readUpdateDiff,
    readInstances,
    applyUpdate,
    telemetry,
    request: (path: string, init: RequestInit = {}) =>
      app.request(`https://api.example.test${path}`, {
        ...init,
        headers: {
          origin: PU_ORIGIN,
          'x-request-id': PU_REQUEST_ID,
          ...(init.headers as Record<string, string> | undefined),
        },
      }),
  };
};
