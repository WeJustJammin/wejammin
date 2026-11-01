import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_JOB_TYPES,
  CMS_REVIEW_RECHECK_BATCH_MAX,
  isReviewRecheckSourceEventType,
  REVIEW_RECHECK_SOURCES,
  REVIEW_RECHECK_SOURCE_EVENT_TYPES,
  ReviewDependencyEventResolutionSchema,
  ReviewDependencyRecheckMessageSchema,
  ReviewDependencyRecheckRunRequestSchema,
  ReviewDependencyRecheckRunResultSchema,
  ReviewRecheckSourceEnvelopeSchema,
} from './index';

const EVENT = '11111111-1111-4111-8111-111111111111';
const AGGREGATE = '22222222-2222-4222-8222-222222222222';
const CORRELATION = '33333333-3333-4333-8333-333333333333';
const REF = '44444444-4444-4444-8444-444444444444';
const CURSOR = '55555555-5555-4555-8555-555555555555';

const AGGREGATE_FOR: Record<string, string> = {
  'cms.schema.activated.v1': 'cms_content_type_version',
  'cms.template.activated.v1': 'cms_template_version',
  'cms.pattern.activated.v1': 'cms_pattern_version',
  'cms.taxonomy.changed.v1': 'cms_taxonomy_version',
  'cms.localization.changed.v1': 'cms_locale_variant',
  'cms.block.lifecycle.changed.v1': 'cms_block_definition_version',
};

const envelope = (
  eventType: string,
  patch: Readonly<Record<string, unknown>> = {},
) => ({
  eventId: EVENT,
  eventType,
  schemaVersion: 1,
  occurredAt: '2026-10-10T12:00:00.000Z',
  producer:
    REVIEW_RECHECK_SOURCES[eventType as keyof typeof REVIEW_RECHECK_SOURCES]
      ?.producer ?? 'cms.composition',
  aggregateType: AGGREGATE_FOR[eventType] ?? 'cms_content_entry',
  aggregateId: AGGREGATE,
  aggregateVersion: '7',
  correlationId: CORRELATION,
  causationId: null,
  ...patch,
});

describe('[P2-S11-AC-113] review recheck source events', () => {
  it('names exactly the six event types whose consumers enqueue cms.review.dependency_recheck', () => {
    expect(REVIEW_RECHECK_SOURCE_EVENT_TYPES).toEqual([
      'cms.schema.activated.v1',
      'cms.template.activated.v1',
      'cms.pattern.activated.v1',
      'cms.taxonomy.changed.v1',
      'cms.localization.changed.v1',
      'cms.block.lifecycle.changed.v1',
    ]);
    expect(Object.keys(REVIEW_RECHECK_SOURCES)).toEqual([
      ...REVIEW_RECHECK_SOURCE_EVENT_TYPES,
    ]);
  });

  it('maps every event type to one dependency index kind and a registered producer', () => {
    expect(
      Object.fromEntries(
        Object.entries(REVIEW_RECHECK_SOURCES).map(([type, source]) => [
          type,
          [source.kind, source.producer],
        ]),
      ),
    ).toEqual({
      'cms.schema.activated.v1': ['schema', 'cms.schema_registry'],
      'cms.template.activated.v1': ['template', 'cms.composition'],
      'cms.pattern.activated.v1': ['pattern', 'cms.composition'],
      'cms.taxonomy.changed.v1': ['taxonomy_version', 'cms.composition'],
      'cms.localization.changed.v1': ['locale_source', 'cms.composition'],
      'cms.block.lifecycle.changed.v1': ['block', 'cms.schema_registry'],
    });
  });

  it.each(REVIEW_RECHECK_SOURCE_EVENT_TYPES)(
    'accepts the identifier-only %s envelope and refuses a payload, another producer and another version',
    (eventType) => {
      const valid = envelope(eventType);
      expect(ReviewRecheckSourceEnvelopeSchema.parse(valid)).toEqual(valid);
      for (const patch of [
        { payload: { schemaVersionId: REF } },
        { producer: 'cms.editorial' },
        { schemaVersion: 2 },
        { aggregateVersion: '0' },
        { eventId: 'not-a-uuid' },
        { causationId: 'not-a-uuid' },
        { occurredAt: 'yesterday' },
        { extra: true },
      ])
        expect(
          ReviewRecheckSourceEnvelopeSchema.safeParse({ ...valid, ...patch })
            .success,
          JSON.stringify(patch),
        ).toBe(false);
    },
  );

  it('pins the aggregate of the events whose producers exist and accepts any registry key for the Slice 12 events', () => {
    for (const eventType of [
      'cms.schema.activated.v1',
      'cms.localization.changed.v1',
      'cms.block.lifecycle.changed.v1',
    ])
      expect(
        ReviewRecheckSourceEnvelopeSchema.safeParse(
          envelope(eventType, { aggregateType: 'job' }),
        ).success,
        eventType,
      ).toBe(false);
    for (const eventType of [
      'cms.template.activated.v1',
      'cms.pattern.activated.v1',
      'cms.taxonomy.changed.v1',
    ]) {
      expect(
        ReviewRecheckSourceEnvelopeSchema.safeParse(
          envelope(eventType, { aggregateType: 'cms_any_version' }),
        ).success,
        eventType,
      ).toBe(true);
      expect(
        ReviewRecheckSourceEnvelopeSchema.safeParse(
          envelope(eventType, { aggregateType: 'Not A Key' }),
        ).success,
        eventType,
      ).toBe(false);
    }
  });

  // BE03c "Fan-out bound and event key (D12)": the localization event is produced under the locale
  // aggregate (entry, locale) with a UUIDv5 id.  The aggregate type is the underscore token
  // `cms_locale_variant` (root ruling 2026-10-14: it matches the consumer grammar
  // `^[a-z][a-z0-9_]{0,63}$` of platform_private.consumer_dead_letters and the other Slice 12
  // aggregates); the dotted `cms.locale_variant` of the BE03c text is a spec defect.
  it('[P2-S12-AC-237] admits the locale aggregate envelope of cms.localization.changed.v1 and refuses the former and the dotted aggregate types', () => {
    const UUID_V5_AGGREGATE = '6f2c1d8e-3a54-5b9a-8c01-2d3e4f5a6b7c';
    const valid = envelope('cms.localization.changed.v1', {
      aggregateType: 'cms_locale_variant',
      aggregateId: UUID_V5_AGGREGATE,
      aggregateVersion: '3',
    });
    expect(ReviewRecheckSourceEnvelopeSchema.parse(valid)).toEqual(valid);
    expect(REVIEW_RECHECK_SOURCES['cms.localization.changed.v1']).toEqual({
      kind: 'locale_source',
      producer: 'cms.composition',
      aggregateType: 'cms_locale_variant',
    });
    expect('cms_locale_variant').toMatch(/^[a-z][a-z0-9_]{0,63}$/u);
    for (const aggregateType of [
      'cms_content_entry',
      'cms.locale_variant',
      'cms_locale_variants',
    ])
      expect(
        ReviewRecheckSourceEnvelopeSchema.safeParse({
          ...valid,
          aggregateType,
        }).success,
        aggregateType,
      ).toBe(false);
  });

  it('refuses an event type outside the six', () => {
    expect(
      ReviewRecheckSourceEnvelopeSchema.safeParse(
        envelope('cms.entry.review-changed.v1'),
      ).success,
    ).toBe(false);
  });

  it('routes every version of the six families, so an unknown version reaches the dead-letter path', () => {
    for (const eventType of REVIEW_RECHECK_SOURCE_EVENT_TYPES) {
      expect(isReviewRecheckSourceEventType(eventType)).toBe(true);
      expect(
        isReviewRecheckSourceEventType(eventType.replace(/v1$/u, 'v2')),
      ).toBe(true);
    }
    for (const other of [
      'cms.entry.review-changed.v1',
      'cms.schema.dry_run.requested.v1',
      'cms.schema.activated',
      'job.requested',
      42,
      null,
    ])
      expect(isReviewRecheckSourceEventType(other)).toBe(false);
  });
});

describe('[P2-S11-AC-113] review recheck job message and RPC contracts', () => {
  const message = {
    jobType: 'cms.review.dependency_recheck',
    schemaVersion: 1,
    payload: { eventId: EVENT, kind: 'schema', refId: REF },
    cursor: null,
    correlationId: CORRELATION,
  };

  it('wraps the strict { eventId, kind, refId } payload with a continuation cursor', () => {
    expect(message.jobType).toBe(CMS_EDITORIAL_JOB_TYPES.dependencyRecheck);
    expect(ReviewDependencyRecheckMessageSchema.parse(message)).toEqual(
      message,
    );
    expect(
      ReviewDependencyRecheckMessageSchema.parse({
        ...message,
        cursor: CURSOR,
      }).cursor,
    ).toBe(CURSOR);
    for (const patch of [
      { jobType: 'cms.publication_schedule.execute' },
      { schemaVersion: 2 },
      { cursor: 'x' },
      { cursor: undefined },
      { correlationId: 'x' },
      { payload: { ...message.payload, reviewId: REF } },
      { payload: { eventId: EVENT, kind: 'media', refId: REF } },
      { payload: { eventId: EVENT, kind: 'schema' } },
      { extra: 1 },
    ])
      expect(
        ReviewDependencyRecheckMessageSchema.safeParse({
          ...message,
          ...patch,
        }).success,
        JSON.stringify(patch),
      ).toBe(false);
  });

  it('accepts a resolved event identity or a not-found answer and nothing else', () => {
    expect(
      ReviewDependencyEventResolutionSchema.parse({ found: false }),
    ).toEqual({ found: false });
    expect(
      ReviewDependencyEventResolutionSchema.parse({
        found: true,
        kind: 'block',
        refId: REF,
      }),
    ).toEqual({ found: true, kind: 'block', refId: REF });
    for (const bad of [
      { found: false, kind: 'block' },
      { found: true, kind: 'block' },
      { found: true, kind: 'media', refId: REF },
      { found: true, kind: 'block', refId: 'x' },
      { found: 'yes' },
      {},
      null,
    ])
      expect(
        ReviewDependencyEventResolutionSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
  });

  it('sends the job payload and the cursor to the run RPC', () => {
    const request = {
      eventId: EVENT,
      kind: 'pattern',
      refId: REF,
      cursor: CURSOR,
    };
    expect(ReviewDependencyRecheckRunRequestSchema.parse(request)).toEqual(
      request,
    );
    expect(
      ReviewDependencyRecheckRunRequestSchema.parse({
        ...request,
        cursor: null,
      }).cursor,
    ).toBeNull();
    for (const bad of [
      { ...request, cursor: undefined },
      { ...request, reviewId: REF },
      { eventId: EVENT, kind: 'pattern', refId: REF },
    ])
      expect(
        ReviewDependencyRecheckRunRequestSchema.safeParse(bad).success,
      ).toBe(false);
  });

  it('bounds a run at 500 reviews and allows a cursor only after a full run', () => {
    expect(CMS_REVIEW_RECHECK_BATCH_MAX).toBe(500);
    expect(
      ReviewDependencyRecheckRunResultSchema.parse({
        examined: 3,
        invalidated: 2,
        nextCursor: null,
      }),
    ).toEqual({ examined: 3, invalidated: 2, nextCursor: null });
    expect(
      ReviewDependencyRecheckRunResultSchema.parse({
        examined: 500,
        invalidated: 0,
        nextCursor: CURSOR,
      }).nextCursor,
    ).toBe(CURSOR);
    for (const bad of [
      { examined: 501, invalidated: 0, nextCursor: null },
      { examined: 2, invalidated: 3, nextCursor: null },
      { examined: -1, invalidated: 0, nextCursor: null },
      { examined: 1.5, invalidated: 0, nextCursor: null },
      { examined: 499, invalidated: 0, nextCursor: CURSOR },
      { examined: 3, invalidated: 0 },
      { examined: 3, invalidated: 0, nextCursor: null, extra: 1 },
    ])
      expect(
        ReviewDependencyRecheckRunResultSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
  });
});
