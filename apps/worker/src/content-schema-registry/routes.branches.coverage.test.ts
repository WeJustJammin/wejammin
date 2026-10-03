import { afterEach, describe, expect, it, vi } from 'vitest';

import { createContentSchemaRegistryApp } from './routes';
import { partyLimitFor } from './route-human-authority';
import { policyFor } from './route-response';
import {
  expectError,
  humanRequest,
  makeDependencies,
  ok,
  releaseRequest,
} from './routes.coverage.fixtures';
import {
  makeDec108Harness,
  requestFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';
import { TYPE_ID } from './phase-02-slice-09-test-values';

/** Valid for the contract's `z.uuid()` but not a canonical versioned UUID. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const NOW_MS = Date.parse('2026-10-02T12:00:00.000Z');
const refused = ok({
  allowed: false,
  limit: 5,
  remaining: 0,
  resetAt: Math.floor(NOW_MS / 1000) + 30,
});

const withoutClock = (overrides: Parameters<typeof makeDependencies>[0]) => {
  const { dependencies } = makeDependencies(overrides);
  const { now: _now, ...rest } = dependencies;
  return rest;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('per-party rate bucket selection', () => {
  it('adds the party limit only for rows that declare one', () => {
    expect(partyLimitFor(policyFor('CMS-03A-01'))).toEqual({
      partyLimit: 60,
    });
    expect(partyLimitFor(policyFor('CMS-03A-05'))).toEqual({});
    expect(partyLimitFor(policyFor('CMS-03A-08'))).toEqual({});
  });
});

describe('rate refusal without an injected clock', () => {
  it('refuses a human request with 429 using the wall clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW_MS);
    const app = createContentSchemaRegistryApp(withoutClock({ rate: refused }));
    const response = await app.request(
      humanRequest('/api/v1/cms/content-types'),
    );
    const body = await expectError(response, 429);
    expect(body).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 30 },
    });
  });

  it('refuses a release-worker request with 429 using the wall clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW_MS);
    const app = createContentSchemaRegistryApp(withoutClock({ rate: refused }));
    const response = await app.request(
      releaseRequest('/api/v1/cms/blocks/versions'),
    );
    const body = await expectError(response, 429);
    expect(body).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 30 },
    });
  });
});

describe('successor Location header', () => {
  const spec = specFor('CMS-03A-09');
  const location = async (value: Record<string, unknown>) => {
    const harness = makeDec108Harness({
      session: sessionResult(spec),
      port: ok({ ...(spec.output as Record<string, unknown>), ...value }),
    });
    const response = await harness.app.request(requestFor(spec));
    expect(response.status).toBe(201);
    return response.headers.get('location');
  };

  it('names the new version when both identifiers are canonical UUIDs', async () => {
    const output = spec.output as { id: string };
    expect(await location({})).toBe(
      `/api/v1/cms/content-types/${TYPE_ID}/versions/${output.id}`,
    );
  });

  it.each([
    ['a version id that is the nil UUID', { id: NIL_UUID }],
    ['a content type id that is the nil UUID', { contentTypeId: NIL_UUID }],
  ])('falls back to the request path for %s', async (_label, value) => {
    expect(await location(value)).toBe(spec.path);
  });
});
