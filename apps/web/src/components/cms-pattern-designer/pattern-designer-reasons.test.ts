import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsCompositionCatalogCode,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  PATTERN_CATALOG_CODES,
  PATTERN_REFUSAL_COPY,
  PATTERN_WRITE_REASONS,
  patternWriteReason,
} from './pattern-designer-reasons';

/*
 * The browser reads reason tokens without loading zod (FE03 AC261), so the closed
 * list is written out. This suite is the drift guard against the generated contract.
 */
describe('pattern write reason vocabulary', () => {
  it('lists exactly the BE03c tokens of CMS-03C-12 at their one status', () => {
    expect(Object.keys(PATTERN_WRITE_REASONS).sort()).toEqual(
      [...CMS_SLICE_12_OPERATION_REASONS['CMS-03C-12']].sort(),
    );
    for (const [token, status] of Object.entries(PATTERN_WRITE_REASONS))
      expect(status).toBe(
        cmsSlice12ReasonStatus(CmsSlice12ReasonCodeSchema.parse(token)),
      );
  });

  it('has fixed copy for every token', () => {
    expect(Object.keys(PATTERN_REFUSAL_COPY).sort()).toEqual(
      Object.keys(PATTERN_WRITE_REASONS).sort(),
    );
    for (const copy of Object.values(PATTERN_REFUSAL_COPY))
      expect(copy.length).toBeGreaterThan(20);
  });

  it('reads a token only at its own status', () => {
    expect(patternWriteReason('pattern_cycle', 409)).toBe('pattern_cycle');
    expect(patternWriteReason('pattern_cycle', 422)).toBeNull();
    expect(patternWriteReason('review_not_open', 409)).toBeNull();
    expect(patternWriteReason(7, 409)).toBeNull();
    expect(patternWriteReason(undefined, 403)).toBeNull();
  });
});

describe('composition catalog codes', () => {
  it('equals the contract catalog for every status the pattern operations declare', () => {
    for (const [status, code] of Object.entries(PATTERN_CATALOG_CODES))
      for (const operation of ['CMS-03C-12', 'cmsPatternLatestRead'] as const)
        expect(code).toBe(cmsCompositionCatalogCode(operation, Number(status)));
  });
});
