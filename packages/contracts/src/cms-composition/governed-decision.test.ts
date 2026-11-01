import { describe, expect, it } from 'vitest';

import { CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH } from '../cms-editorial/if-match';
import {
  isRefused,
  issueMessages,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  GovernedDecisionApiRequestSchema,
  GovernedDecisionHeadersSchema,
  GovernedDecisionRequestSchema,
} from './governed-decision';

const reviewId = uid(30);
const decision = {
  reviewId,
  decision: 'approve',
  reason: 'The block tree meets the profile spine.',
  expectedVersion: '4',
} as const;
const headers = {
  contentType: 'application/json',
  idempotencyKey: 'governed-decide-0001',
  ifMatch: '"4"',
} as const;

describe('CMS-03C-07 governed decision contract', () => {
  it('[P2-S12-AC-070] accepts approve and reject with the review id, reason and review version', () => {
    expect(GovernedDecisionRequestSchema.parse(decision)).toEqual(decision);
    expect(
      GovernedDecisionRequestSchema.parse({ ...decision, decision: 'reject' })
        .decision,
    ).toBe('reject');
  });

  it('[P2-S12-AC-070] refuses capability and stepUpAt as unknown keys because both are server-derived', () => {
    for (const extra of [
      { capability: 'cms.reviewer' },
      { stepUpAt: '2026-10-13T12:00:00Z' },
      { reviewerPersonId: uid(1) },
      { ownerId: uid(1) },
      { subjectHash: 'a'.repeat(64) },
    ])
      expect(
        isRefused(GovernedDecisionRequestSchema, { ...decision, ...extra }),
      ).toBe(true);
  });

  it('[P2-S12-AC-071] refuses a decision outside approve and reject, a bad review id and a bad review version', () => {
    for (const candidate of [
      { ...decision, decision: 'abstain' },
      { ...decision, decision: 'APPROVE' },
      { ...decision, decision: '' },
      { ...decision, reviewId: 'not-a-uuid' },
      { ...decision, expectedVersion: '0' },
      { ...decision, expectedVersion: '01' },
      { ...decision, expectedVersion: 4 },
      { ...decision, expectedVersion: '9223372036854775808' },
      without(decision, 'reason'),
      without(decision, 'decision'),
      without(decision, 'expectedVersion'),
      without(decision, 'reviewId'),
    ])
      expect(isRefused(GovernedDecisionRequestSchema, candidate)).toBe(true);
    expect(
      GovernedDecisionRequestSchema.safeParse({
        ...decision,
        expectedVersion: '9223372036854775807',
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-071] bounds the reason at 1 to 2000 code points counted by character, not UTF-16 unit', () => {
    const withReason = (reason: string) => ({ ...decision, reason });
    for (const reason of [
      'x',
      'x'.repeat(2000),
      '😀'.repeat(2000),
      'Zażółć gęślą jaźń',
    ])
      expect(
        GovernedDecisionRequestSchema.safeParse(withReason(reason)).success,
      ).toBe(true);
    for (const reason of ['', 'x'.repeat(2001), '😀'.repeat(2001)])
      expect(isRefused(GovernedDecisionRequestSchema, withReason(reason))).toBe(
        true,
      );
  });

  it('[P2-S12-AC-071] refuses a reason that is not NFC, carries a control, separator or bidirectional character, or has markup delimiters', () => {
    const withReason = (reason: string) => ({ ...decision, reason });
    const refusals = [
      'café',
      'bell\u0007',
      'nul\u0000',
      'tab\there',
      'line\nbreak',
      'del\u007f',
      'c1\u0085',
      'ls x',
      'ps x',
      'rlm‏x',
      'lrm‎x',
      'alm؜x',
      'rlo‮x',
      'lri⁦x',
      'pdi⁩x',
      'a<b',
      'a>b',
      'a{b',
      'a}b',
    ];
    for (const reason of refusals)
      expect(
        isRefused(GovernedDecisionRequestSchema, withReason(reason)),
        JSON.stringify(reason),
      ).toBe(true);
    expect(
      GovernedDecisionRequestSchema.safeParse(
        withReason('Reviewed (see https://example.com/a?b=c&d=e) — fine.'),
      ).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-073] requires JSON, a bounded idempotency key and a strong quoted If-Match', () => {
    expect(GovernedDecisionHeadersSchema.parse(headers)).toEqual(headers);
    for (const candidate of [
      without(headers, 'ifMatch'),
      { ...headers, ifMatch: 'W/"4"' },
      { ...headers, ifMatch: '4' },
      { ...headers, ifMatch: '"0"' },
      { ...headers, ifMatch: '"04"' },
      { ...headers, contentType: 'text/plain' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, stepUpAt: '2026-10-13T12:00:00Z' },
    ])
      expect(isRefused(GovernedDecisionHeadersSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-071] composes the review path, headers and body and reports each fault at the member that owns it', () => {
    const transport = { reviewId, headers, body: decision };
    expect(GovernedDecisionApiRequestSchema.parse(transport)).toEqual(
      transport,
    );
    // The path review id must equal the body review id (case-insensitively).
    expect(
      GovernedDecisionApiRequestSchema.safeParse({
        ...transport,
        reviewId: reviewId.toUpperCase(),
      }).success,
    ).toBe(true);
    const otherPath = { ...transport, reviewId: uid(31) };
    expect(issuePaths(GovernedDecisionApiRequestSchema, otherPath)).toEqual([
      'body.reviewId',
    ]);
    expect(issueMessages(GovernedDecisionApiRequestSchema, otherPath)).toEqual([
      'review_id_path_body_mismatch',
    ]);
    // The strong If-Match must equal the body expectedVersion exactly.
    const staleHeader = {
      ...transport,
      headers: { ...headers, ifMatch: '"5"' },
    };
    expect(issuePaths(GovernedDecisionApiRequestSchema, staleHeader)).toEqual([
      'headers.ifMatch',
    ]);
    expect(
      issueMessages(GovernedDecisionApiRequestSchema, staleHeader),
    ).toEqual([CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH]);
    // A malformed member is reported at its own member only, never as a mismatch.
    const malformed = {
      ...transport,
      headers: { ...headers, ifMatch: 'W/"4"' },
    };
    expect(
      new Set(issuePaths(GovernedDecisionApiRequestSchema, malformed)),
    ).toEqual(new Set(['headers.ifMatch']));
    expect(
      issueMessages(GovernedDecisionApiRequestSchema, malformed),
    ).not.toContain(CMS_IF_MATCH_EXPECTED_VERSION_MISMATCH);
    expect(
      isRefused(GovernedDecisionApiRequestSchema, {
        ...transport,
        query: {},
      }),
    ).toBe(true);
    expect(
      isRefused(
        GovernedDecisionApiRequestSchema,
        without(transport, 'reviewId'),
      ),
    ).toBe(true);
  });
});
