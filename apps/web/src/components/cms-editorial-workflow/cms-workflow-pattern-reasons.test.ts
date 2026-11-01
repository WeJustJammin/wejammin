import { CMS_PREFLIGHT_REGISTRY } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { preflightReasonCopy } from './cms-workflow-labels';

const PATTERN_REASONS = [
  'pattern_not_active',
  'pattern_digest_changed',
  'nested_pattern_not_active',
  'pattern_depth_exceeded',
  'pattern_nodes_exceeded',
  'pattern_block_rules_violated',
] as const;

const GENERIC_FAILED = 'This check did not pass.';

describe('pattern preflight reason copy (DEC-199)', () => {
  it('tracks all six closed reasons on the public pattern registry row', () => {
    const row = CMS_PREFLIGHT_REGISTRY.find(
      (entry) => entry.category === 'pattern',
    );
    expect(row?.providerKey).toBe('cms.pattern.active_digest');
    expect(row?.providerVersion).toBe('1');
    expect(row?.reasonCodes).toEqual([...PATTERN_REASONS]);
  });

  it('returns stable, specific, non-raw copy for every closed pattern reason', () => {
    const copies = PATTERN_REASONS.map((reasonCode) =>
      preflightReasonCopy('failed', reasonCode),
    );
    for (const [index, reasonCode] of PATTERN_REASONS.entries()) {
      const copy = copies[index] ?? '';
      expect(copy).toBe(preflightReasonCopy('failed', reasonCode));
      expect(copy).not.toBe(GENERIC_FAILED);
      expect(copy).not.toContain(reasonCode);
      expect(copy).not.toMatch(/[<>\r\n]/u);
      expect(copy).toMatch(/^[A-Z][^.?!]{4,200}[.]$/u);
    }
  });

  it('names the DEC-247 bound reasons in plain sentences without the token or a number', () => {
    expect(preflightReasonCopy('failed', 'pattern_depth_exceeded')).toBe(
      'A pattern used here is nested more deeply than a pattern may be.',
    );
    expect(preflightReasonCopy('failed', 'pattern_nodes_exceeded')).toBe(
      'A pattern used here expands to more blocks than a pattern may place.',
    );
  });

  it('keeps unregistered reason tokens on the fixed generic sentence', () => {
    const unknown = 'pattern_internal_unknown';
    expect(preflightReasonCopy('failed', unknown)).toBe(GENERIC_FAILED);
    expect(preflightReasonCopy('failed', unknown)).not.toContain(unknown);
    expect(preflightReasonCopy('unavailable', unknown)).toBe(
      'This check could not run. It is a degraded check, not an error.',
    );
  });
});
