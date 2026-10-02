import { expect, vi } from 'vitest';
import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
  type ContentSchemaRegistryResult,
  type ContentSchemaRegistrySession,
} from './index';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  RELEASE_ORIGIN,
  TYPE_ID,
  VERSION_ID,
  BLOCK_ID,
  REQUEST_ID,
  NONCE,
  HASH,
  SIGNATURE,
  session,
  resource,
  field,
  relation,
  safeBlock,
  block,
  activation,
  lifecycleEvent,
  ok,
} from './phase-02-slice-09-test-values';
import { detailWithPreparation } from './phase-02-slice-09-dec108-test-values';
export * from './phase-02-slice-09-test-values';

export type PortMocks = Record<
  | 'createTypeDraft'
  | 'addFieldDefinition'
  | 'bindRelation'
  | 'activateSchema'
  | 'registerBlock'
  | 'advanceBlockLifecycle'
  | 'listContentTypes'
  | 'getContentTypeVersion',
  ReturnType<typeof vi.fn>
>;
export type Harness = Readonly<{
  app: ReturnType<typeof createContentSchemaRegistryApp>;
  ports: PortMocks;
  resolveSession: ReturnType<typeof vi.fn>;
  verifyRelease: ReturnType<typeof vi.fn>;
  rateLimit: ReturnType<typeof vi.fn>;
  telemetry: ReturnType<typeof vi.fn>;
}>;
export const mutationPath = {
  field: `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/fields`,
  relation: `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/relations`,
  activate: `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/activate`,
  lifecycle: `/api/v1/cms/blocks/versions/${BLOCK_ID}/lifecycle`,
};
export const _operationForHumanPath = (path: string): boolean =>
  path !== '/api/v1/cms/content-types';
export const releaseHeaders = (): Record<string, string> => ({
  'X-WeJammin-Release-Key-Id': 'release-key-1',
  'X-WeJammin-Release-Issued-At': '2026-09-02T12:00:00.000Z',
  'X-WeJammin-Release-Nonce': NONCE,
  'X-WeJammin-Release-Signature': SIGNATURE,
});
export const jsonRequest = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'idempotency-key': 'cms-test-key-001',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(body),
  });
export const releaseRequest = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: RELEASE_ORIGIN,
      'idempotency-key': 'release-test-key-001',
      'x-request-id': REQUEST_ID,
      ...releaseHeaders(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
export const makeHarness = (
  overrides: Partial<{
    session: ContentSchemaRegistryResult<ContentSchemaRegistrySession>;
    release: ContentSchemaRegistryResult<{
      principalId: string;
      keyId: string;
      capabilities: readonly string[];
      verifiedAt: string;
      rawBodyHash: string;
      signatureHash: string;
      nonceHash: string;
    }>;
    rate: ContentSchemaRegistryResult<{
      allowed: boolean;
      limit: number;
      remaining: number;
      resetAt: number;
    }>;
  }> = {},
): Harness => {
  const outputs: Record<string, unknown> = {
    createTypeDraft: resource,
    addFieldDefinition: field,
    bindRelation: relation,
    activateSchema: activation,
    registerBlock: block,
    advanceBlockLifecycle: lifecycleEvent,
    listContentTypes: { items: [resource, safeBlock], nextCursor: null },
    getContentTypeVersion: detailWithPreparation,
  };
  const names = [
    'createTypeDraft',
    'addFieldDefinition',
    'bindRelation',
    'activateSchema',
    'registerBlock',
    'advanceBlockLifecycle',
    'listContentTypes',
    'getContentTypeVersion',
  ] as const;
  const ports = Object.fromEntries(
    names.map((name) => [name, vi.fn(async () => ok(outputs[name]))]),
  ) as PortMocks;
  const resolveSession = vi.fn(async () => overrides.session ?? ok(session));
  const verifyRelease = vi.fn(
    async () =>
      overrides.release ??
      ok({
        principalId: 'release-worker-1',
        keyId: 'release-key-1',
        capabilities: ['release.block_registry.write'],
        verifiedAt: '2026-09-02T12:00:00.000Z',
        rawBodyHash: HASH,
        signatureHash: HASH,
        nonceHash: HASH,
      }),
  );
  const rateLimit = vi.fn(
    async () =>
      overrides.rate ??
      ok({ allowed: true, limit: 100, remaining: 99, resetAt: 1_788_345_600 }),
  );
  const telemetry = vi.fn();
  const dependencies: ContentSchemaRegistryDependencies = {
    ports: ports as unknown as ContentSchemaRegistryDependencies['ports'],
    resolveSession,
    verifyRelease,
    rateLimit,
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: [RELEASE_ORIGIN],
    now: () => 1_788_345_600_000,
    telemetry,
  };
  return {
    app: createContentSchemaRegistryApp(dependencies),
    ports,
    resolveSession,
    verifyRelease,
    rateLimit,
    telemetry,
  };
};
export const expectApiError = async (
  response: Response,
  status: number,
  code: string,
): Promise<Record<string, unknown>> => {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.code).toBe(code);
  expect(typeof body.message).toBe('string');
  expect(body.requestId).toBe(REQUEST_ID);
  expect(body.details).toEqual(expect.any(Object));
  expect(JSON.stringify(body)).not.toMatch(
    /ownerId|releaseSignature|stack|sql/i,
  );
  return body;
};
