import { describe, expect, it } from 'vitest';

import { CONTENT_SCHEMA_REGISTRY_ROLE_MATRIX } from './content-schema-registry-role-matrix';

describe('content schema registry server-authoritative role matrix', () => {
  it('covers every FE03 role with a non-empty protected projection policy', () => {
    expect(Object.keys(CONTENT_SCHEMA_REGISTRY_ROLE_MATRIX)).toEqual([
      'Free',
      'Paid',
      'Creator',
      'Guardian',
      'Junior',
      'Business',
      'Staff',
      'Admin',
    ]);
    for (const policy of Object.values(CONTENT_SCHEMA_REGISTRY_ROLE_MATRIX)) {
      expect(policy.variant).toMatch(/^[a-z][a-zA-Z]+$/u);
      expect(policy.listDetail.length).toBeGreaterThan(0);
      expect(policy.commands.length).toBeGreaterThan(0);
    }
  });

  it('[P2-S09-AC-989] keeps role labels descriptive rather than client-side authority', () => {
    expect(CONTENT_SCHEMA_REGISTRY_ROLE_MATRIX.Free.commands).toBe(
      'not-rendered',
    );
    expect(CONTENT_SCHEMA_REGISTRY_ROLE_MATRIX.Admin.commands).toBe(
      'named-capability-step-up-bound',
    );
  });
});
