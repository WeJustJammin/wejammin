import {
  CMS_UPDATE_DIFF_MAX_BYTES,
  platformRegistrySet,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  PATTERN_UPDATE_OPERATIONS,
  type PatternUpdateOperation,
} from './pattern-update-operations';

/**
 * The Worker table `PATTERN_UPDATE_OPERATIONS` is pinned to the frozen registry rows of CMS-03C-13, -14 and -15
 * (BE03c 175-177): method, path, deadline, rate class and both ceilings, CSRF, idempotency, If-Match and capability
 * gate. The RPC name is the `platform_api` function the unpromoted SQL lane creates (pattern-updates 140310, 140410,
 * 140610).
 */
const route = (operationId: string) => {
  const row = platformRegistrySet.routes.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (row === undefined) throw new Error(`registry row ${operationId} missing`);
  return row;
};

describe.each(
  Object.keys(PATTERN_UPDATE_OPERATIONS) as PatternUpdateOperation[],
)('operation table of %s matches its registry row', (operationId) => {
  const row = route(operationId);
  const spec = PATTERN_UPDATE_OPERATIONS[operationId];

  it('rate class, user and party ceilings and a 60-second window', () => {
    expect(spec.rateClass).toBe(row.rateClass);
    expect(spec.user).toBe(row.rateLimit);
    expect(spec.party).toBe(row.partyRateLimit);
    expect(row.rateWindowSeconds).toBe(60);
    expect(row.rateScope).toBe('user');
  });

  it('deadline, method and the write/read class', () => {
    expect(spec.deadlineMs).toBe(row.timeoutMs);
    expect(row.method === 'POST').toBe(spec.write);
    expect(row.idempotency === 'required').toBe(spec.write);
    expect(row.ifMatch === 'required').toBe(spec.write);
    expect(row.csrf === 'required').toBe(spec.write);
  });

  it('authors and editors only (any of), or the pattern designer alone for the nestable list (DEC-196), the human console audience', () => {
    expect(spec.capabilities).toEqual(
      operationId === 'cmsPatternNestableRead'
        ? ['cms.template_designer']
        : ['cms.author', 'cms.editor'],
    );
    expect(row.capabilities).toEqual([...spec.capabilities]);
    if (spec.capabilities.length > 1) expect(row.capabilityMode).toBe('any_of');
    expect(row.audience).toBe('browser');
  });
});

describe('the answer-size ceilings', () => {
  it('only the diff reads wider than 256 KiB: twice its compact bound, for the jsonb spacing', () => {
    expect(PATTERN_UPDATE_OPERATIONS['CMS-03C-13'].wireBytes).toBe(262_144);
    expect(PATTERN_UPDATE_OPERATIONS['CMS-03C-15'].wireBytes).toBe(262_144);
    expect(PATTERN_UPDATE_OPERATIONS['CMS-03C-14'].wireBytes).toBe(
      2 * CMS_UPDATE_DIFF_MAX_BYTES,
    );
  });
});

describe('the three registry rows', () => {
  it('CMS-03C-13: GET selector, 300/600 per minute, 8,000 ms', () => {
    expect(route('CMS-03C-13')).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/patterns/selector',
      rateClass: 'cms-pattern-selector-read',
      rateLimit: 300,
      partyRateLimit: 600,
      timeoutMs: 8_000,
      requestSchema: 'PatternSelectorApiRequestSchema',
      successSchema: 'PatternSelectorPageSchema',
    });
    expect(PATTERN_UPDATE_OPERATIONS['CMS-03C-13'].rpc).toBe(
      'cms_list_pattern_selector',
    );
  });

  it('cmsPatternNestableRead: GET nestable, designer only, 300/600 per minute, 8,000 ms, Tier 1 (BE03c 184)', () => {
    expect(route('cmsPatternNestableRead')).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/patterns/nestable',
      authClass: 'template_designer',
      rateClass: 'cms-pattern-nestable-read',
      rateLimit: 300,
      partyRateLimit: 600,
      timeoutMs: 8_000,
      sloTier: 'tier_1',
      requestSchema: 'PatternNestableApiRequestSchema',
      successSchema: 'PatternSelectorPageSchema',
    });
    expect(PATTERN_UPDATE_OPERATIONS.cmsPatternNestableRead.rpc).toBe(
      'cms_list_pattern_nestable',
    );
  });

  it('CMS-03C-14: GET update-diff, 300/600 per minute, 8,000 ms', () => {
    expect(route('CMS-03C-14')).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/compositions/instances/{instanceId}/update-diff',
      rateClass: 'cms-composition-read',
      rateLimit: 300,
      partyRateLimit: 600,
      timeoutMs: 8_000,
      requestSchema: 'CompositionUpdateDiffApiRequestSchema',
      successSchema: 'CompositionUpdateDiffResourceSchema',
    });
    expect(PATTERN_UPDATE_OPERATIONS['CMS-03C-14'].rpc).toBe(
      'cms_get_instance_update_diff',
    );
  });

  it('CMS-03C-15: POST pattern-updates, CSRF, key and If-Match, 60/120 per minute, 15,000 ms', () => {
    expect(route('CMS-03C-15')).toMatchObject({
      method: 'POST',
      path: '/api/v1/cms/compositions/pattern-updates',
      rateClass: 'cms-composition-update',
      rateLimit: 60,
      partyRateLimit: 120,
      timeoutMs: 15_000,
      requestSchema: 'CompositionUpdateApiRequestSchema',
      successSchema: 'CompositionUpdateResourceSchema',
    });
    expect(PATTERN_UPDATE_OPERATIONS['CMS-03C-15'].rpc).toBe(
      'cms_apply_pattern_update',
    );
  });
});
