import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { POST, prerender } from './index';

const origin = 'https://app.example.test';
const entryId = '123e4567-e89b-42d3-a456-426614174000';
const revisionId = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const policy = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary',
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
} as const;
const body = {
  contentTypeId: entryId,
  contentTypeVersionId: revisionId,
  locale: 'en-US',
  changedPaths: [`/fields/${revisionId}`],
  values: { [revisionId]: { title: 'Hello' } },
  schemaArtifact: {
    id: entryId,
    contentTypeVersionId: revisionId,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [{ key: 'sanitize.rich_text', version: '3' }],
  workflowPolicy: policy,
  activationEvidence: policy,
};
const resource = {
  entry: { id: entryId, version: '1', createdAt: instant, updatedAt: instant },
  revision: {
    id: revisionId,
    version: '1',
    createdAt: instant,
    updatedAt: instant,
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: hash,
  validationState: 'valid',
};
const request = (headers: Record<string, string> = {}): Request =>
  new Request(`${origin}/api/v1/cms/entries`, {
    method: 'POST',
    headers: {
      origin,
      cookie: 'wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'entry-create-0001',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe('first-party CMS entry-create endpoint', () => {
  it('serves only on demand and forwards a validated create to the Worker binding', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(resource), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          location: `/api/v1/cms/entries/${entryId}`,
          etag: '"1"',
          'cache-control': 'no-store',
        },
      }),
    );
    expect(prerender).toBe(false);
    const response = await POST({ request: request() } as Parameters<
      typeof POST
    >[0]);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(
      'https://platform-api.internal/api/v1/cms/entries',
    );
    expect(forwarded.headers.get('idempotency-key')).toBe('entry-create-0001');
    expect(forwarded.headers.has('if-match')).toBe(false);
  });

  it('rejects a forged origin before reaching the Worker binding', async () => {
    fetchMock.mockReset();
    const response = await POST({
      request: request({ origin: 'https://evil.example.test' }),
    } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
