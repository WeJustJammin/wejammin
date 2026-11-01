import {
  CMS_EDITORIAL_JOB_TYPES,
  isReviewRecheckSourceEventType,
  type ReviewDependencyRecheckMessage,
  type ReviewRecheckSourceEventType,
} from '@wejammin/contracts';

/** What a platform queue message is to the dependency recheck, if anything. */
export type ReviewRecheckMessageClass =
  | Readonly<{ kind: 'job' }>
  | Readonly<{
      kind: 'source-event';
      /** The v1 event type of the family, whatever version the message names. */
      eventType: ReviewRecheckSourceEventType;
    }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Recognises a queue message that belongs to the dependency recheck.
 *
 * - A recheck job message names its job type.
 * - A source event is an event of one of the six families at any version, so an
 *   unknown version reaches its consumer's dead-letter path.
 * - A `cms.schema.activated` message that carries a `payload` is the full
 *   activation envelope of the schema migration worker, not the identifier-only
 *   envelope the outbox relay places on the queue; it stays with that worker.
 */
export const classifyReviewRecheckMessage = (
  body: unknown,
): ReviewRecheckMessageClass | null => {
  if (!isRecord(body)) return null;
  if (body.jobType === CMS_EDITORIAL_JOB_TYPES.dependencyRecheck)
    return { kind: 'job' };
  if (!isReviewRecheckSourceEventType(body.eventType)) return null;
  if (body.eventType.startsWith('cms.schema.activated.') && 'payload' in body)
    return null;
  return {
    kind: 'source-event',
    eventType: body.eventType.replace(
      /\.v[0-9]+$/u,
      '.v1',
    ) as ReviewRecheckSourceEventType,
  };
};

/** The platform jobs queue, narrowed to what the recheck sends. */
export type ReviewRecheckQueue = Readonly<{
  send: (message: ReviewDependencyRecheckMessage) => Promise<void>;
}>;
