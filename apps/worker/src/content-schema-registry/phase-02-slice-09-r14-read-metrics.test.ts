import { describe, expect, it } from 'vitest';

import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  error,
} from './phase-02-slice-09-test-values';
import { makeHarness } from './phase-02-slice-09-worker-test-support';
import type { TelemetryEvent } from './types';

/**
 * AC208 for the two protected reads of the original A01-A08 operations,
 * CMS-03A-06 (list) and CMS-03A-07 (detail): each request emits the declared
 * request, latency, error and conflict counters through the telemetry sink,
 * with labels from closed sets, exactly as the A01-A04 mutations do.
 */
const read = (path: string): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    headers: {
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'x-request-id': REQUEST_ID,
    },
  });

const metricsOf = (harness: ReturnType<typeof makeHarness>) => {
  const event = harness.telemetry.mock.calls.at(-1)?.[0] as TelemetryEvent;
  return Object.fromEntries(
    Object.entries(event.metrics ?? {}).filter(([name]) =>
      name.startsWith('cms_definition_'),
    ),
  );
};

const READS = [
  ['CMS-03A-06', '/api/v1/cms/content-types', 'listContentTypes'],
  [
    'CMS-03A-07',
    `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`,
    'getContentTypeVersion',
  ],
] as const;

describe('BE03a A06 and A07 read metrics through the real route', () => {
  it.each(READS)(
    '[P2-S09-AC-208] %s emits request, latency and error counters for success, denial and failure',
    async (operation, path, port) => {
      const success = makeHarness();
      expect((await success.app.request(read(path))).status).toBe(200);
      expect(metricsOf(success)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="success"}`]: 1,
        cms_definition_latency_ms: 0,
      });

      const denied = makeHarness();
      denied.ports[port]?.mockResolvedValueOnce(
        error(403, 'FORBIDDEN', 'no', { reasonCode: 'CAPABILITY_REQUIRED' }),
      );
      expect((await denied.app.request(read(path))).status).toBe(403);
      expect(metricsOf(denied)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="denied"}`]: 1,
        [`cms_definition_error_total{code="FORBIDDEN",operation="${operation}"}`]: 1,
        cms_definition_latency_ms: 0,
      });

      const down = makeHarness();
      down.ports[port]?.mockResolvedValueOnce(
        error(503, 'DEPENDENCY_UNAVAILABLE', 'down', {}),
      );
      expect((await down.app.request(read(path))).status).toBe(503);
      expect(metricsOf(down)).toEqual({
        [`cms_definition_request_total{operation="${operation}",outcome="failed"}`]: 1,
        [`cms_definition_error_total{code="DEPENDENCY_UNAVAILABLE",operation="${operation}"}`]: 1,
        cms_definition_latency_ms: 0,
      });
    },
  );
});
