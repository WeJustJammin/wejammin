import { describe, it } from 'vitest';

import type {
  CmsEditorialDependencies,
  CmsEditorialPortInput,
  CmsEditorialTelemetry,
  CmsEditorialTelemetryEvent,
} from './cms-editorial/types';
import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  SCHEMA_VERSION_ID,
  USER_ID,
  captureInit,
  environment,
  expect,
  json,
  revisionResource,
  vi,
} from './cms-editorial-production.test-support';

/**
 * A route-shaped port input. The route seam declares every field required, so
 * this proves the production adapter accepts exactly what the route hands it
 * (including a server-derived session) with no widening of the port contract.
 */
const routePortInput = (): CmsEditorialPortInput => ({
  operationId: 'CMS-03B-01',
  requestId: REQUEST_ID,
  request: new Request(
    `https://api.example.test/api/v1/cms/entries/${ENTRY_ID}`,
  ),
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: true,
  },
  path: { entryId: ENTRY_ID },
  body: {
    entryId: ENTRY_ID,
    baseRevision: '1',
    changedPaths: ['/title'],
    values: { [SCHEMA_VERSION_ID]: 'hello' },
    locale: 'en-US',
    expectedVersion: '1',
  },
  idempotencyKey: 'idem-'.padEnd(24, 'x'),
  ifMatch: '1',
});

/**
 * The composed adapter is the value the runtime injects as
 * `WorkerDependencies.cmsEditorial`. Typing it as the frozen
 * `CmsEditorialDependencies` makes interface drift fail the typecheck, so a
 * green adapter cannot silently become unwireable.
 */
const composeRouteDependency = (
  fetchImpl: typeof fetch,
  telemetry?: CmsEditorialTelemetry,
): CmsEditorialDependencies =>
  createProductionCmsEditorialDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    ...(telemetry === undefined ? {} : { telemetry }),
  });

describe('cms editorial production composition', () => {
  it('satisfies the frozen route dependency surface', () => {
    const dependencies = composeRouteDependency(
      vi.fn() as unknown as typeof fetch,
    );
    expect(typeof dependencies.ports.appendRevision).toBe('function');
    expect(typeof dependencies.ports.listRevisions).toBe('function');
    expect(typeof dependencies.ports.getEntryDraft).toBe('function');
    expect(typeof dependencies.resolveSession).toBe('function');
    expect(typeof dependencies.rateLimit).toBe('function');
    expect(dependencies.humanOrigins).toEqual(['https://cms.example.test']);
  });

  it('drives a real RPC through the route-shaped port input', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = composeRouteDependency(
      fetchImpl as unknown as typeof fetch,
    );
    const result = await dependencies.ports.appendRevision(
      routePortInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: true, value: revisionResource });
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_create_revision',
    );
    expect((init.headers as Record<string, string>)['If-Match']).toBe('"1"');
  });

  it('accepts a telemetry sink typed for the full editorial operation union', () => {
    const events: CmsEditorialTelemetryEvent[] = [];
    const telemetry: CmsEditorialTelemetry = (event) => {
      events.push(event);
    };
    // Compile-time proof: a full-union event is accepted by the adapter seam,
    // so a route emitting for any editorial operation can inject its sink.
    telemetry({
      operationId: 'CMS-03B-04',
      requestId: REQUEST_ID,
      outcome: 'rejected',
      status: 403,
      durationMs: 1,
      actorClass: 'human',
      runbook: 'cms-editorial',
    });
    const dependencies = composeRouteDependency(
      vi.fn() as unknown as typeof fetch,
      telemetry,
    );
    expect(dependencies.telemetry).toBe(telemetry);
    expect(events).toHaveLength(1);
  });
});
