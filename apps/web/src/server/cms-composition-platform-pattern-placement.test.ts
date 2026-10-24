import { PatternPlacementResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { forwardCmsPatternInstanceMutation } from './cms-composition-platform-pattern';
import {
  PLACEMENT_PATH,
  REVISION_ID,
  SLOT_PATH,
  binding,
  chainedRows,
  legacySingleRow,
  overLongChainPath,
  oversizedPlacementChunks,
  placementBody,
  placementResource,
  placementRow,
  placementRows,
  request,
  rootSlotBody,
  rootSlotRows,
  serializedBytes,
  streamedSuccess,
  success,
} from './cms-composition-platform-pattern-placement.test-support';

// CMS-03C-02 proxy: 201 PatternPlacementResource (DEC-175/181/185), row paths bound to slotPath within 248 octets (DEC-186), entry ETag (BE00), 1 MiB response (DEC-188/189).
const forward = (
  result: unknown,
  options: Parameters<typeof request>[0] = {},
) => forwardCmsPatternInstanceMutation(request(options), binding(result));

/** True when the locked schema accepts the body; isolates fixture schema validity. */
const parsesAsPlacement = (items: unknown[]): boolean =>
  PatternPlacementResourceSchema.safeParse({ items }).success;

describe('CMS-03C-02 web proxy: PatternPlacementResource list relay', () => {
  it('[P2-S12-AC-218] relays 1-row, 2-row and 33-row placements', async () => {
    for (const count of [1, 2, 33]) {
      const body = placementResource(count);
      expect(serializedBytes(body), String(count)).toBeLessThanOrEqual(262_144);
      const response = await forward(success(body));
      expect(response.status, String(count)).toBe(201);
      expect(await response.json()).toEqual(body);
    }
  });

  it('[P2-S12-AC-218] accepts a schema-valid 512-row placement under the 1 MiB budget (DEC-189)', async () => {
    const body = placementResource(512);
    expect(PatternPlacementResourceSchema.safeParse(body).success).toBe(true);
    expect(serializedBytes(body)).toBeLessThanOrEqual(1_048_576);
    expect(
      PatternPlacementResourceSchema.safeParse(placementResource(513)).success,
    ).toBe(false);
    const response = await forward(success(body));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(body);
  });

  it('[P2-S12-AC-218] accepts a placement appended after the slot rows (DEC-185)', async () => {
    const items = [placementRow(3), placementRow(4)];
    const response = await forward(success({ items }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items });
  });

  it('[P2-S12-AC-218] accepts rows through a nested-pattern key chain (DEC-186)', async () => {
    const response = await forward(success({ items: chainedRows() }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items: chainedRows() });
  });

  it('[P2-S12-AC-218] accepts a placement into the root slotPath "/" (DEC-186)', async () => {
    const response = await forward(success({ items: rootSlotRows() }), {
      body: rootSlotBody,
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items: rootSlotRows() });
  });
});

describe('CMS-03C-02 web proxy: entry-aggregate ETag (BE00)', () => {
  it('[P2-S12-AC-010] relays a strong entry ETag that differs from every row version', async () => {
    const body = placementResource(2);
    expect(body.items[0]?.version).toBe('7');
    const response = await forward(success(body, 201, '"42"'));
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"42"');
    expect(await response.json()).toEqual(body);
  });

  it('[P2-S12-AC-218] fails closed on a missing, weak, malformed or overflowing ETag', async () => {
    for (const etag of [
      null,
      'W/"1"',
      '1',
      '"0"',
      '""',
      '"9223372036854775808"',
    ]) {
      const response = await forward(success(placementResource(1), 201, etag));
      expect(response.status, String(etag)).toBe(502);
    }
  });
});

describe('CMS-03C-02 web proxy: response byte budget (DEC-188/DEC-189)', () => {
  it('[P2-S12-AC-218] refuses an over-budget response and cancels rather than truncating', async () => {
    let cancelled = false;
    const response = await forward(
      streamedSuccess(oversizedPlacementChunks(1_048_576 + 4_096), {
        contentLength: null,
        onCancel: () => {
          cancelled = true;
        },
      }),
    );
    expect(response.status).toBe(502);
    expect(cancelled).toBe(true);
  });

  it('[P2-S12-AC-218] refuses a lying content-length that streams past the budget', async () => {
    const response = await forward(
      streamedSuccess(oversizedPlacementChunks(1_048_576 + 4_096), {
        contentLength: 16,
      }),
    );
    expect(response.status).toBe(502);
  });
});

describe('CMS-03C-02 web proxy: request binding and transport', () => {
  it('[P2-S12-AC-010] forwards the validated placement body and allowlisted headers once', async () => {
    const upstream = binding(success(placementResource(2)));
    const response = await forwardCmsPatternInstanceMutation(
      request(),
      upstream,
    );
    expect(response.status).toBe(201);
    expect(upstream.fetch).toHaveBeenCalledTimes(1);
    const sent = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(sent.url).toBe('https://platform-api.internal' + PLACEMENT_PATH);
    expect(sent.method).toBe('POST');
    expect(await sent.json()).toEqual(placementBody);
    expect(sent.headers.get('if-match')).toBe('"1"');
    expect(sent.headers.get('idempotency-key')).toBe('placement-command-0001');
    expect(sent.headers.get('x-csrf-token')).toBe('csrf-token-123');
    expect(sent.headers.get('cookie')).toContain('wj_csrf=csrf-token-123');
    expect(sent.headers.get('cookie')).not.toContain('unrelated=');
    expect(sent.headers.get('origin')).toBeNull();
  });

  it('[P2-S12-AC-218] fails closed 502 on a schema-valid but wrong request binding', async () => {
    const alternate = 'd3000000-0000-4000-8000-0000000000ff';
    const cases: [unknown[], Parameters<typeof request>[0]?][] = [
      [[placementRow(0, { revisionId: alternate })], undefined],
      [[placementRow(0, { patternId: alternate })], undefined],
      [[placementRow(0, { patternVersion: 9 })], undefined],
      [[placementRow(0, { linkMode: 'detached' })], undefined],
      [[placementRow(0, { blockRegistryDigest: 'c'.repeat(64) })], undefined],
      [[placementRow(0, { path: '/mainx/hero0' })], undefined],
      // Exact slot (no block-root suffix), empty/unnormalized separators and a
      // valid chain whose row path exceeds 248 octets all fail the binding.
      [[placementRow(0, { path: SLOT_PATH })], undefined],
      [[placementRow(0, { path: SLOT_PATH + '/' })], undefined],
      [[placementRow(0, { path: SLOT_PATH + '//hero' })], undefined],
      [[placementRow(0, { path: SLOT_PATH + '/../hero' })], undefined],
      [[placementRow(0, { path: SLOT_PATH + '/hero/' })], undefined],
      [[placementRow(0, { path: overLongChainPath() })], undefined],
      [[placementRow(0, { path: '/' })], { body: rootSlotBody }],
    ];
    for (const [items, options] of cases) {
      expect(parsesAsPlacement(items), JSON.stringify(items)).toBe(true);
      const response = await forward(success({ items }), options);
      expect(response.status, JSON.stringify(items)).toBe(502);
    }
  });

  it('[P2-S12-AC-218] fails closed 502 on a schema-invalid or mixed forest', async () => {
    const alternate = 'd3000000-0000-4000-8000-0000000000ff';
    for (const items of [
      [placementRow(0), placementRow(1, { revisionId: alternate })],
      [placementRow(0), placementRow(1, { patternId: alternate })],
      [placementRow(0), placementRow(1, { patternVersion: 9 })],
      [placementRow(0), placementRow(1, { linkMode: 'detached' })],
      [placementRow(0), placementRow(1, { path: placementRow(0).path })],
      [placementRow(0), placementRow(1, { id: placementRow(0).id })],
      [placementRow(0), placementRow(1, { position: 0 })],
      [placementRow(1), placementRow(0)],
      [placementRow(0), { ...placementRow(1), ownerId: 'leak' }],
    ]) {
      expect(parsesAsPlacement(items), JSON.stringify(items)).toBe(false);
      const response = await forward(success({ items }));
      expect(response.status, JSON.stringify(items)).toBe(502);
    }
  });
});

describe('CMS-03C-02 web proxy: admission guards before any upstream call', () => {
  it('[P2-S12-AC-218] rejects invalid binding, method, admission, media, header and body locally', async () => {
    expect(
      (await forwardCmsPatternInstanceMutation(request(), null)).status,
    ).toBe(503);
    const upstream = binding(success(placementResource(1)));
    for (const [candidate, status] of [
      [request({ method: 'GET' }), 400],
      [request({ path: PLACEMENT_PATH + '?admin=1' }), 400],
      [request({ headers: { origin: 'https://evil.test' } }), 403],
      [request({ headers: { 'x-csrf-token': '' } }), 403],
      [request({ headers: { 'content-type': 'text/plain' } }), 415],
      [request({ headers: { 'idempotency-key': '' } }), 400],
      [request({ rawBody: '{' }), 400],
      [request({ body: { ...placementBody, ownerId: REVISION_ID } }), 422],
      [request({ body: { ...placementBody, expectedVersion: '2' } }), 400],
    ] as const) {
      const response = await forwardCmsPatternInstanceMutation(
        candidate,
        upstream,
      );
      expect(response.status, candidate.url).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    for (const header of ['idempotency-key', 'if-match']) {
      const missing = request();
      missing.headers.delete(header);
      expect(
        (await forwardCmsPatternInstanceMutation(missing, upstream)).status,
      ).toBe(400);
    }
    expect(upstream.fetch).not.toHaveBeenCalled();
  });
});

describe('CMS-03C-02 web proxy: malformed and legacy upstream success', () => {
  it('[P2-S12-AC-010] fails closed 502 on the legacy single-resource body', async () => {
    const response = await forward(success(legacySingleRow()));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('[P2-S12-AC-218] fails closed 502 on a non-list, empty, over-cap or extra-key body', async () => {
    for (const value of [
      { items: [] },
      { items: placementRows(513) },
      { ...placementResource(1), total: 1 },
      {},
    ]) {
      const response = await forward(success(value));
      expect(response.status, JSON.stringify(value)).toBe(502);
    }
  });

  it('[P2-S12-AC-218] fails closed 503 on a transport fault without disclosing it', async () => {
    for (const result of [new Error('private endpoint'), { bad: true }]) {
      const response = await forward(result);
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain(
        'private endpoint',
      );
    }
  });

  it('[P2-S12-AC-218] fails closed 502 on a wrong-status or malformed success', async () => {
    for (const result of [
      success(placementResource(1), 200),
      new Response('{', { status: 201 }),
    ]) {
      const response = await forward(result);
      expect(response.status).toBe(502);
    }
  });
});

describe('CMS-03C-02 web proxy: declared error relay', () => {
  const error = (status: number, code: string) =>
    new Response(
      JSON.stringify({
        code,
        message: code + ': composition operation rejected or unavailable.',
        requestId: 'd3000000-0000-4000-8000-000000000014',
        details: {},
      }),
      { status, headers: { 'content-type': 'application/json' } },
    );

  it('[P2-S12-AC-218] relays declared refusals and fails closed on an undeclared status', async () => {
    for (const [upstream, status] of [
      [error(409, 'COMPOSITION_VERSION_CONFLICT'), 409],
      [error(429, 'RATE_LIMITED'), 429],
      [error(503, 'DEPENDENCY_UNAVAILABLE'), 503],
      [new Response('{}', { status: 418 }), 502],
      [new Response('{', { status: 409 }), 502],
    ] as const) {
      const response = await forward(upstream);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });
});

describe('CMS-03C-02 web proxy: selected-root response binding (DEC-193)', () => {
  it('[P2-S12-AC-218] forwards the selected set without reordering sparse successor rows', async () => {
    for (const slotPath of ['/main/sidebar', '/']) {
      const prefix = slotPath === '/' ? '' : slotPath;
      const body = {
        ...placementBody,
        slotPath,
        roots: ['/namespace/hero2', '/hero0'],
      };
      const items = [
        placementRow(0, { path: prefix + '/hero0', position: 4, version: '2' }),
        placementRow(2, {
          path: prefix + '/namespace/hero2',
          position: 11,
          version: '1',
        }),
      ];
      const upstream = binding(success({ items }, 201, '"7"'));
      const response = await forwardCmsPatternInstanceMutation(
        request({ body }),
        upstream,
      );
      expect(upstream.fetch).toHaveBeenCalledTimes(1);
      const sent = upstream.fetch.mock.calls[0]?.[0] as Request;
      expect(await sent.json()).toEqual(body);
      expect(response.status).toBe(201);
      expect(response.headers.get('etag')).toBe('"7"');
      expect(await response.json()).toEqual({ items });
    }
  });

  it.each([
    ['wrong root', ['/hero1'], ['/hero0'], '/main'],
    ['extra root', ['/hero0'], ['/hero0', '/hero1'], '/main'],
    ['missing root', ['/hero0', '/hero1'], ['/hero0'], '/main'],
    ['prefix descendant', ['/hero0'], ['/hero0/child'], '/main'],
    ['root-slot mismatch', ['/namespace/hero0'], ['/namespace/hero1'], '/'],
    ['nested-slot descendant', ['/hero0'], ['/hero0/child'], '/main/sidebar'],
  ] as const)(
    '[P2-S12-AC-218] fails closed 502 on a schema-valid %s selection result',
    async (name, roots, paths, slotPath) => {
      const prefix = slotPath === '/' ? '' : slotPath;
      const items = paths.map((path, index) =>
        placementRow(index, { path: prefix + path }),
      );
      expect(parsesAsPlacement(items), name).toBe(true);
      const response = await forward(success({ items }), {
        body: { ...placementBody, slotPath, roots },
      });
      expect(response.status, name).toBe(502);
    },
  );
});
