import type { CompositionInstanceResource } from '@wejammin/contracts';

import { MAX_DEFAULT_RESPONSE_BYTES } from '../cms-editorial-production-types';
import { CMS_PLACEMENT_MAX_RESPONSE_BYTES } from './pattern-instance-contracts';

/**
 * Wire fixtures for the DEC-175/DEC-181/DEC-185 CMS-03C-02 placement. One
 * placement answers 201 PatternPlacementResource: an items list of one row per
 * block root of the pinned forest, all pinned to one revision, one pattern
 * version and one link mode, with unique paths/ids and consecutive positions.
 */
export const PLACEMENT_ORIGIN = 'https://cms.example.test';
export const PLACEMENT_PATH = '/api/v1/cms/compositions/pattern-instances';
export const PLACEMENT_REVISION_ID = 'f1000000-0000-4000-8000-000000000001';
export const PLACEMENT_PATTERN_ID = 'f1000000-0000-4000-8000-000000000002';
export const PLACEMENT_SLOT_PATH = '/main';
export const PLACEMENT_PATTERN_VERSION = 2;
export const PLACEMENT_HASH = 'c'.repeat(64);

/** One block-root row of a placement forest (DEC-175, DEC-185). */
export const placementRow = (
  index: number,
  overrides: Partial<CompositionInstanceResource> = {},
): CompositionInstanceResource => ({
  id: 'f1000000-0000-4000-8000-' + String(100_000 + index).padStart(12, '0'),
  version: '1',
  contentHash: PLACEMENT_HASH,
  createdAt: '2026-09-28T14:00:00Z',
  updatedAt: '2026-09-28T14:00:00Z',
  state: 'draft',
  revisionId: PLACEMENT_REVISION_ID,
  path: '/main/root' + index,
  position: index,
  blockKey: 'profile.block' + index,
  blockVersion: 1,
  patternId: PLACEMENT_PATTERN_ID,
  patternVersion: PLACEMENT_PATTERN_VERSION,
  blockRegistryDigest: PLACEMENT_HASH,
  linkMode: 'linked',
  conflictState: 'none',
  ...overrides,
});

/** The block roots of a forest of count rows in forest order (DEC-175). */
export const placementRows = (count: number): CompositionInstanceResource[] =>
  Array.from({ length: count }, (_, index) => placementRow(index));

/** Rows carrying the given paths in order, so a path is the only variable. */
export const placementRowsAtPaths = (
  paths: readonly string[],
): CompositionInstanceResource[] =>
  paths.map((path, index) => placementRow(index, { path }));

/** The 201 placement body: one or more rows, at most 512 after expansion. */
export const placementResource = (count: number) => ({
  items: placementRows(count),
});

/** Serialized byte length of a placement body (UTF-8). */
export const placementByteLength = (count: number): number =>
  new TextEncoder().encode(JSON.stringify(placementResource(count))).byteLength;

/** Schema-valid synthetic boundary value; not a real SQL producer maximum. */
export const placementAtBytes = (totalBytes: number) => {
  const row = placementRow(0, { createdAt: '2026-09-28T14:00:00.Z' });
  const value = { items: [row] };
  const baseBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  row.createdAt =
    '2026-09-28T14:00:00.' + '0'.repeat(totalBytes - baseBytes) + 'Z';
  return value;
};

/** Valid RPC error padded with JSON whitespace to isolate the byte budget. */
export const placementErrorResponse = (
  totalBytes: number,
  declareLength: boolean,
): Response => {
  const json = JSON.stringify({ code: 'VERSION_MISMATCH', message: 'private' });
  return new Response(json + ' '.repeat(totalBytes - json.length), {
    status: 500,
    headers: {
      'content-type': 'application/json',
      ...(declareLength ? { 'content-length': String(totalBytes) } : {}),
    },
  });
};

export { MAX_DEFAULT_RESPONSE_BYTES };
export { CMS_PLACEMENT_MAX_RESPONSE_BYTES };

/** The committed entry aggregate strong ETag the producer must forward. */
export const PLACEMENT_ENTRY_ETAG = '"7"';

/** A successful placement port result: the list plus the forwarded ETag. */
export const placementSuccess = (
  count: number,
  etag: string = PLACEMENT_ENTRY_ETAG,
) => ({
  ok: true as const,
  value: placementResource(count),
  etag,
});

/** A PostgREST success response carrying an optional ETag header. */
export const placementRpcResponse = (
  count: number,
  etag: string | null = PLACEMENT_ENTRY_ETAG,
): Response =>
  Response.json(
    placementResource(count),
    etag === null ? undefined : { headers: { etag } },
  );

/**
 * A response whose declared content-length is set independently of the body, so
 * the exact 1 MiB ceiling boundary is exercised without a 1 MiB body.
 */
export const placementDeclaredLengthResponse = (
  count: number,
  declaredLength: number,
  etag: string | null = PLACEMENT_ENTRY_ETAG,
): Response =>
  new Response(JSON.stringify(placementResource(count)), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-length': String(declaredLength),
      ...(etag === null ? {} : { etag }),
    },
  });

/**
 * A streamed body of totalBytes bytes with no content-length, so the byte
 * ceiling fires on the streamed total before any schema check.
 */
export const placementStreamedResponse = (
  totalBytes: number,
  etag: string | null = PLACEMENT_ENTRY_ETAG,
): Response => {
  const chunk = new TextEncoder().encode('x'.repeat(65_536));
  let sent = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (sent >= totalBytes) {
          controller.close();
          return;
        }
        const remaining = totalBytes - sent;
        const slice =
          remaining >= chunk.byteLength ? chunk : chunk.subarray(0, remaining);
        sent += slice.byteLength;
        controller.enqueue(slice);
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...(etag === null ? {} : { etag }),
      },
    },
  );
};

/** Strong ETag acceptance for the committed entry aggregate (BE00 ETag rule). */
export const placementEtagCases = (): ReadonlyArray<
  Readonly<{ label: string; header: string | null; ok: boolean }>
> => [
  { label: 'missing', header: null, ok: false },
  { label: 'weak', header: 'W/"7"', ok: false },
  { label: 'zero', header: '"0"', ok: false },
  { label: 'overflow', header: '"9223372036854775808"', ok: false },
  { label: 'valid entry aggregate', header: '"7"', ok: true },
];

/** The legacy single-row 201 that a placement must no longer accept. */
export const legacySingleRow = (): CompositionInstanceResource =>
  placementRow(0, { path: PLACEMENT_SLOT_PATH, blockKey: 'profile.root' });

export const placementBody = {
  revisionId: PLACEMENT_REVISION_ID,
  patternId: PLACEMENT_PATTERN_ID,
  patternVersion: PLACEMENT_PATTERN_VERSION,
  linkMode: 'linked',
  slotPath: PLACEMENT_SLOT_PATH,
  overrides: {},
  expectedVersion: '1',
} as const;

export const placementBodyAtRoot = {
  ...placementBody,
  slotPath: '/',
} as const;

export const placementBodyWithDigest = {
  ...placementBody,
  blockRegistryDigest: PLACEMENT_HASH,
};

export const PLACEMENT_ALTERNATE_ID = 'f1000000-0000-4000-8000-0000000000ff';
export const PLACEMENT_OTHER_DIGEST = 'd'.repeat(64);

/** The same override on every row: a schema-valid forest that binds no request. */
export const uniformPlacementRows = (
  overrides: Partial<CompositionInstanceResource>,
): CompositionInstanceResource[] =>
  placementRows(2).map((row) => ({ ...row, ...overrides }));

/** Row paths that share the slot prefix without being under it. */
export const lookalikePlacementRows = (): CompositionInstanceResource[] =>
  placementRows(2).map((row, index) => ({
    ...row,
    path: '/mainx/root' + index,
  }));

/** Schema-valid forests whose rows do not bind the CMS-03C-02 request. */
export const placementBindingCases = (): ReadonlyArray<
  Readonly<{
    label: string;
    items: CompositionInstanceResource[];
    bodyDigest: boolean;
  }>
> => [
  {
    label: 'revisionId',
    items: uniformPlacementRows({ revisionId: PLACEMENT_ALTERNATE_ID }),
    bodyDigest: false,
  },
  {
    label: 'patternId',
    items: uniformPlacementRows({ patternId: PLACEMENT_ALTERNATE_ID }),
    bodyDigest: false,
  },
  {
    label: 'patternVersion',
    items: uniformPlacementRows({ patternVersion: 9 }),
    bodyDigest: false,
  },
  {
    label: 'linkMode',
    items: uniformPlacementRows({ linkMode: 'detached' }),
    bodyDigest: false,
  },
  {
    label: 'blockRegistryDigest',
    items: uniformPlacementRows({
      blockRegistryDigest: PLACEMENT_OTHER_DIGEST,
    }),
    bodyDigest: true,
  },
  {
    label: 'path prefix lookalike',
    items: lookalikePlacementRows(),
    bodyDigest: false,
  },
];
