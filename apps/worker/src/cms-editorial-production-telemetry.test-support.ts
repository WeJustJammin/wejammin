import { expect, vi } from 'vitest';

import { json } from './cms-editorial-production.test-support';
import type { CmsEditorialTelemetryEvent } from './cms-editorial-production-types';

/** A recording telemetry sink: reads the exact event a production sink receives. */
export const recorder = () => {
  const events: CmsEditorialTelemetryEvent[] = [];
  return {
    events,
    telemetry: (event: CmsEditorialTelemetryEvent) => {
      events.push(event);
    },
    settled: async (count = 1) =>
      vi.waitFor(() => expect(events.length).toBeGreaterThanOrEqual(count)),
  };
};

/** A faked PostgREST edge that answers one successful JSON body. */
export const ok = (value: unknown, headers?: HeadersInit) => () =>
  json(value, 200, headers);

export const REQUEST_TOTAL = (operation: string, outcome: string) =>
  `cms_editorial_request_total{operation="${operation}",outcome="${outcome}"}`;
