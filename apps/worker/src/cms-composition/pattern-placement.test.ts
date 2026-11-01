import { PatternPlacementResourceSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CMS_PLACEMENT_MAX_RESPONSE_BYTES,
  legacySingleRow,
  MAX_DEFAULT_RESPONSE_BYTES,
  placementAtBytes,
  placementBindingCases,
  placementBody,
  placementBodyWithDigest,
  placementDeclaredLengthResponse,
  placementEtagCases,
  placementErrorResponse,
  placementResource,
  placementRow,
  placementRows,
  placementRowsAtPaths,
  placementRpcResponse,
  placementStreamedResponse,
} from './pattern-placement.test-support';
import {
  productionPlacementDependencies,
  productionPlacementInput,
  productionPlacementInputAtRoot,
} from './pattern-placement-dependencies.test-support';

const signal = () => new AbortController().signal;
const itemsOf = (result: unknown) => (result as { value: unknown }).value;
const etagJson = (items: unknown) =>
  Response.json({ items }, { headers: { etag: '"7"' } });

describe('CMS-03C-02 pattern placement at the production adapter boundary', () => {
  it('[P2-S12-AC-010] returns the placement list with the forwarded entry ETag', async () => {
    const rows = placementRows(3);
    const result = await productionPlacementDependencies(
      vi.fn(async () => placementRpcResponse(3)) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(result).toEqual({ ok: true, value: { items: rows }, etag: '"7"' });
    expect(
      PatternPlacementResourceSchema.safeParse(itemsOf(result)).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-010] fails closed on a legacy single-resource placement body', async () => {
    const result = await productionPlacementDependencies(
      vi.fn(async () => etagJson(legacySingleRow())) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(result).not.toHaveProperty('value');
  });

  it('[P2-S12-AC-218] fails closed when a schema-valid forest does not bind the request', async () => {
    for (const binding of placementBindingCases()) {
      expect(
        PatternPlacementResourceSchema.safeParse({ items: binding.items })
          .success,
        binding.label,
      ).toBe(true);
      const input = binding.bodyDigest
        ? productionPlacementInput({ body: { ...placementBodyWithDigest } })
        : productionPlacementInput();
      const result = await productionPlacementDependencies(
        vi.fn(async () => etagJson(binding.items)) as typeof fetch,
      ).insertPattern(input, signal());
      expect(result, binding.label).toMatchObject({ ok: false, status: 502 });
    }
  });

  it('[P2-S12-AC-218] accepts placements within the response ceiling', async () => {
    for (const count of [1, 2, 33]) {
      const result = await productionPlacementDependencies(
        vi.fn(async () => placementRpcResponse(count)) as typeof fetch,
      ).insertPattern(productionPlacementInput(), signal());
      expect(result, String(count)).toMatchObject({ ok: true });
    }
  });

  it('[P2-S12-AC-218] accepts a placement appended after the slot rows', async () => {
    const rows = [placementRow(3), placementRow(4)];
    const result = await productionPlacementDependencies(
      vi.fn(async () => etagJson(rows)) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(result).toEqual({ ok: true, value: { items: rows }, etag: '"7"' });
  });

  it('[P2-S12-AC-218] refuses non-normalized row paths under the slot', async () => {
    for (const path of [
      '/main/../x',
      '/main//root',
      '/main/root/',
      '/main',
      '/main/',
      '/mainx/root',
    ]) {
      const items = placementRowsAtPaths([path]);
      const result = await productionPlacementDependencies(
        vi.fn(async () => etagJson(items)) as typeof fetch,
      ).insertPattern(productionPlacementInput(), signal());
      expect(result, path).toMatchObject({ ok: false, status: 502 });
    }
  });

  it('[P2-S12-AC-218] accepts a normalized descendant and a root-slot path', async () => {
    const descendant = await productionPlacementDependencies(
      vi.fn(async () =>
        etagJson(placementRowsAtPaths(['/main/hero'])),
      ) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(descendant).toMatchObject({ ok: true });
    const atRoot = await productionPlacementDependencies(
      vi.fn(async () =>
        etagJson(placementRowsAtPaths(['/hero'])),
      ) as typeof fetch,
    ).insertPattern(productionPlacementInputAtRoot(), signal());
    expect(atRoot).toMatchObject({ ok: true });
    for (const path of ['/']) {
      const refused = await productionPlacementDependencies(
        vi.fn(async () =>
          etagJson(placementRowsAtPaths([path])),
        ) as typeof fetch,
      ).insertPattern(productionPlacementInputAtRoot(), signal());
      expect(refused, path).toMatchObject({ ok: false, status: 502 });
    }
  });

  it('[P2-S12-AC-218] fails closed on an empty or non-list placement body', async () => {
    for (const candidate of [
      { items: [] },
      { ...placementResource(1), total: 1 },
      {},
    ]) {
      const result = await productionPlacementDependencies(
        vi.fn(async () => etagJson(candidate)) as typeof fetch,
      ).insertPattern(productionPlacementInput(), signal());
      expect(result).toMatchObject({ ok: false, status: 502 });
    }
  });

  it('[P2-S12-AC-218] fails closed on a missing, weak, zero or overflow ETag', async () => {
    for (const etag of placementEtagCases()) {
      const result = await productionPlacementDependencies(
        vi.fn(async () => placementRpcResponse(1, etag.header)) as typeof fetch,
      ).insertPattern(productionPlacementInput(), signal());
      expect(result, etag.label).toMatchObject(
        etag.ok ? { ok: true } : { ok: false, status: 502 },
      );
    }
  });

  it('[P2-S12-AC-218] forwards an entry ETag that differs from every row version', async () => {
    const result = await productionPlacementDependencies(
      vi.fn(async () => placementRpcResponse(2, '"42"')) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(result).toMatchObject({ ok: true, etag: '"42"' });
    expect(placementRows(2).every((row) => row.version !== '42')).toBe(true);
  });

  it('[P2-S12-AC-218] enforces the approved 1 MiB decoded-response budget', async () => {
    for (const [declaredLength, expected] of [
      [CMS_PLACEMENT_MAX_RESPONSE_BYTES, { ok: true }],
      [CMS_PLACEMENT_MAX_RESPONSE_BYTES + 1, { ok: false, status: 502 }],
    ] as const) {
      const result = await productionPlacementDependencies(
        vi.fn(async () =>
          placementDeclaredLengthResponse(1, declaredLength),
        ) as typeof fetch,
      ).insertPattern(productionPlacementInput(), signal());
      expect(result, String(declaredLength)).toMatchObject(expected);
    }
  });

  it('[P2-S12-AC-218] accepts exactly 1 MiB of decoded placement JSON', async () => {
    const value = placementAtBytes(CMS_PLACEMENT_MAX_RESPONSE_BYTES);
    expect(PatternPlacementResourceSchema.safeParse(value).success).toBe(true);
    const response = Response.json(value, { headers: { etag: '"7"' } });
    expect((await response.clone().arrayBuffer()).byteLength).toBe(1_048_576);
    const result = await productionPlacementDependencies(
      vi.fn(async () => response) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(result).toEqual({ ok: true, value, etag: '"7"' });
  });

  it.each([false, true])(
    '[P2-S12-AC-218] caps RPC errors at 256 KiB (declared length: %s)',
    async (declareLength) => {
      for (const configured of [
        undefined,
        CMS_PLACEMENT_MAX_RESPONSE_BYTES * 2,
      ]) {
        for (const bytes of [
          MAX_DEFAULT_RESPONSE_BYTES,
          MAX_DEFAULT_RESPONSE_BYTES + 1,
        ]) {
          const response = placementErrorResponse(bytes, declareLength);
          expect((await response.clone().arrayBuffer()).byteLength).toBe(bytes);
          expect(bytes).toBeLessThan(CMS_PLACEMENT_MAX_RESPONSE_BYTES);
          const result = await productionPlacementDependencies(
            vi.fn(async () => response) as typeof fetch,
            configured,
          ).insertPattern(productionPlacementInput(), signal());
          expect(result).toMatchObject(
            bytes === MAX_DEFAULT_RESPONSE_BYTES
              ? {
                  ok: false,
                  status: 409,
                  code: 'COMPOSITION_VERSION_CONFLICT',
                  details: {
                    conflict: 'VERSION_MISMATCH',
                    recoveryAction: 'reload',
                  },
                }
              : {
                  ok: false,
                  status: 503,
                  code: 'DEPENDENCY_UNAVAILABLE',
                  details: {
                    dependencyClass: 'cms_editorial',
                    retryable: true,
                  },
                },
          );
          expect(result).not.toHaveProperty('value');
          expect(JSON.stringify(result)).not.toContain('private');
        }
      }
    },
  );

  it('[P2-S12-AC-218] preserves a tighter configured RPC error budget', async () => {
    for (const [bytes, status] of [
      [128, 409],
      [129, 503],
    ] as const) {
      const result = await productionPlacementDependencies(
        vi.fn(async () => placementErrorResponse(bytes, false)) as typeof fetch,
        128,
      ).insertPattern(productionPlacementInput(), signal());
      expect(result).toMatchObject({ ok: false, status });
    }
  });

  it('[P2-S12-AC-218] refuses a streamed body one byte over the approved budget', async () => {
    const result = await productionPlacementDependencies(
      vi.fn(async () =>
        placementStreamedResponse(CMS_PLACEMENT_MAX_RESPONSE_BYTES + 1),
      ) as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('[P2-S12-AC-218] clamps a configured limit to the ceiling and keeps a tighter limit', async () => {
    const over = CMS_PLACEMENT_MAX_RESPONSE_BYTES * 2;
    const accepted = await productionPlacementDependencies(
      vi.fn(async () =>
        placementDeclaredLengthResponse(1, CMS_PLACEMENT_MAX_RESPONSE_BYTES),
      ) as typeof fetch,
      over,
    ).insertPattern(productionPlacementInput(), signal());
    expect(accepted).toMatchObject({ ok: true });
    const clamped = await productionPlacementDependencies(
      vi.fn(async () =>
        placementDeclaredLengthResponse(
          1,
          CMS_PLACEMENT_MAX_RESPONSE_BYTES + 1,
        ),
      ) as typeof fetch,
      over,
    ).insertPattern(productionPlacementInput(), signal());
    expect(clamped).toMatchObject({ ok: false, status: 502 });
    const tighter = await productionPlacementDependencies(
      vi.fn(async () =>
        placementDeclaredLengthResponse(1, MAX_DEFAULT_RESPONSE_BYTES + 1),
      ) as typeof fetch,
      MAX_DEFAULT_RESPONSE_BYTES,
    ).insertPattern(productionPlacementInput(), signal());
    expect(tighter).toMatchObject({ ok: false, status: 502 });
  });

  it('[P2-S12-AC-218] forwards the placement request to the exact private RPC', async () => {
    const fetchImpl = vi.fn(async () => placementRpcResponse(1));
    await productionPlacementDependencies(
      fetchImpl as typeof fetch,
    ).insertPattern(productionPlacementInput(), signal());
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_insert_pattern_instance',
    );
    expect(JSON.parse(String(init.body)).p_request).toMatchObject({
      ...placementBody,
      idempotencyKey: 'placement-command-0001',
      ifMatch: '1',
    });
  });
});
