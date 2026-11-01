import {
  REVIEW_RECHECK_SOURCES,
  type ReviewDependencyEventResolution,
  type ReviewDependencyRecheckMessage,
  type ReviewDependencyRecheckRunResult,
  type ReviewRecheckSourceEventType,
} from '@wejammin/contracts';
import { vi } from 'vitest';

import {
  IDS,
  NOW,
  recordingDeadLetter,
  recordingTelemetry,
} from '../../event-consumers/test-support';
import type { ReviewRecheckSourceDependencies } from './source-consumers';

export { IDS, NOW, recordingDeadLetter, recordingTelemetry };

/** The identity the database resolves a source event to, and the cursor of a run. */
export const REF = '88888888-8888-4888-8888-888888888888';
export const CURSOR = '99999999-9999-4999-8999-999999999999';

/** The aggregate each relayed source event arrives with. */
export const AGGREGATE_FOR: Readonly<
  Record<ReviewRecheckSourceEventType, string>
> = {
  'cms.schema.activated.v1': 'cms_content_type_version',
  'cms.template.activated.v1': 'cms_template_version',
  'cms.pattern.activated.v1': 'cms_pattern_version',
  'cms.taxonomy.changed.v1': 'cms_taxonomy_version',
  'cms.localization.changed.v1': 'cms_locale_variant',
  'cms.block.lifecycle.changed.v1': 'cms_block_definition_version',
};

/** The identifier-only queue envelope the relay places on the queue. */
export const sourceBody = (
  eventType: ReviewRecheckSourceEventType,
  patch: Readonly<Record<string, unknown>> = {},
) => ({
  eventId: IDS.event,
  eventType,
  schemaVersion: 1,
  occurredAt: '2026-10-10T12:00:00.000Z',
  producer: REVIEW_RECHECK_SOURCES[eventType].producer,
  aggregateType: AGGREGATE_FOR[eventType],
  aggregateId: IDS.aggregate,
  aggregateVersion: '4',
  correlationId: IDS.correlation,
  causationId: null,
  ...patch,
});

/** A recheck job queue message. */
export const jobBody = (
  patch: Partial<ReviewDependencyRecheckMessage> = {},
): ReviewDependencyRecheckMessage => ({
  jobType: 'cms.review.dependency_recheck',
  schemaVersion: 1,
  payload: { eventId: IDS.event, kind: 'schema', refId: REF },
  cursor: null,
  correlationId: IDS.correlation,
  ...patch,
});

export const fakeQueue = (fails = false) => {
  const sent: ReviewDependencyRecheckMessage[] = [];
  const send = vi.fn(async (message: ReviewDependencyRecheckMessage) => {
    if (fails) throw new Error('queue down');
    sent.push(message);
  });
  return { queue: { send }, send, sent };
};

export const runResult = (
  patch: Partial<ReviewDependencyRecheckRunResult> = {},
): ReviewDependencyRecheckRunResult => ({
  examined: 3,
  invalidated: 1,
  nextCursor: null,
  ...patch,
});

export const buildSourceDependencies = (
  options: Readonly<{
    resolution?: ReviewDependencyEventResolution | Error;
    queueFails?: boolean;
    deadLetterFails?: boolean;
    withClock?: boolean;
  }> = {},
  kind: Extract<
    ReviewDependencyEventResolution,
    { found: true }
  >['kind'] = 'schema',
) => {
  const resolveEvent = vi.fn(
    async (): Promise<ReviewDependencyEventResolution> => {
      const resolution =
        options.resolution ?? ({ found: true, kind, refId: REF } as const);
      if (resolution instanceof Error) throw resolution;
      return resolution;
    },
  );
  const queue = fakeQueue(options.queueFails);
  const deadLetter = recordingDeadLetter(options.deadLetterFails);
  const { logs, telemetry } = recordingTelemetry();
  const dependencies: ReviewRecheckSourceDependencies = {
    resolveEvent,
    queue: queue.queue,
    deadLetter: deadLetter.port,
    telemetry,
    ...(options.withClock === false
      ? {}
      : { clock: { now: () => NOW, randomUuid: () => IDS.request } }),
  };
  return { dependencies, resolveEvent, queue, deadLetter, logs };
};
