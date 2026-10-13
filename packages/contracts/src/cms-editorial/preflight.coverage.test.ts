import { describe, expect, it } from 'vitest';

import { CMS_PREFLIGHT_CATEGORIES } from './preflight-categories';
import {
  CMS_PREFLIGHT_REGISTRY,
  cmsPreflightFailedReasons,
  cmsPreflightUnavailableReasons,
} from './preflight';

describe('the failed reasons of a preflight category', () => {
  it('come from the one registry row of the category', () => {
    for (const category of CMS_PREFLIGHT_CATEGORIES) {
      const rows = CMS_PREFLIGHT_REGISTRY.filter(
        (row) => row.category === category,
      );
      expect(rows, category).toHaveLength(1);
      const unavailable = cmsPreflightUnavailableReasons(category);
      expect(cmsPreflightFailedReasons(category), category).toEqual(
        rows[0]?.reasonCodes.filter((reason) => !unavailable.includes(reason)),
      );
    }
  });
});
