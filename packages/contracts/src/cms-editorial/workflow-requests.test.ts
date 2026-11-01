import { describe, expect, it } from 'vitest';

import {
  CmsEditorialDecisionHeadersSchema,
  EditorialDecisionApiRequestSchema,
  PreviewApiRequestSchema,
  PublicationApiRequestSchema,
  PublicationScheduleApiRequestSchema,
  ReviewSubmissionApiRequestSchema,
  cmsEditorialIfMatchEqualsExpectedVersion,
  cmsEditorialIfMatchOperand,
} from './index';
import {
  uuid,
  uuid2,
  validDecision,
  validPreview,
  validPublication,
  validReviewSubmission,
  validSchedule,
  without,
} from './workflow-fixtures.test-support';

const headers = {
  contentType: 'application/json',
  idempotencyKey: 'idem-key-0001',
  ifMatch: '"3"',
} as const;

type Parser = { safeParse: (value: unknown) => { success: boolean } };
const refused = (schema: Parser, value: unknown): boolean =>
  !schema.safeParse(value).success;

describe('[P2-S11-AC-011] CMS-03B-06 decision headers', () => {
  it('requires JSON, a printable key of 8-128 characters and a quoted strong version', () => {
    expect(CmsEditorialDecisionHeadersSchema.parse(headers)).toEqual(headers);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, {
        ...headers,
        contentType: 'text/plain',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, {
        ...headers,
        idempotencyKey: 'short',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, {
        ...headers,
        idempotencyKey: 'k'.repeat(129),
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, {
        ...headers,
        idempotencyKey: ' padded-key ',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, { ...headers, ifMatch: '3' }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, {
        ...headers,
        ifMatch: 'W/"3"',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, {
        ...headers,
        ifMatch: '"0"',
      }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, { ...headers, ifMatch: '*' }),
    ).toBe(true);
    expect(
      refused(CmsEditorialDecisionHeadersSchema, { ...headers, extra: 'x' }),
    ).toBe(true);
    const withoutIfMatch = without(headers, 'ifMatch');
    expect(refused(CmsEditorialDecisionHeadersSchema, withoutIfMatch)).toBe(
      true,
    );
  });
});

describe('[P2-S11-AC-005][P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-023][P2-S11-AC-029] transport views for the five Slice 11 commands', () => {
  it('binds the path id, the command headers and the exact request body for each command', () => {
    expect(
      ReviewSubmissionApiRequestSchema.parse({
        entryId: uuid,
        headers,
        body: validReviewSubmission,
      }).entryId,
    ).toBe(uuid);
    expect(
      EditorialDecisionApiRequestSchema.parse({
        reviewId: uuid2,
        headers,
        body: validDecision,
      }).reviewId,
    ).toBe(uuid2);
    expect(
      PublicationScheduleApiRequestSchema.parse({
        headers,
        body: validSchedule,
      }).body.action,
    ).toBe('publish');
    expect(
      PreviewApiRequestSchema.parse({ headers, body: validPreview }).body.route,
    ).toBe('/music/artist/spring-2026-tour');
    expect(
      PublicationApiRequestSchema.parse({ headers, body: validPublication })
        .body.audience,
    ).toBe('members');
  });

  it('rejects an unknown member, a missing header block and a malformed body', () => {
    const cases: readonly [Parser, Record<string, unknown>][] = [
      [
        ReviewSubmissionApiRequestSchema,
        { entryId: uuid, headers, body: validReviewSubmission },
      ],
      [
        EditorialDecisionApiRequestSchema,
        { reviewId: uuid2, headers, body: validDecision },
      ],
      [PublicationScheduleApiRequestSchema, { headers, body: validSchedule }],
      [PreviewApiRequestSchema, { headers, body: validPreview }],
      [PublicationApiRequestSchema, { headers, body: validPublication }],
    ];
    for (const [schema, value] of cases) {
      expect(refused(schema, { ...value, extra: 1 })).toBe(true);
      const withoutHeaders = without(value, 'headers');
      expect(refused(schema, withoutHeaders)).toBe(true);
      expect(refused(schema, { ...value, body: {} })).toBe(true);
      expect(
        refused(schema, { ...value, headers: { ...headers, ifMatch: 'x' } }),
      ).toBe(true);
    }
    // The path id of the two path-bound commands is mandatory and a UUID.
    expect(
      refused(ReviewSubmissionApiRequestSchema, {
        headers,
        body: validReviewSubmission,
      }),
    ).toBe(true);
    expect(
      refused(ReviewSubmissionApiRequestSchema, {
        entryId: 'not-a-uuid',
        headers,
        body: validReviewSubmission,
      }),
    ).toBe(true);
    expect(
      refused(EditorialDecisionApiRequestSchema, {
        reviewId: 'x',
        headers,
        body: validDecision,
      }),
    ).toBe(true);
  });

  it('keeps the body strict: a caller capability, MFA instant or risk class is an unknown key', () => {
    expect(
      refused(EditorialDecisionApiRequestSchema, {
        reviewId: uuid2,
        headers,
        body: { ...validDecision, capability: 'cms.reviewer' },
      }),
    ).toBe(true);
    expect(
      refused(EditorialDecisionApiRequestSchema, {
        reviewId: uuid2,
        headers,
        body: { ...validDecision, stepUpAt: '2026-10-08T12:00:00Z' },
      }),
    ).toBe(true);
    expect(
      refused(ReviewSubmissionApiRequestSchema, {
        entryId: uuid,
        headers,
        body: { ...validReviewSubmission, riskClass: 'ordinary' },
      }),
    ).toBe(true);
    expect(
      refused(ReviewSubmissionApiRequestSchema, {
        entryId: uuid,
        headers,
        body: { ...validReviewSubmission, expectedVersion: '3' },
      }),
    ).toBe(true);
    expect(
      refused(PreviewApiRequestSchema, {
        headers,
        body: { ...validPreview, expectedVersion: '3' },
      }),
    ).toBe(true);
  });
});

describe('If-Match operand helpers (single definition, BE03b If-Match operands)', () => {
  it('extracts the decimal operand of a strong quoted version and nothing else', () => {
    expect(cmsEditorialIfMatchOperand('"3"')).toBe('3');
    expect(cmsEditorialIfMatchOperand('"9223372036854775807"')).toBe(
      '9223372036854775807',
    );
    for (const value of [
      '3',
      '"03"',
      '"0"',
      'W/"3"',
      '*',
      '',
      '"3',
      '"9223372036854775808"',
    ])
      expect(cmsEditorialIfMatchOperand(value), value).toBeNull();
  });

  it('requires the strong If-Match to equal the body expectedVersion exactly', () => {
    expect(cmsEditorialIfMatchEqualsExpectedVersion('"3"', '3')).toBe(true);
    expect(cmsEditorialIfMatchEqualsExpectedVersion('"3"', '4')).toBe(false);
    expect(cmsEditorialIfMatchEqualsExpectedVersion('3', '3')).toBe(false);
    expect(cmsEditorialIfMatchEqualsExpectedVersion('"3"', '03')).toBe(false);
    expect(cmsEditorialIfMatchEqualsExpectedVersion('"3"', '')).toBe(false);
  });
});
