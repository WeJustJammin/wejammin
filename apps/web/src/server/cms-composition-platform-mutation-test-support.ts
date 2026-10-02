import type {
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

export const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const TYPE_ID = '30000000-0000-4000-8000-000000000003';
export const TEMPLATE_ID = '40000000-0000-4000-8000-000000000004';
export const REQUEST_ID = '50000000-0000-4000-8000-000000000005';
export const HASH = 'a'.repeat(64);

export const BODY: TemplateVersionRequest = {
  templateKey: 'profile-header',
  compatibleTypeIds: [TYPE_ID],
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
  blockRegistryDigest: HASH,
  expectedVersion: null,
};

export const RESOURCE: TemplateVersionResource = {
  id: TEMPLATE_ID,
  version: '1',
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: BODY.templateKey,
  templateVersion: 1,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: BODY.reservedRegions,
  blockRegistryDigest: HASH,
};

export const cookie =
  'wj_access=protected; wj_csrf=csrf-token-123; unrelated=private';

export const request = (
  value: unknown = BODY,
  overrides: Record<string, string> = {},
): Request =>
  new Request('https://app.example.test/api/v1/cms/templates/versions', {
    method: 'POST',
    headers: {
      origin: 'https://app.example.test',
      cookie,
      'x-csrf-token': 'csrf-token-123',
      'x-request-id': REQUEST_ID,
      'content-type': 'application/json',
      'idempotency-key': 'template-create-0001',
      ...overrides,
    },
    body: JSON.stringify(value),
  });

export const success = (value: unknown = RESOURCE, etag = '"1"'): Response =>
  new Response(JSON.stringify(value), {
    status: 201,
    headers: {
      'content-type': 'application/json',
      etag,
      'cache-control': 'no-store',
    },
  });

export const failure = (
  status: number,
  code: string,
  details: unknown = {},
): Response =>
  new Response(
    JSON.stringify({
      code,
      message: code + ': template operation rejected or unavailable.',
      requestId: REQUEST_ID,
      details,
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
