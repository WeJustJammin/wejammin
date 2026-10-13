import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_EVENT_TYPES,
  CmsEditorialEventSchema,
  CmsPublicationChangedPayloadSchema,
  CmsReviewChangedPayloadSchema,
  CmsRevisionCreatedPayloadSchema,
  CmsRevisionRestoredPayloadSchema,
} from './index';
import {
  hash,
  uid,
  uuid,
  uuid2,
  uuid3,
} from './workflow-fixtures.test-support';

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

const envelope = {
  eventId: uid(70),
  schemaVersion: 1,
  occurredAt: '2026-10-08T12:00:00Z',
  producer: 'cms.editorial',
  correlationId: uid(71),
  causationId: uid(72),
} as const;

const reviewChanged = {
  ...envelope,
  eventType: 'cms.entry.review-changed.v1',
  aggregateType: 'cms_editorial_review',
  aggregateId: uuid,
  aggregateVersion: '3',
  payload: { reviewId: uuid, revisionId: uuid2 },
} as const;

const publicationChanged = {
  ...envelope,
  eventType: 'cms.publication.changed.v1',
  aggregateType: 'cms_publication',
  aggregateId: uuid3,
  aggregateVersion: '2',
  payload: { entryId: uuid, publicationVersionId: uuid2 },
} as const;

describe('[P2-S11-AC-010][P2-S11-AC-070][P2-S11-AC-084] identifier-only CMS editorial events', () => {
  it('owns exactly the four 03b event types', () => {
    expect([...CMS_EDITORIAL_EVENT_TYPES]).toEqual([
      'cms.entry.revision-created.v1',
      'cms.entry.revision-restored.v1',
      'cms.entry.review-changed.v1',
      'cms.publication.changed.v1',
    ]);
  });

  it('carries cms.entry.review-changed.v1 as { reviewId, revisionId } only', () => {
    expect(CmsReviewChangedPayloadSchema.parse(reviewChanged.payload)).toEqual(
      reviewChanged.payload,
    );
    expect(refused(CmsReviewChangedPayloadSchema, { reviewId: uuid })).toBe(
      true,
    );
    expect(
      refused(CmsReviewChangedPayloadSchema, {
        ...reviewChanged.payload,
        state: 'approved',
      }),
    ).toBe(true);
    expect(
      refused(CmsReviewChangedPayloadSchema, {
        ...reviewChanged.payload,
        comment: 'text',
      }),
    ).toBe(true);
    expect(
      refused(CmsReviewChangedPayloadSchema, {
        ...reviewChanged.payload,
        reviewerPersonId: uuid,
      }),
    ).toBe(true);
    expect(
      refused(CmsReviewChangedPayloadSchema, {
        reviewId: 'x',
        revisionId: uuid2,
      }),
    ).toBe(true);
  });

  it('carries cms.publication.changed.v1 as { entryId, publicationVersionId } only', () => {
    expect(
      CmsPublicationChangedPayloadSchema.parse(publicationChanged.payload),
    ).toEqual(publicationChanged.payload);
    expect(refused(CmsPublicationChangedPayloadSchema, { entryId: uuid })).toBe(
      true,
    );
    expect(
      refused(CmsPublicationChangedPayloadSchema, {
        ...publicationChanged.payload,
        revisionId: uuid3,
      }),
    ).toBe(true);
    expect(
      refused(CmsPublicationChangedPayloadSchema, {
        ...publicationChanged.payload,
        versionSet: {},
      }),
    ).toBe(true);
    expect(
      refused(CmsPublicationChangedPayloadSchema, {
        ...publicationChanged.payload,
        token: 'x',
      }),
    ).toBe(true);
  });

  it('keeps the Slice 10 payloads exact', () => {
    expect(
      CmsRevisionCreatedPayloadSchema.safeParse({
        entryId: uuid,
        revisionId: uuid2,
      }).success,
    ).toBe(true);
    expect(refused(CmsRevisionCreatedPayloadSchema, { entryId: uuid })).toBe(
      true,
    );
    const restored = {
      entryId: uuid,
      revisionId: uuid2,
      sourceRevisionId: uuid3,
      migrationChainId: uid(9),
      chainHash: hash,
      edgeCount: 64,
      valueCount: 0,
      relationCount: 12,
    };
    expect(CmsRevisionRestoredPayloadSchema.parse(restored)).toEqual(restored);
    expect(
      refused(CmsRevisionRestoredPayloadSchema, { ...restored, edgeCount: 65 }),
    ).toBe(true);
    expect(
      refused(CmsRevisionRestoredPayloadSchema, { ...restored, edgeCount: -1 }),
    ).toBe(true);
    expect(
      refused(CmsRevisionRestoredPayloadSchema, {
        ...restored,
        valueCount: -1,
      }),
    ).toBe(true);
    expect(
      refused(CmsRevisionRestoredPayloadSchema, {
        ...restored,
        valueCount: 1.5,
      }),
    ).toBe(true);
    expect(
      refused(CmsRevisionRestoredPayloadSchema, {
        ...restored,
        chainHash: 'x',
      }),
    ).toBe(true);
    expect(
      refused(CmsRevisionRestoredPayloadSchema, { ...restored, values: {} }),
    ).toBe(true);
  });

  it('wraps each payload in the BE00 identifier-only envelope with a lossless decimal aggregate version', () => {
    expect(CmsEditorialEventSchema.parse(reviewChanged)).toEqual(reviewChanged);
    expect(CmsEditorialEventSchema.parse(publicationChanged)).toEqual(
      publicationChanged,
    );
    expect(
      CmsEditorialEventSchema.safeParse({
        ...reviewChanged,
        aggregateVersion: '9223372036854775807',
      }).success,
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        aggregateVersion: '9223372036854775808',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        aggregateVersion: 3,
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        aggregateVersion: '0',
      }),
    ).toBe(true);
    expect(
      CmsEditorialEventSchema.safeParse({ ...reviewChanged, causationId: null })
        .success,
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, { ...reviewChanged, schemaVersion: 2 }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        producer: 'identity.authority',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        occurredAt: '2026-10-08',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, { ...reviewChanged, actorId: uuid }),
    ).toBe(true);
  });

  it('refuses an unknown event type and a payload of another event type', () => {
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        eventType: 'cms.entry.review-changed.v2',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...reviewChanged,
        payload: publicationChanged.payload,
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...publicationChanged,
        payload: reviewChanged.payload,
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialEventSchema, {
        ...publicationChanged,
        aggregateType: 'cms_editorial_review',
      }),
    ).toBe(true);
  });
});
