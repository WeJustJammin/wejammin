import { PatternPlacementResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createCmsPatternInstanceApp } from './pattern-instance-routes';
import {
  CMS_PLACEMENT_MAX_RESPONSE_BYTES,
  legacySingleRow,
  MAX_DEFAULT_RESPONSE_BYTES,
  placementAtBytes,
  placementBindingCases,
  placementBody,
  placementBodyWithDigest,
  placementByteLength,
  placementResource,
  placementRow,
  placementRows,
  placementRowsAtPaths,
  placementSuccess,
} from './pattern-placement.test-support';
import {
  httpPlacementDependencies,
  httpPlacementRequest,
  httpPlacementRequestAtRoot,
} from './pattern-placement-dependencies.test-support';

describe('CMS-03C-02 pattern placement at the HTTP app.request boundary', () => {
  const post = async (
    dependencies: ReturnType<typeof httpPlacementDependencies>,
  ) =>
    createCmsPatternInstanceApp(dependencies).request(httpPlacementRequest());

  it('[P2-S12-AC-010] answers 201 with the placement list and the forwarded entry ETag', async () => {
    const rows = placementRows(3);
    const response = await post(
      httpPlacementDependencies(async () => placementSuccess(3)),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items: rows });
    expect(response.headers.get('etag')).toBe('"7"');
    expect(response.headers.get('etag')).not.toBe('"1"');
  });

  it('[P2-S12-AC-010] answers 201 with a full 512-row placement without truncation', async () => {
    const response = await post(
      httpPlacementDependencies(async () => placementSuccess(512)),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items: placementRows(512) });
  });

  it('[P2-S12-AC-218] answers 201 for a placement appended after the slot rows', async () => {
    const rows = [placementRow(3), placementRow(4)];
    const response = await post(
      httpPlacementDependencies(async () => ({
        ok: true,
        value: { items: rows },
        etag: '"7"',
      })),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items: rows });
  });

  it('[P2-S12-AC-218] refuses a placement whose serialized body exceeds the response budget', async () => {
    const fractional = '0'.repeat(1_100_000);
    const row = placementRow(0, {
      createdAt: '2026-09-28T14:00:00.' + fractional + 'Z',
      updatedAt: '2026-09-28T14:00:00.' + fractional + 'Z',
    });
    const value = { items: [row] };
    expect(PatternPlacementResourceSchema.safeParse(value).success).toBe(true);
    expect(
      new TextEncoder().encode(JSON.stringify(value)).byteLength,
    ).toBeGreaterThan(CMS_PLACEMENT_MAX_RESPONSE_BYTES);
    const response = await post(
      httpPlacementDependencies(async () => ({ ok: true, value, etag: '"7"' })),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(response.headers.get('etag')).toBeNull();
  });

  it('[P2-S12-AC-218] applies the final response ceiling at exactly 1 MiB', async () => {
    for (const bytes of [1_048_576, 1_048_577]) {
      const value = placementAtBytes(bytes);
      expect(PatternPlacementResourceSchema.safeParse(value).success).toBe(
        true,
      );
      expect(new TextEncoder().encode(JSON.stringify(value)).byteLength).toBe(
        bytes,
      );
      const response = await post(
        httpPlacementDependencies(async () => ({
          ok: true,
          value,
          etag: '"7"',
        })),
      );
      expect(response.status).toBe(bytes === 1_048_576 ? 201 : 502);
      if (response.status === 201) {
        const text = await response.text();
        expect(new TextEncoder().encode(text).byteLength).toBe(bytes);
        expect(JSON.parse(text)).toEqual(value);
        expect(response.headers.get('etag')).toBe('"7"');
      } else {
        expect(await response.json()).toMatchObject({
          code: 'DEPENDENCY_UNAVAILABLE',
        });
        expect(response.headers.get('etag')).toBeNull();
      }
    }
  });

  it('[P2-S12-AC-218] keeps the placement request ceiling at 256 KiB', async () => {
    for (const bytes of [262_144, 262_145]) {
      const insertPattern = vi.fn(async () => placementSuccess(1));
      const base = httpPlacementRequest();
      const json = JSON.stringify(placementBody);
      const body = json + ' '.repeat(bytes - json.length);
      expect(new TextEncoder().encode(body).byteLength).toBe(bytes);
      const response = await createCmsPatternInstanceApp(
        httpPlacementDependencies(insertPattern),
      ).request(
        new Request(base.url, { method: 'POST', headers: base.headers, body }),
      );
      expect(response.status).toBe(bytes === 262_144 ? 201 : 400);
      expect(await response.json()).toMatchObject(
        bytes === 262_144 ? placementResource(1) : { code: 'INVALID_REQUEST' },
      );
      expect(insertPattern).toHaveBeenCalledTimes(bytes === 262_144 ? 1 : 0);
    }
  });

  it('[P2-S12-AC-218] refuses a non-normalized row path at the route', async () => {
    for (const path of ['/main/../x', '/main//root', '/main/root/', '/main/']) {
      const response = await post(
        httpPlacementDependencies(async () => ({
          ok: true,
          value: { items: placementRowsAtPaths([path]) },
          etag: '"7"',
        })),
      );
      expect(response.status, path).toBe(502);
    }
  });

  it('[P2-S12-AC-218] answers 201 for a root-slot placement', async () => {
    const response = await createCmsPatternInstanceApp(
      httpPlacementDependencies(async () => ({
        ok: true,
        value: { items: placementRowsAtPaths(['/hero']) },
        etag: '"7"',
      })),
    ).request(httpPlacementRequestAtRoot());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      items: placementRowsAtPaths(['/hero']),
    });
  });

  it('[P2-S12-AC-218] fails closed on a legacy single-resource placement', async () => {
    const response = await post(
      httpPlacementDependencies(async () => ({
        ok: true,
        value: legacySingleRow(),
        etag: '"7"',
      })),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('[P2-S12-AC-218] fails closed on a missing or malformed port ETag', async () => {
    for (const etag of [undefined, 7, '7']) {
      const response = await post(
        httpPlacementDependencies(async () => ({
          ok: true,
          value: placementResource(1),
          etag,
        })),
      );
      expect(response.status, String(etag)).toBe(502);
    }
  });

  it('[P2-S12-AC-218] fails closed when a schema-valid forest does not bind the request', async () => {
    for (const binding of placementBindingCases()) {
      expect(
        PatternPlacementResourceSchema.safeParse({ items: binding.items })
          .success,
        binding.label,
      ).toBe(true);
      const response = await createCmsPatternInstanceApp(
        httpPlacementDependencies(async () => ({
          ok: true,
          value: { items: binding.items },
          etag: '"7"',
        })),
      ).request(
        httpPlacementRequest(
          binding.bodyDigest ? { body: placementBodyWithDigest } : {},
        ),
      );
      expect(response.status, binding.label).toBe(502);
    }
  });

  it('[P2-S12-AC-218] fails closed on a malformed or duplicate-path forest', async () => {
    for (const candidate of [
      { items: [placementRow(0), placementRow(1, { path: '/main/root0' })] },
      { items: [placementRow(0), placementRow(1, { position: 0 })] },
      { items: [] },
      { items: [placementRow(0), { ...placementRow(1), ownerId: 'leak' }] },
    ]) {
      const response = await post(
        httpPlacementDependencies(async () => ({
          ok: true,
          value: candidate,
          etag: '"7"',
        })),
      );
      expect(response.status, JSON.stringify(candidate)).toBe(502);
    }
  });

  it('[P2-S12-AC-218] accepts sparse retained and new placement positions', async () => {
    const items = [
      placementRow(0, { version: '2' }),
      placementRow(1, { position: 2 }),
    ];
    const response = await post(
      httpPlacementDependencies(async () => ({
        ok: true,
        value: { items },
        etag: '"7"',
      })),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"7"');
    expect(await response.json()).toEqual({ items });
  });

  it('[P2-S12-AC-218] preserves the port precondition while accepting a placement', async () => {
    const insertPattern = vi.fn(async () => placementSuccess(1));
    const response = await post(httpPlacementDependencies(insertPattern));
    expect(response.status).toBe(201);
    expect(insertPattern).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03C-02',
        body: placementBody,
        ifMatch: '1',
        idempotencyKey: 'placement-command-0001',
      }),
      expect.any(AbortSignal),
    );
  });
});

describe('PatternPlacementResource cardinality (schema control, DEC-175/DEC-181)', () => {
  it('[P2-S12-AC-010] accepts 1 and 512 rows and refuses 0 and 513', () => {
    expect(
      PatternPlacementResourceSchema.safeParse(placementResource(1)).success,
    ).toBe(true);
    expect(
      PatternPlacementResourceSchema.safeParse(placementResource(512)).success,
    ).toBe(true);
    expect(
      PatternPlacementResourceSchema.safeParse({ items: [] }).success,
    ).toBe(false);
    expect(
      PatternPlacementResourceSchema.safeParse(placementResource(513)).success,
    ).toBe(false);
  });

  it('[P2-S12-AC-218] holds the 512-row body within the approved budget', () => {
    expect(placementByteLength(512)).toBeGreaterThan(
      MAX_DEFAULT_RESPONSE_BYTES,
    );
    expect(placementByteLength(512)).toBeLessThanOrEqual(
      CMS_PLACEMENT_MAX_RESPONSE_BYTES,
    );
  });
});

describe('CMS-03C-02 selected-root response binding (DEC-193)', () => {
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
      const insertPattern = vi.fn(async (input: { body: unknown }) => {
        expect(input.body).toEqual(body);
        return { ok: true, value: { items }, etag: '"7"' };
      });
      const response = await createCmsPatternInstanceApp(
        httpPlacementDependencies(insertPattern),
      ).request(httpPlacementRequest({ body }));
      expect(insertPattern).toHaveBeenCalledTimes(1);
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
      expect(
        PatternPlacementResourceSchema.safeParse({ items }).success,
        name,
      ).toBe(true);
      const response = await createCmsPatternInstanceApp(
        httpPlacementDependencies(async () => ({
          ok: true,
          value: { items },
          etag: '"7"',
        })),
      ).request(
        httpPlacementRequest({ body: { ...placementBody, slotPath, roots } }),
      );
      expect(response.status, name).toBe(502);
    },
  );
});
