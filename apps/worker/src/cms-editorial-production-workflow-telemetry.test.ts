import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@wejammin/observability/logging';

import { productionCmsEditorialTelemetry } from './cms-editorial-production-telemetry';
import type { CmsEditorialTelemetryEvent } from './cms-editorial-production-types';

/*
 * The production sink writes the request event for every operation and the
 * command, RPC and acceptance events only for the state-changing ones (BE03b
 * "Observability"): the Slice 11 commands are commands, its reads are not.
 */

const event = (
  operationId: CmsEditorialTelemetryEvent['operationId'],
): CmsEditorialTelemetryEvent => ({
  operationId,
  requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  outcome: 'success',
  status: 200,
  durationMs: 4,
  actorClass: 'human',
  runbook: 'cms-editorial',
  traceSteps: ['cms.admission', 'cms.rpc', 'cms.response'],
});

const eventNames = (
  operationId: CmsEditorialTelemetryEvent['operationId'],
): string[] => {
  const info = vi.fn();
  productionCmsEditorialTelemetry({ info } as unknown as Logger)(
    event(operationId),
  );
  return info.mock.calls.map(
    (call) => (call[0] as { eventName: string }).eventName,
  );
};

describe('Slice 11 telemetry classes', () => {
  it.each([
    'CMS-03B-05',
    'CMS-03B-06',
    'CMS-03B-07',
    'CMS-03B-08',
    'CMS-03B-09',
    'CMS-03B-18',
  ] as const)('%s writes the command, rpc and acceptance events', (id) => {
    expect(eventNames(id)).toEqual([
      'cms.editorial.request',
      'cms.editorial.command',
      'cms.editorial.rpc',
      'cms.editorial.acceptance',
    ]);
  });

  it.each(['CMS-03B-15', 'CMS-03B-16', 'CMS-03B-17'] as const)(
    '%s writes the request event alone',
    (id) => {
      expect(eventNames(id)).toEqual(['cms.editorial.request']);
    },
  );
});
