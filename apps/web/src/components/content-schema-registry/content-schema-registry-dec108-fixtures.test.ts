import {
  ContentSchemaRegistryDetailSchema,
  SchemaActivationPreparationSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  emptyActivationPreparation,
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
  queuedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import { detail } from './content-schema-registry-server-test-values';
import {
  ACTOR_ID,
  APPROVE_A_ID,
  APPROVE_B_ID,
  PARTY_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  TYPE_ID,
  VERSION_ID,
  approvedProtectedReview,
  assignmentResource,
  decisionResource,
  draftDetail,
  dryRunResource,
  reviewResource,
  sha256,
} from './content-schema-review-dec108.test-support';

/**
 * Guards for the DEC-108 web fixtures themselves. Every fixture is real,
 * schema-valid data produced through the generated strict contracts, never a
 * loosened schema, and the privacy scan's identifiers do not collide with the
 * legitimate record identifiers it must tolerate.
 */

describe('[DEC-108] fixtures are schema-valid contract data', () => {
  it('parses every activationPreparation fixture through the generated schema', () => {
    for (const fixture of [
      emptyActivationPreparation,
      startDryRunPreparation,
      queuedDryRunPreparation,
      passedDryRunPreparation,
      approvedReviewPreparation,
    ])
      expect(SchemaActivationPreparationSchema.safeParse(fixture).success).toBe(
        true,
      );
  });

  it('rejects an invalid preparation instead of loosening the schema', () => {
    expect(() =>
      activationPreparation({
        dryRunRef: {
          id: REVIEW_ID,
          state: 'queued',
          result: null,
          jobId: null,
        },
        jobRef: null,
        permittedNextActions: ['not_an_action' as 'activate'],
      }),
    ).toThrow();
  });

  it('keeps the shared server detail fixture valid with real activationPreparation', () => {
    const parsed = ContentSchemaRegistryDetailSchema.safeParse(detail);
    expect(parsed.success).toBe(true);
    expect(detail.activationPreparation).toBe(emptyActivationPreparation);
  });

  it('builds draft detail, review, decision, assignment and dry-run fixtures through their schemas', () => {
    expect(draftDetail().resource.state).toBe('draft');
    expect(dryRunResource().state).toBe('queued');
    expect(reviewResource().state).toBe('open');
    expect(decisionResource().decision).toBe('approve');
    expect(assignmentResource().actions).toStrictEqual(['read', 'decide']);
  });

  it('carries the approve-decision ids of the approved review in server order', () => {
    expect(
      approvedProtectedReview().decisions.map((decision) => decision.id),
    ).toStrictEqual([APPROVE_A_ID, APPROVE_B_ID]);
  });
});

describe('[DEC-108] privacy-scan fixture integrity', () => {
  it('hashes with SHA-256 (published test vectors)', () => {
    expect(sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(
      sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('[P2-S09-AC-974] gives the private identifiers no 8-character prefix or suffix shared with legitimate record ids', () => {
    const compact = (value: string) => value.replaceAll('-', '');
    const legitimate = [
      TYPE_ID,
      VERSION_ID,
      REVIEW_ID,
      APPROVE_A_ID,
      APPROVE_B_ID,
    ].map(compact);
    for (const privateId of [ACTOR_ID, PARTY_ID, REVIEWER_PERSON_ID]) {
      const value = compact(privateId);
      for (const other of legitimate) {
        expect(other.startsWith(value.slice(0, 8))).toBe(false);
        expect(other.endsWith(value.slice(-8))).toBe(false);
      }
    }
  });
});
