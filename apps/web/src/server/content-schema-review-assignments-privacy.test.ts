import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_ID,
  reviewResource,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import { resolveReview } from './content-schema-review-dec108.test-support';

/**
 * WP2c follow-up: `assignments[]` is an owner-only safe summary. The page keeps
 * it only when the server's per-review actions allow the owner to assign;
 * anyone else receives an empty list even if an upstream bug supplied one.
 */

const summary = {
  assignmentId: ASSIGNMENT_ID,
  version: '1',
  state: 'active',
  startsAt: '2026-10-02T12:00:00.000Z',
  endsAt: '2026-10-05T12:00:00.000Z',
  reviewerLabel: 'Reviewer A',
};

const assignmentsOf = (
  result: Awaited<ReturnType<typeof resolveReview>>['result'],
): readonly unknown[] | null =>
  result.kind === 'authorized' && result.page.initialReview.status === 'success'
    ? ((
        result.page.initialReview.data as unknown as {
          readonly assignments: readonly unknown[];
        }
      ).assignments ?? null)
    : null;

describe('[WP2c] review route assignments disclosure', () => {
  it('keeps the owner-only summary when the server permits assign_reviewer', async () => {
    const body = reviewResource({
      permittedNextActions: ['assign_reviewer'],
      assignments: [summary],
    });
    const { result } = await resolveReview({
      body,
      capability: 'cms.schema_designer',
      variant: 'ownerFull',
    });
    expect(assignmentsOf(result)).toHaveLength(1);
  });

  it('drops the summary for a reviewer who cannot assign', async () => {
    const body = reviewResource({
      permittedNextActions: ['record_decision'],
      assignments: [summary],
    });
    const { result } = await resolveReview({
      body,
      capability: 'cms.schema_review',
      variant: 'schemaReviewAssigned',
    });
    expect(result.kind).toBe('authorized');
    expect(assignmentsOf(result)).toStrictEqual([]);
  });
});
