import * as contracts from '@wejammin/contracts';
import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  BROWSER_OPERATIONS,
  INTERNAL_OPERATIONS,
  NUMBERED_IDS,
  SUPPORTING_READ_IDS,
} from './phase-02-slice-12-registry-parity-fixture';
import {
  errorMatrixStatuses,
  internalOperationRows,
  parseRate,
  routeRegistryRows,
} from './phase-02-slice-12-registry-parity-spec';

/*
 * P2-S12-AC-275, part 1: the BE03c Route Registry, the parity fixture and the platform route
 * registry agree on every browser operation. OpenAPI and Hono parity are in the sibling
 * `phase-02-slice-12-registry-parity-openapi.test.ts` and `...-hono.test.ts`.
 */

const registryRow = (id: string) =>
  platformRegistrySet.routes.find((row) => row.operationId === id);
const specRows = routeRegistryRows();
const specRow = (id: string) => specRows.find((row) => row.id === id);
const exported = contracts as unknown as Readonly<
  Record<string, { shape?: Readonly<Record<string, unknown>> } | undefined>
>;

describe('[P2-S12-AC-275] the BE03c Route Registry is the browser inventory', () => {
  it('[P2-S12-AC-275] lists exactly CMS-03C-01 to CMS-03C-17 and the nine named supporting reads', () => {
    const ids = specRows.map((row) => row.id);
    expect([...ids].sort()).toEqual(
      [...NUMBERED_IDS, ...SUPPORTING_READ_IDS].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(BROWSER_OPERATIONS.map((operation) => operation.id).sort()).toEqual(
      [...ids].sort(),
    );
  });

  it('[P2-S12-AC-275] names CMS-03C-18 to CMS-03C-21 only as internal service operations', () => {
    const internal = internalOperationRows();
    expect(Object.keys(internal).sort()).toEqual(
      Object.keys(INTERNAL_OPERATIONS).sort(),
    );
    for (const [id, names] of Object.entries(INTERNAL_OPERATIONS))
      for (const name of names)
        expect(internal[id], `${id} ${name}`).toContain(name);
    expect(
      specRows.some((row) => /CMS-03C-(?:18|19|20|21)/u.test(row.id)),
    ).toBe(false);
  });
});

describe.each(
  BROWSER_OPERATIONS.map((operation) => [operation.id, operation] as const),
)('[P2-S12-AC-275] %s', (id, expected) => {
  it('[P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag', () => {
    const spec = specRow(id);
    expect(spec, `${id} ${expected.cite}`).toBeDefined();
    if (spec === undefined) return;
    expect(`${spec.method} ${spec.path}`).toBe(
      `${expected.method} ${expected.path}`,
    );
    expect(parseRate(spec.rate), spec.rate).toEqual({
      user: expected.user,
      party: expected.party,
      timeoutMs: expected.timeoutMs,
      noStore: true,
      tier: expected.tier,
    });
    expect(spec.middleware).toContain('cms-console');
    expect(spec.middleware.includes('no CSRF')).toBe(expected.csrf === 'none');
    expect(/\bCSRF\b/u.test(spec.middleware.replace('no CSRF', ''))).toBe(
      expected.csrf === 'required',
    );
    expect(/step-up MFA/u.test(spec.middleware)).toBe(
      expected.stepUp === 'required',
    );
    expect(
      /\bno (?:idempotency|Idempotency-Key)\b/u.test(spec.concurrency),
    ).toBe(expected.idempotency === 'none');
    expect(/^key\b/u.test(spec.concurrency)).toBe(
      expected.idempotency === 'required',
    );
    const ifMatch =
      /\bno (?:Idempotency-Key or |idempotency or )?If-Match\b/u.test(
        spec.concurrency,
      )
        ? 'none'
        : /If-Match when editing/u.test(spec.concurrency)
          ? 'conditional'
          : /If-Match/u.test(spec.concurrency)
            ? 'required'
            : 'none';
    expect(ifMatch).toBe(expected.ifMatch);
    const etag = /strong ETag/u.test(spec.concurrency)
      ? 'strong'
      : /ETag on page version/u.test(spec.concurrency)
        ? 'page'
        : /no entity tag/u.test(spec.concurrency)
          ? 'none'
          : 'unstated';
    expect(etag).toBe(expected.etag);
    const successPart =
      spec.text.split('|').find((cell) => cell.includes('→')) ?? '';
    if (expected.request !== null)
      expect(successPart).toContain(expected.request);
    expect(successPart).toContain(expected.success.slice(0, -'Schema'.length));
    const arrow = successPart.split('→')[1] ?? '';
    const statuses = [...arrow.matchAll(/(?<![\d,])(20[0-2])(?![\d,])/gu)].map(
      (match) => match[1],
    );
    expect([...new Set(statuses)].sort()).toEqual([
      ...expected.successStatuses,
    ]);
    expect(spec.text).toContain('ApiError');
  });

  it('[P2-S12-AC-275] the fixture error statuses equal the BE03c Contract and error matrix row', () => {
    expect(errorMatrixStatuses()[id], `${id} has a matrix row`).toEqual(
      [...expected.errors].sort((a, b) => a - b),
    );
  });

  it('[P2-S12-AC-275] every capability the spec Auth cell names is in the fixture, and the fixture names no other', () => {
    const spec = specRow(id);
    const named = [
      ...(spec?.auth.matchAll(/cms\.[a-z_]+(?:\.[a-z_]+)?/gu) ?? []),
    ]
      .map((match) => match[0])
      // `cms.definition_review` is the assignment, not a capability grant.
      .filter((capability) => capability !== 'cms.definition_review');
    const fixture = expected.capabilities ?? [];
    for (const capability of named) expect(fixture).toContain(capability);
    if (named.length > 0)
      expect([...fixture].sort()).toEqual([...new Set(named)].sort());
  });

  it('[P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO', () => {
    const row = registryRow(id);
    expect(row, `${id} is registered`).toBeDefined();
    if (row === undefined) return;
    expect(row).toEqual(
      expect.objectContaining({
        method: expected.method,
        path: expected.path,
        authClass: expected.authClass,
        corsClass: 'cms-console',
        audience: 'browser',
        csrf: expected.csrf,
        rawBodySignature: 'none',
        idempotency: expected.idempotency,
        ifMatch: expected.ifMatch,
        rateClass: expected.rateClass,
        rateLimit: expected.user,
        partyRateLimit: expected.party,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: expected.timeoutMs,
        sloTier: `tier_${expected.tier}`,
        cacheClass: 'no_store',
        cacheControl: 'no-store',
        requestSchema: expected.apiRequest,
        successSchema: expected.success,
        errorSchemas: ['ApiErrorSchema'],
      }),
    );
    expect(row.stepUp ?? 'none').toBe(expected.stepUp);
    expect(row.capabilities).toEqual(expected.capabilities);
    if (expected.capabilityMode !== undefined)
      expect(row.capabilityMode).toBe(expected.capabilityMode);
    if (row.slo !== undefined) {
      expect(row.slo.tier).toBe(expected.tier);
      expect(row.slo.commandP95Ms).toBe(expected.tier === 2 ? 1_200 : 750);
    }
    expect((row.bolaTest ?? '').length).toBeGreaterThan(0);
  });

  it('[P2-S12-AC-275] the registry request schema wraps the BE03c request schema as its body and the success schema is a contracts export', () => {
    expect(exported[expected.success], expected.success).toBeDefined();
    // `EmptyRequestSchema` is the generator's own no-request marker (`EMPTY_REQUEST_SCHEMA`), not an export.
    if (expected.apiRequest !== 'EmptyRequestSchema')
      expect(exported[expected.apiRequest], expected.apiRequest).toBeDefined();
    if (expected.request === null) return;
    const specSchema = exported[`${expected.request}Schema`];
    expect(specSchema, `${expected.request}Schema`).toBeDefined();
    expect(exported[expected.apiRequest]?.shape?.body).toBe(specSchema);
  });
});

describe('[P2-S12-AC-275] the platform route registry holds no other Slice 12 browser operation', () => {
  it('[P2-S12-AC-275] registers CMS-03C-01 to CMS-03C-17 contiguously as numbered ids and never CMS-03C-18 to CMS-03C-21', () => {
    const numbered = platformRegistrySet.routes
      .map((row) => row.operationId)
      .filter((id) => /^CMS-03C-/u.test(id));
    expect([...numbered].sort()).toEqual([...NUMBERED_IDS]);
    for (const id of Object.keys(INTERNAL_OPERATIONS))
      expect(registryRow(id), id).toBeUndefined();
  });

  it('[P2-S12-AC-275] carries no internal RPC, job or provider name in any registry operation id, path or schema name', () => {
    const haystack = platformRegistrySet.routes
      .flatMap((row) => [
        row.operationId,
        row.path,
        row.requestSchema,
        row.successSchema,
      ])
      .join('\n');
    for (const name of Object.values(INTERNAL_OPERATIONS).flat())
      expect(haystack, name).not.toContain(name);
  });

  it('[P2-S12-AC-275] keeps every method and path of the 26 operations unique in the registry', () => {
    const keys = platformRegistrySet.routes.map(
      (row) => `${row.method} ${row.path}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
