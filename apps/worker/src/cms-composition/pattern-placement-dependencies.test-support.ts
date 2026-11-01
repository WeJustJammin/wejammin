import { createProductionCmsPatternInstanceDependencies } from '../cms-composition-production-pattern';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from '../cms-editorial-production.test-support';

import type {
  CmsPatternInstanceDependencies,
  CmsPatternInstancePortInput,
} from './pattern-instance-routes';
import {
  PLACEMENT_ORIGIN,
  PLACEMENT_PATH,
  placementBody,
  placementBodyAtRoot,
} from './pattern-placement.test-support';

/** Server-bound port input for the production adapter boundary. */
export const productionPlacementInput = (
  overrides: Partial<CmsPatternInstancePortInput> = {},
): CmsPatternInstancePortInput => ({
  operationId: 'CMS-03C-02',
  request: new Request('https://api.example.test' + PLACEMENT_PATH, {
    headers: { 'x-correlation-id': REQUEST_ID },
  }),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  body: { ...placementBody },
  idempotencyKey: 'placement-command-0001',
  ifMatch: '1',
  ...overrides,
});

/** Server-bound port input for a root-slot placement request. */
export const productionPlacementInputAtRoot = (
  overrides: Partial<CmsPatternInstancePortInput> = {},
): CmsPatternInstancePortInput =>
  productionPlacementInput({ body: { ...placementBodyAtRoot }, ...overrides });

/** The real production adapter with a scripted private-RPC transport. */
export const productionPlacementDependencies = (
  fetchImpl: typeof fetch,
  maxResponseBytes?: number,
) =>
  createProductionCmsPatternInstanceDependencies({
    environment,
    fetchImpl,
    humanOrigins: [PLACEMENT_ORIGIN],
    ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
    resolveSession: async () => ({
      ok: true,
      value: productionPlacementInput().session,
    }),
  });

export const httpPlacementRequest = (
  overrides: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
  } = {},
): Request =>
  new Request('https://api.example.test' + PLACEMENT_PATH, {
    method: overrides.method ?? 'POST',
    headers: {
      origin: PLACEMENT_ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': 'placement-command-0001',
      'if-match': '"1"',
      ...overrides.headers,
    },
    ...(overrides.method === 'OPTIONS'
      ? {}
      : { body: JSON.stringify(overrides.body ?? placementBody) }),
  });

export const httpPlacementRequestAtRoot = (): Request =>
  httpPlacementRequest({ body: placementBodyAtRoot });

/**
 * The route port is injected through the frozen boundary; widening it to the
 * placement result is a GREEN step, so the fixture narrows the injected double.
 */
export const httpPlacementDependencies = (
  insertPattern: unknown,
  overrides: Partial<CmsPatternInstanceDependencies> = {},
): CmsPatternInstanceDependencies => ({
  humanOrigins: [PLACEMENT_ORIGIN],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: USER_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2_000,
    },
  }),
  insertPattern:
    insertPattern as CmsPatternInstanceDependencies['insertPattern'],
  telemetry: () => undefined,
  ...overrides,
});
