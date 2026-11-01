import { describe, expect, it } from 'vitest';

import type { GovernedRefusal } from './governed-review-command-transport';
import { classifyGovernedRefusal } from './governed-review-refusal';

const refusal = (
  overrides: Partial<GovernedRefusal> & {
    governed?: GovernedRefusal['governed'];
  },
): GovernedRefusal => ({
  status: 409,
  code: 'GOVERNED_REVIEW_VERSION_CONFLICT',
  reason: null,
  details: null,
  conflict: null,
  violations: [],
  retryAfterSeconds: null,
  preflightUnavailable: false,
  requestId: 'req-1',
  governed: { reason: null, domain: null },
  ...overrides,
});

describe('classifyGovernedRefusal', () => {
  it('says a version that cannot be submitted is no longer a submittable draft, then refetches', () => {
    const classified = classifyGovernedRefusal(
      'CMS-03C-06',
      refusal({
        governed: { reason: 'subject_not_submittable', domain: null },
      }),
    );
    expect(classified).toMatchObject({
      kind: 'refetch',
      rotateKey: true,
      refetch: true,
      requestId: 'req-1',
    });
    expect(classified?.message).toBe(
      'This version can no longer be submitted. It may already be under review.',
    );
  });

  it('names the unbuilt canonical domain of a vocabulary that cannot be submitted', () => {
    const classified = classifyGovernedRefusal(
      'CMS-03C-06',
      refusal({
        status: 422,
        governed: { reason: 'canonical_source_unavailable', domain: 'gear' },
      }),
    );
    expect(classified).toMatchObject({ kind: 'field', rotateKey: true });
    expect(classified?.message).toBe(
      'The gear reference list is not available yet, so this vocabulary cannot be submitted.',
    );
  });

  it('speaks generally when the domain is not one of the closed six', () => {
    const classified = classifyGovernedRefusal(
      'CMS-03C-06',
      refusal({
        status: 422,
        governed: { reason: 'canonical_source_unavailable', domain: null },
      }),
    );
    expect(classified?.message).toBe(
      'A reference list this vocabulary declares is not available yet, so it cannot be submitted.',
    );
  });

  it('[P2-S12-AC-271] gives an ineligible reviewer the one uniform copy at the reviewer field and a refetch (FE03 884, DEC-242)', () => {
    const classified = classifyGovernedRefusal(
      'CMS-03C-08',
      refusal({
        reason: 'reviewer_not_eligible',
        governed: { reason: 'reviewer_not_eligible', domain: null },
      }),
    );
    expect(classified).toMatchObject({
      kind: 'field',
      fields: ['reviewerPersonId'],
      rotateKey: true,
      refetch: true,
      message: 'That person cannot be assigned to this review.',
    });
    // Only the assignment command carries the token; the decision and submission defer to the shared table.
    expect(
      classifyGovernedRefusal(
        'CMS-03C-07',
        refusal({
          reason: 'reviewer_not_eligible',
          governed: { reason: 'reviewer_not_eligible', domain: null },
        }),
      ),
    ).toBeNull();
  });

  it('defers every other refusal to the shared fixed-copy table', () => {
    for (const operation of ['CMS-03C-06', 'CMS-03C-07', 'CMS-03C-08'] as const)
      expect(
        classifyGovernedRefusal(
          operation,
          refusal({
            status: 403,
            governed: { reason: 'capability_missing', domain: null },
          }),
        ),
      ).toBeNull();
    expect(
      classifyGovernedRefusal(
        'CMS-03C-07',
        refusal({
          governed: { reason: 'subject_not_submittable', domain: null },
        }),
      ),
    ).toBeNull();
  });
});
