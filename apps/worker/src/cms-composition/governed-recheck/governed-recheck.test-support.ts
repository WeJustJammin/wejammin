import { vi } from 'vitest';

import { sourceBody } from '../../cms-editorial/review-recheck/review-recheck.test-support';
import {
  IDS,
  NOW,
  recordingDeadLetter,
  recordingTelemetry,
} from '../../event-consumers/test-support';
import type {
  GovernedRecheckEventResolution,
  GovernedRecheckMessage,
  GovernedRecheckRunResult,
} from './contract';
import type { GovernedRecheckSourceDependencies } from './source-consumers';

export { IDS, NOW, recordingDeadLetter, recordingTelemetry, sourceBody };

/** The identity the database resolves a source event to, and the cursor of a run. */
export const REF = '88888888-8888-4888-8888-888888888888';
export const CURSOR = '99999999-9999-4999-8999-999999999999';

/** A governed recheck job queue message. */
export const governedJobBody = (
  patch: Partial<GovernedRecheckMessage> = {},
): GovernedRecheckMessage => ({
  jobType: 'cms.governed_review.recheck',
  schemaVersion: 1,
  payload: { eventId: IDS.event, kind: 'content_type', refId: REF },
  cursor: null,
  correlationId: IDS.correlation,
  ...patch,
});

export const fakeGovernedQueue = (fails = false) => {
  const sent: GovernedRecheckMessage[] = [];
  const send = vi.fn(async (message: GovernedRecheckMessage) => {
    if (fails) throw new Error('queue down');
    sent.push(message);
  });
  return { queue: { send }, send, sent };
};

export const governedRunResult = (
  patch: Partial<GovernedRecheckRunResult> = {},
): GovernedRecheckRunResult => ({
  examined: 3,
  invalidated: 2,
  dependencyChanged: 1,
  reviewerAuthorityChanged: 1,
  unavailable: 0,
  nextCursor: null,
  ...patch,
});

type Resolution = GovernedRecheckEventResolution;

export const buildGovernedSourceDependencies = (
  options: Readonly<{
    resolution?: Resolution | Error;
    queueFails?: boolean;
    withClock?: boolean;
  }> = {},
  kind: Extract<Resolution, { found: true }>['kind'] = 'content_type',
) => {
  const resolveEvent = vi.fn(async (): Promise<Resolution> => {
    const resolution =
      options.resolution ?? ({ found: true, kind, refId: REF } as const);
    if (resolution instanceof Error) throw resolution;
    return resolution;
  });
  const queue = fakeGovernedQueue(options.queueFails);
  const { logs, telemetry } = recordingTelemetry();
  const dependencies: GovernedRecheckSourceDependencies = {
    resolveEvent,
    queue: queue.queue,
    telemetry,
    ...(options.withClock === false
      ? {}
      : { clock: { now: () => NOW, randomUuid: () => IDS.request } }),
  };
  return { dependencies, resolveEvent, queue, logs };
};
