import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsCompositionCatalogCode,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { PATTERN_ISSUE_COPY } from './pattern-designer-copy';
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

/*
 * Review V20 M1 / DEC-246(4): the digest 409 reads the block choices again by itself and keeps the unsent values, so
 * neither fixed sentence may tell the person to reload (a reload discards the tree). The pattern edit and taxonomy edit
 * routes have 94 B and 64 B of initial-route margin: the sentences may not grow past what they were.
 */
describe('block registry copy never asks for a reload', () => {
  const digest = PATTERN_REFUSAL_COPY.block_registry_digest_mismatch;
  const unavailable = PATTERN_ISSUE_COPY.block_unavailable;

  it('says the block choices are read again and the values are kept', () => {
    expect(digest).toContain(
      'The block registry changed while you were editing.',
    );
    expect(digest).toContain('Block choices are read again');
    expect(digest).toContain('your values are kept');
    expect(digest).toContain('Nothing was saved.');
  });

  it('does not say reload, in either sentence', () => {
    expect(digest).not.toMatch(/reload/iu);
    expect(unavailable).not.toMatch(/reload/iu);
    expect(unavailable).toBe(
      'This block is no longer registered. Choose another block.',
    );
  });

  it('is not longer than the sentences it replaces (125 and 72 characters)', () => {
    expect(digest.length).toBeLessThanOrEqual(125);
    expect(unavailable.length).toBeLessThanOrEqual(72);
  });
});

describe('composition catalog codes', () => {
  it('equals the contract catalog for every status the pattern operations declare', () => {
    for (const [status, code] of Object.entries(PATTERN_CATALOG_CODES))
      for (const operation of ['CMS-03C-12', 'cmsPatternLatestRead'] as const)
        expect(code).toBe(cmsCompositionCatalogCode(operation, Number(status)));
  });
});
