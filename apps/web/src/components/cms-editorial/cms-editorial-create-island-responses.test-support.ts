/**
 * The create-island Responses, kept as they were inside the island test so that
 * test stays within its line cap: the created entry (201, with its location and
 * ETag) and the uniform typed API error.
 */

export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';

const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-10-05T00:00:00+00:00';

export const created = (): Response =>
  new Response(
    JSON.stringify({
      entry: {
        id: ENTRY_ID,
        version: '1',
        createdAt: INSTANT,
        updatedAt: INSTANT,
      },
      revision: {
        id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
        version: '1',
        createdAt: INSTANT,
        updatedAt: INSTANT,
      },
      revisionNumber: '1',
      lifecycle: 'active',
      state: 'draft',
      locale: 'en-US',
      contentHash: HASH,
      validationState: 'valid',
    }),
    {
      status: 201,
      headers: {
        'content-type': 'application/json',
        location: `/api/v1/cms/entries/${ENTRY_ID}`,
        etag: '"1"',
        'cache-control': 'no-store',
      },
    },
  );

export const apiError = (status: number, code: string, details: unknown = {}) =>
  new Response(
    JSON.stringify({ code, message: 'Safe.', requestId: REQUEST_ID, details }),
    { status, headers: { 'content-type': 'application/json' } },
  );
