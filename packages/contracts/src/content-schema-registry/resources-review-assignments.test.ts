import { describe, expect, it } from 'vitest';

import {
  SchemaReviewAssignmentSummarySchema,
  SchemaReviewResourceSchema,
} from './resources.ts';
import {
  instant,
  openReview,
  uuid,
  uuid2,
} from './review-fixtures.test-support.ts';

const summary = {
  assignmentId: uuid2,
  version: '1',
  state: 'active' as const,
  startsAt: instant,
  endsAt: '2026-10-05T12:00:00.000Z',
  reviewerLabel: 'Reviewer 1',
};

describe('SchemaReviewResource owner-only assignment summaries', () => {
  it('defaults an absent summary list to the empty non-owner projection', () => {
    const parsed = SchemaReviewResourceSchema.parse(openReview);
    expect(parsed.assignments).toEqual([]);
  });

  it('accepts a safe summary with a display label and no person identifier', () => {
    const parsed = SchemaReviewResourceSchema.parse({
      ...openReview,
      assignments: [
        summary,
        { ...summary, assignmentId: uuid, state: 'revoked' },
      ],
    });
    expect(parsed.assignments).toHaveLength(2);
    expect(Object.keys(parsed.assignments[0] ?? {}).sort()).toEqual([
      'assignmentId',
      'endsAt',
      'reviewerLabel',
      'startsAt',
      'state',
      'version',
    ]);
  });

  it.each([
    ['a person UUID key', { ...summary, reviewerPersonId: uuid }],
    ['a whitespace-only label', { ...summary, reviewerLabel: '   ' }],
    ['an empty label', { ...summary, reviewerLabel: '' }],
    ['an over-long label', { ...summary, reviewerLabel: 'x'.repeat(121) }],
    ['a label that is a UUID', { ...summary, reviewerLabel: uuid }],
    ['an unknown state', { ...summary, state: 'lapsed' }],
    ['a non-UUID assignment id', { ...summary, assignmentId: 'abc' }],
    [
      'an end before the start',
      { ...summary, endsAt: '2026-10-01T12:00:00.000Z' },
    ],
    [
      'a span over seven days',
      { ...summary, endsAt: '2026-10-09T12:00:00.001Z' },
    ],
  ])('rejects %s', (_name, value) => {
    expect(SchemaReviewAssignmentSummarySchema.safeParse(value).success).toBe(
      false,
    );
  });

  it('accepts a 120-character label', () => {
    expect(
      SchemaReviewAssignmentSummarySchema.safeParse({
        ...summary,
        reviewerLabel: 'x'.repeat(120),
      }).success,
    ).toBe(true);
  });

  it('accepts exactly seven days and rejects a zero-length span', () => {
    expect(
      SchemaReviewAssignmentSummarySchema.safeParse({
        ...summary,
        endsAt: '2026-10-09T12:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      SchemaReviewAssignmentSummarySchema.safeParse({
        ...summary,
        endsAt: summary.startsAt,
      }).success,
    ).toBe(false);
  });

  it('bounds the list at eight entries and rejects duplicate assignment ids', () => {
    const eight = Array.from({ length: 8 }, (_, index) => ({
      ...summary,
      assignmentId: `123e4567-e89b-42d3-a456-4266141740${String(index).padStart(2, '0')}`,
    }));
    expect(
      SchemaReviewResourceSchema.safeParse({
        ...openReview,
        assignments: eight,
      }).success,
    ).toBe(true);
    const many = Array.from({ length: 9 }, (_, index) => ({
      ...summary,
      assignmentId: `123e4567-e89b-42d3-a456-4266141740${String(index).padStart(2, '0')}`,
    }));
    expect(
      SchemaReviewResourceSchema.safeParse({ ...openReview, assignments: many })
        .success,
    ).toBe(false);
    expect(
      SchemaReviewResourceSchema.safeParse({
        ...openReview,
        assignments: [summary, summary],
      }).success,
    ).toBe(false);
  });
});
