import { describe, expect, it } from 'vitest';

import {
  assignmentRequest,
  assignmentResource,
  ASSIGNMENT_ID,
  createBody,
  ownerHarness,
  revokeBody,
} from './governed-review-ops.test-support';

/**
 * BE03c row 176 (CMS-03C-08): the answer is 201/200 `GovernedReviewAssignmentResource` and defines no
 * `Location`; AC-272: every assignment identifier stays out of every URL (DEC-239). The assignment
 * id travels only in the strict resource body the owner receives.
 */
describe('CMS-03C-08 names no assignment URL', () => {
  it('[P2-S12-AC-272] CMS-03C-08 a create answers 201 and carries no Location header', async () => {
    const harness = ownerHarness();
    const response = await harness.send(assignmentRequest(createBody()));
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBeNull();
    expect([...response.headers.keys()].join(',')).not.toContain('location');
    for (const [, value] of response.headers)
      expect(value).not.toContain(ASSIGNMENT_ID);
    expect(((await response.json()) as { id: string }).id).toBe(ASSIGNMENT_ID);
  });

  it('[P2-S12-AC-272] CMS-03C-08 a revoke answers 200 and carries no Location header', async () => {
    const harness = ownerHarness({}, async () =>
      Response.json(assignmentResource({ state: 'revoked' })),
    );
    const response = await harness.send(assignmentRequest(revokeBody()));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
