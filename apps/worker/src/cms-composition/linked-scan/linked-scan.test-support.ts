import { vi } from 'vitest';

import { sourceBody } from '../../cms-editorial/review-recheck/review-recheck.test-support';
import {
  IDS,
  NOW,
  recordingTelemetry,
} from '../../event-consumers/test-support';
import type {
  LinkedScanEventResolution,
  LinkedScanMessage,
  LinkedScanRunResult,
} from './contract';
import type { LinkedScanSourceDependencies } from './source-consumer';

export { IDS, NOW, recordingTelemetry, sourceBody };

/** The identities the database resolves a pattern activation to, and a cursor of a run. */
export const PATTERN = '88888888-8888-4888-8888-888888888888';
export const VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CURSOR = `${IDS.aggregate}.2f6d61696e2f68`;
export const NEXT_CURSOR = `${IDS.person}.2f7a`;

/** A linked-update scan job queue message. */
export const scanJobBody = (
  patch: Partial<LinkedScanMessage> = {},
): LinkedScanMessage => ({
  jobType: 'cms.pattern.linked_update_scan',
  schemaVersion: 1,
  payload: { patternId: PATTERN, patternVersionId: VERSION },
  cursor: null,
  correlationId: IDS.correlation,
  ...patch,
});

export const fakeScanQueue = (fails = false) => {
  const sent: LinkedScanMessage[] = [];
  const send = vi.fn(async (message: LinkedScanMessage) => {
    if (fails) throw new Error('queue down');
    sent.push(message);
  });
  return { queue: { send }, send, sent };
};

export const scanRunResult = (
  patch: Partial<LinkedScanRunResult> = {},
): LinkedScanRunResult => ({
  examined: 7,
  appended: 5,
  nextCursor: null,
  ...patch,
});

type Resolution = LinkedScanEventResolution;

export const buildScanSourceDependencies = (
  options: Readonly<{
    resolution?: Resolution | Error;
    queueFails?: boolean;
    withClock?: boolean;
    random?: () => number;
  }> = {},
) => {
  const resolveEvent = vi.fn(async (): Promise<Resolution> => {
    const resolution =
      options.resolution ??
      ({
        found: true,
        patternId: PATTERN,
        patternVersionId: VERSION,
      } as const);
    if (resolution instanceof Error) throw resolution;
    return resolution;
  });
  const queue = fakeScanQueue(options.queueFails);
  const { logs, telemetry } = recordingTelemetry();
  const dependencies: LinkedScanSourceDependencies = {
    resolveEvent,
    queue: queue.queue,
    telemetry,
    random: options.random ?? (() => 0),
    ...(options.withClock === false
      ? {}
      : { clock: { now: () => NOW, randomUuid: () => IDS.request } }),
  };
  return { dependencies, resolveEvent, queue, logs };
};
