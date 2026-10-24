import {
  CMS_CANONICAL_DOMAINS,
  CMS_SLICE_12_OPERATION_REASONS,
  cmsSlice12ReasonStatus,
  type CmsSlice12ReasonCode,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  GOVERNED_CANONICAL_DOMAINS,
  GOVERNED_REASONS,
  governedReasonStatus,
} from './governed-review-reasons';

/*
 * The browser reads reason tokens without loading zod (FE03 AC261), so the
 * closed lists are written out here. This suite is the drift guard: each list
 * and status must equal the generated contract.
 */
describe('governed reason vocabulary', () => {
  it.each(['CMS-03C-06', 'CMS-03C-07', 'CMS-03C-08', 'CMS-03C-09'] as const)(
    'lists exactly the BE03c tokens of %s at their one status',
    (operation) => {
      expect([...GOVERNED_REASONS[operation]].sort()).toEqual(
        [...CMS_SLICE_12_OPERATION_REASONS[operation]].sort(),
      );
      for (const reason of GOVERNED_REASONS[operation])
        expect(governedReasonStatus(reason)).toBe(
          cmsSlice12ReasonStatus(reason as CmsSlice12ReasonCode),
        );
    },
  );

  it('names the closed canonical domains', () => {
    expect([...GOVERNED_CANONICAL_DOMAINS]).toEqual([...CMS_CANONICAL_DOMAINS]);
  });

  it('has no status for a token outside the four commands', () => {
    expect(governedReasonStatus('made_up')).toBeNull();
  });
});
