/**
 * R2 remediation evidence for contract-level criteria the acceptance audit
 * found one-directional or character-count-wrong. Every assertion goes through
 * the exported request/resource schemas; nothing is stubbed.
 */
import { describe, expect, it } from 'vitest';

import {
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
} from './requests-grants.ts';
import { SchemaReviewResourceSchema } from './resources.ts';
import { SchemaActivationPreparationSchema } from './resources-workflow.ts';
import {
  approvedReview,
  hash2,
  instant,
  openReview,
  preparation,
  uuid2,
} from './review-fixtures.test-support.ts';

type Issue = Readonly<{ path: readonly PropertyKey[]; message: string }>;

const issuesOf = (
  schema: Readonly<{
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: Issue[] };
    };
  }>,
  value: unknown,
): readonly Issue[] => {
  const parsed = schema.safeParse(value);
  return parsed.success ? [] : (parsed.error?.issues ?? []);
};

const HASH_MESSAGE =
  'approval evidence hash exists only when the review is approved';
const DECIDED_MESSAGE = 'decidedAt exists only when the review is approved';

describe('AC378 approval evidence hash is present if and only if the review is approved', () => {
  it('[P2-S09-AC-378] reports the exact message at approvalEvidenceHash for an open review that carries a hash', () => {
    expect(
      issuesOf(SchemaReviewResourceSchema, {
        ...openReview,
        approvalEvidenceHash: hash2,
      }),
    ).toContainEqual(
      expect.objectContaining({
        path: ['approvalEvidenceHash'],
        message: HASH_MESSAGE,
      }),
    );
  });

  it('[P2-S09-AC-378] reports the exact message at approvalEvidenceHash for an approved review whose hash is null', () => {
    expect(
      issuesOf(SchemaReviewResourceSchema, {
        ...approvedReview,
        approvalEvidenceHash: null,
      }),
    ).toContainEqual(
      expect.objectContaining({
        path: ['approvalEvidenceHash'],
        message: HASH_MESSAGE,
      }),
    );
  });

  it('[P2-S09-AC-378] reports nothing at approvalEvidenceHash for a consistent approved review and a consistent open review', () => {
    for (const review of [approvedReview, openReview])
      expect(
        issuesOf(SchemaReviewResourceSchema, review).filter(
          (issue) => issue.message === HASH_MESSAGE,
        ),
      ).toEqual([]);
  });
});

describe('AC379 decidedAt is present if and only if the review is approved', () => {
  it('[P2-S09-AC-379] reports the exact message at decidedAt for an open review that carries decidedAt', () => {
    expect(
      issuesOf(SchemaReviewResourceSchema, {
        ...openReview,
        decidedAt: instant,
      }),
    ).toContainEqual(
      expect.objectContaining({
        path: ['decidedAt'],
        message: DECIDED_MESSAGE,
      }),
    );
  });

  it('[P2-S09-AC-379] reports the exact message at decidedAt for an approved review whose decidedAt is null', () => {
    expect(
      issuesOf(SchemaReviewResourceSchema, {
        ...approvedReview,
        decidedAt: null,
      }),
    ).toContainEqual(
      expect.objectContaining({
        path: ['decidedAt'],
        message: DECIDED_MESSAGE,
      }),
    );
  });

  it('[P2-S09-AC-379] reports nothing at decidedAt for a consistent approved review and a consistent open review', () => {
    for (const review of [approvedReview, openReview])
      expect(
        issuesOf(SchemaReviewResourceSchema, review).filter(
          (issue) => issue.message === DECIDED_MESSAGE,
        ),
      ).toEqual([]);
  });
});

describe('AC641 activationPreparation dryRunRef failureCode is optional, nullable and pattern bound', () => {
  const ref = (over: Record<string, unknown>) => ({
    ...preparation,
    dryRunRef: { ...(preparation.dryRunRef as object), ...over },
  });

  it('[P2-S09-AC-641] accepts a dryRunRef with the failureCode member absent', () => {
    const withoutKey: Record<string, unknown> = {
      ...(preparation.dryRunRef as Record<string, unknown>),
    };
    delete withoutKey.failureCode;
    const parsed = SchemaActivationPreparationSchema.safeParse({
      ...preparation,
      dryRunRef: withoutKey,
    });
    expect(parsed.success).toBe(true);
  });

  it('[P2-S09-AC-641] accepts a null failureCode on a non-failed reference', () => {
    expect(
      SchemaActivationPreparationSchema.parse(ref({ failureCode: null }))
        .dryRunRef?.failureCode,
    ).toBeNull();
  });

  it('[P2-S09-AC-641] accepts a code matching ^[A-Z][A-Z0-9_]{0,63}$ at its 1 and 64 character bounds on a failed reference', () => {
    for (const code of ['A', `A${'B'.repeat(63)}`])
      expect(
        SchemaActivationPreparationSchema.parse(
          ref({ state: 'failed', result: null, failureCode: code }),
        ).dryRunRef?.failureCode,
      ).toBe(code);
  });

  it('[P2-S09-AC-641] refuses a code outside the pattern at its 65 character, lowercase and leading digit bounds', () => {
    for (const code of [`A${'B'.repeat(64)}`, 'abc', '1ABC', 'A-B'])
      expect(
        SchemaActivationPreparationSchema.safeParse(
          ref({ state: 'failed', result: null, failureCode: code }),
        ).success,
      ).toBe(false);
  });
});

const NFC_E = 'é';
const NFD_E = 'é';
const ASTRAL = '\u{1F600}';

const grantWith = (reason: unknown) => ({
  subjectPersonId: uuid2,
  capability: 'cms.author',
  validThrough: '2026-10-08',
  reason,
});

describe('AC514 grant reason is 1 to 256 Unicode characters normalized NFC', () => {
  it('[P2-S09-AC-514] counts Unicode characters, not UTF-16 units or octets: 256 astral characters are accepted and 257 are refused', () => {
    expect(
      CapabilityGrantRequestSchema.safeParse(grantWith(ASTRAL.repeat(256)))
        .success,
    ).toBe(true);
    expect(
      CapabilityGrantRequestSchema.safeParse(grantWith(ASTRAL.repeat(257)))
        .success,
    ).toBe(false);
  });

  it('[P2-S09-AC-514] counts characters after NFC: 256 decomposed letters (512 code points) are accepted and 257 are refused', () => {
    expect(
      CapabilityGrantRequestSchema.safeParse(grantWith(NFD_E.repeat(256)))
        .success,
    ).toBe(true);
    expect(
      CapabilityGrantRequestSchema.safeParse(grantWith(NFD_E.repeat(257)))
        .success,
    ).toBe(false);
  });

  it('[P2-S09-AC-514] returns the NFC form of an accepted reason', () => {
    const parsed = CapabilityGrantRequestSchema.parse(grantWith(NFD_E));
    expect(parsed.reason).toBe(NFC_E);
    expect(parsed.reason?.normalize('NFC')).toBe(parsed.reason);
  });

  it('[P2-S09-AC-514] refuses an empty reason and a non-string reason', () => {
    for (const reason of ['', 1, null, ['x']])
      expect(
        CapabilityGrantRequestSchema.safeParse(grantWith(reason)).success,
      ).toBe(false);
  });

  it('[P2-S09-AC-514] applies the same bound and NFC form to the renewal and revocation reasons', () => {
    const renewal = {
      expectedVersion: '1',
      validThrough: '2026-10-08',
      reason: NFD_E,
    };
    expect(CapabilityGrantRenewalRequestSchema.parse(renewal).reason).toBe(
      NFC_E,
    );
    expect(
      CapabilityGrantRenewalRequestSchema.safeParse({
        ...renewal,
        reason: ASTRAL.repeat(257),
      }).success,
    ).toBe(false);
    const revocation = { expectedVersion: '1', reason: NFD_E };
    expect(
      CapabilityGrantRevocationRequestSchema.parse(revocation).reason,
    ).toBe(NFC_E);
    expect(
      CapabilityGrantRevocationRequestSchema.safeParse({
        ...revocation,
        reason: ASTRAL.repeat(257),
      }).success,
    ).toBe(false);
  });
});
