import { describe, expect, it } from 'vitest';

import { classifyReviewRecheckMessage } from './message';
import {
  AGGREGATE_FOR,
  jobBody,
  sourceBody,
} from './review-recheck.test-support';
import { REVIEW_RECHECK_SOURCE_EVENT_TYPES } from '@wejammin/contracts';

describe('[P2-S11-AC-113] classifying a platform queue message for the review recheck', () => {
  it('recognises a recheck job message by its job type', () => {
    expect(classifyReviewRecheckMessage(jobBody())).toEqual({ kind: 'job' });
  });

  it.each(REVIEW_RECHECK_SOURCE_EVENT_TYPES)(
    'recognises the identifier-only %s envelope of the relay',
    (eventType) => {
      expect(classifyReviewRecheckMessage(sourceBody(eventType))).toEqual({
        kind: 'source-event',
        eventType,
      });
      expect(AGGREGATE_FOR[eventType]).toMatch(/^cms_/u);
    },
  );

  it('routes every version of a family to the consumer of its v1 event type', () => {
    expect(
      classifyReviewRecheckMessage(
        sourceBody('cms.taxonomy.changed.v1', {
          eventType: 'cms.taxonomy.changed.v12',
        }),
      ),
    ).toEqual({ kind: 'source-event', eventType: 'cms.taxonomy.changed.v1' });
  });

  it('leaves the full activation envelope of the schema migration worker to that worker', () => {
    expect(
      classifyReviewRecheckMessage({
        ...sourceBody('cms.schema.activated.v1'),
        payload: { contentTypeId: 'x' },
      }),
    ).toBeNull();
  });

  it('keeps a payload on any other source event for its consumer to dead-letter', () => {
    expect(
      classifyReviewRecheckMessage({
        ...sourceBody('cms.template.activated.v1'),
        payload: {},
      }),
    ).toEqual({
      kind: 'source-event',
      eventType: 'cms.template.activated.v1',
    });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'cms.schema.activated.v1'],
    ['another cms event', { eventType: 'cms.entry.review-changed.v1' }],
    ['a platform job request', { eventType: 'job.requested' }],
    [
      'a schema dry-run event',
      { eventType: 'cms.schema.dry_run.requested.v1' },
    ],
    ['another job type', { jobType: 'cms.publication_schedule.execute' }],
    ['an object with nothing', {}],
  ])('does not recognise %s', (_name, body) => {
    expect(classifyReviewRecheckMessage(body)).toBeNull();
  });
});
