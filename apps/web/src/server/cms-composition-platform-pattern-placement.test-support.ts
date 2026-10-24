import type { CompositionInstanceResource } from '@wejammin/contracts';
import { vi } from 'vitest';

/**
 * Fixtures for the CMS-03C-02 first-party web proxy RED.
 *
 * BE03c CMS-03C-02 answers `201 PatternPlacementResource` (DEC-175, DEC-181,
 * DEC-185): an `items` list of one or more `CompositionInstanceResource`
 * rows, every row pinned to one revision, one pattern version and one link
 * mode, with unique ids and paths at consecutive positions. A row `path` is
 * the requested `slotPath` joined with `/` and the block root's key chain
 * (DEC-186; the root path `/` adds no extra separator).
 *
 * Every positive fixture is a value the locked `PatternPlacementResourceSchema`
 * accepts; the proxy, not the fixture, is what this RED exercises.
 */
export const PLACEMENT_PATH = '/api/v1/cms/compositions/pattern-instances';
export const APP_ORIGIN = 'https://app.example.test';
export const REVISION_ID = 'd3000000-0000-4000-8000-000000000011';
export const PATTERN_ID = 'd3000000-0000-4000-8000-000000000012';
export const HASH = 'b'.repeat(64);
export const SLOT_PATH = '/main';

export const placementBody = {
  revisionId: REVISION_ID,
  patternId: PATTERN_ID,
  patternVersion: 2,
  linkMode: 'linked',
  slotPath: SLOT_PATH,
  overrides: {},
  blockRegistryDigest: HASH,
  expectedVersion: '1',
} as const;

/** One block-root row of a placement forest (DEC-175, DEC-185). */
export const placementRow = (
  index: number,
  overrides: Partial<CompositionInstanceResource> = {},
): CompositionInstanceResource => ({
  id: 'd3000000-0000-4000-8000-' + String(100_000 + index).padStart(12, '0'),
  // Deliberately distinct from the entry aggregate ETag so a relayed 201 proves
  // the ETag is the entry version, not a row version (BE00 version grammar).
  version: '7',
  contentHash: HASH,
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId: REVISION_ID,
  path: SLOT_PATH + '/hero' + index,
  position: index,
  blockKey: 'profile.block' + index,
  blockVersion: 1,
  patternId: PATTERN_ID,
  patternVersion: 2,
  blockRegistryDigest: HASH,
  linkMode: 'linked',
  conflictState: 'none',
  ...overrides,
});

/** The block roots of a forest of `count` rows in forest order (DEC-175). */
export const placementRows = (count: number): CompositionInstanceResource[] =>
  Array.from({ length: count }, (_, index) => placementRow(index));

/** The 201 placement body: one or more rows after DEC-181 expansion. */
export const placementResource = (count: number) => ({
  items: placementRows(count),
});

/** Rows whose paths carry a nested-pattern reference key chain (DEC-186). */
export const chainedRows = (): CompositionInstanceResource[] => [
  placementRow(0, { path: SLOT_PATH + '/shared/a', blockKey: 'shared.a' }),
  placementRow(1, { path: SLOT_PATH + '/shared/b', blockKey: 'shared.b' }),
];

/** A placement into the document root `slotPath` `/` (DEC-186). */
export const rootSlotBody = { ...placementBody, slotPath: '/' } as const;
export const rootSlotRows = (): CompositionInstanceResource[] => [
  placementRow(0, { path: '/hero' }),
  placementRow(1, { path: '/footer' }),
];

/** The legacy single-resource 201 that a placement must no longer accept. */
export const legacySingleRow = (): CompositionInstanceResource =>
  placementRow(0, { path: SLOT_PATH + '/hero', blockKey: 'profile.root' });

/** A valid node chain whose row path exceeds 248 octets (DEC-186). */
export const overLongChainPath = (): string =>
  SLOT_PATH + '/' + Array.from({ length: 5 }, () => 'a'.repeat(60)).join('/');

/**
 * The exact serialized byte count of a body, matching the bounded reader's
 * measurement. Used to tie a transport positive to the real 256 KiB ceiling
 * rather than to a route that could only 502 under it.
 */
export const serializedBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const request = (
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
    path?: string;
    rawBody?: string;
  } = {},
): Request =>
  new Request(APP_ORIGIN + (options.path ?? PLACEMENT_PATH), {
    method: options.method ?? 'POST',
    headers: {
      origin: APP_ORIGIN,
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123; unrelated=private',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'placement-command-0001',
      'if-match': '"1"',
      ...options.headers,
    },
    ...(options.method === 'GET'
      ? {}
      : {
          body:
            options.rawBody ?? JSON.stringify(options.body ?? placementBody),
        }),
  });

export const binding = (result: unknown) => {
  const fetch = vi.fn(async (input: Request) => {
    if (!(input instanceof Request))
      throw new Error('Expected a forwarded Request.');
    if (result instanceof Error) throw result;
    return result;
  });
  return { fetch };
};

/**
 * A 201 with a conventional strong `ETag`. The header is supplied so a failing
 * positive isolates the list parser: the registry names a request `If-Match`
 * but no response `ETag` for the aggregate-less placement list, so no test
 * asserts the relayed-validator policy either way.
 */
export const success = (
  value: unknown,
  status = 201,
  etag: string | null = '"1"',
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(etag === null ? {} : { etag }),
    },
  });

/**
 * A 201 whose body is a raw byte stream rather than a measured string, so a
 * test can present an absent or lying `content-length` and an over-cap body
 * that the reader must refuse and cancel rather than truncate.
 */
export const streamedSuccess = (
  chunks: readonly Uint8Array[],
  options: {
    status?: number;
    etag?: string | null;
    contentLength?: number | null;
    onCancel?: () => void;
  } = {},
): Response => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel() {
      options.onCancel?.();
    },
  });
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.etag !== null) headers.set('etag', options.etag ?? '"1"');
  if (typeof options.contentLength === 'number')
    headers.set('content-length', String(options.contentLength));
  return new Response(body, { status: options.status ?? 201, headers });
};

/** A schema-valid 512-row placement padded past the 1 MiB budget as a stream. */
export const oversizedPlacementChunks = (totalBytes: number): Uint8Array[] => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode('{"items":[');
  const suffix = encoder.encode(']}');
  const pad = encoder.encode(
    'x'.repeat(totalBytes - prefix.length - suffix.length),
  );
  return [prefix, pad, suffix];
};
