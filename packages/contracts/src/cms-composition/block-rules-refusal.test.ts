import { describe, expect, it } from 'vitest';

import {
  CMS_BLOCK_RULES_POINTERS,
  CMS_BLOCK_RULES_REASON,
  cmsBlockRulesDetails,
} from './block-rules-refusal';
import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsCompositionRefusalDetailsSchema,
  cmsSlice12ReasonStatus,
} from './refusals';

/*
 * DEC-210 (BE03c "Block composition rules (DEC-210)"): the pointer each operation's block_rules_violated refusal may
 * name, and the one projection of a refusal's violations onto that grammar.
 */
const violation = (path: string, code = 'invalid') => ({
  path,
  code,
  message: 'private text',
});

describe('block_rules_violated pointer grammar (DEC-210)', () => {
  it('is the one 422 token of CMS-03C-02, CMS-03C-12 and CMS-03C-15 and of no other operation', () => {
    expect(CMS_BLOCK_RULES_REASON).toBe('block_rules_violated');
    expect(cmsSlice12ReasonStatus(CMS_BLOCK_RULES_REASON)).toBe(422);
    const carriers = Object.entries(CMS_SLICE_12_OPERATION_REASONS)
      .filter(([, reasons]) =>
        (reasons as readonly string[]).includes(CMS_BLOCK_RULES_REASON),
      )
      .map(([operation]) => operation)
      .sort();
    expect(carriers).toEqual(Object.keys(CMS_BLOCK_RULES_POINTERS).sort());
  });

  it.each([
    ['CMS-03C-12', '/blockTree', true],
    ['CMS-03C-12', '/blockTree/0', true],
    ['CMS-03C-12', '/blockTree/31/children/0', true],
    ['CMS-03C-12', '/blockTree/0/children/1/children/2/children/3', true],
    ['CMS-03C-12', '/blockTree/0/children', false],
    ['CMS-03C-12', '/blockTree/0/props', false],
    ['CMS-03C-12', '/blockTree/100', false],
    ['CMS-03C-12', '/nodes/0', false],
    ['CMS-03C-02', '/roots', true],
    ['CMS-03C-02', '/patternVersion', true],
    ['CMS-03C-02', '/roots/0', false],
    ['CMS-03C-02', '/slotPath', false],
    ['CMS-03C-15', '/instances/0', true],
    ['CMS-03C-15', '/instances/31/choices', true],
    ['CMS-03C-15', '/instances/0/choices/0', false],
    ['CMS-03C-15', '/instances/0/instanceId', false],
    ['CMS-03C-15', '/instances', false],
  ] as const)('%s admits %s: %s', (operation, pointer, admitted) => {
    expect(CMS_BLOCK_RULES_POINTERS[operation].test(pointer)).toBe(admitted);
  });

  it('projects only fitting violations, rewritten to the fixed code and message, at most 50', () => {
    const details = cmsBlockRulesDetails(
      {
        reasonCode: 'block_rules_violated',
        violations: [
          violation('/roots'),
          violation('/secret-pointer'),
          violation('/patternVersion'),
          'not-a-violation',
          null,
        ],
        secret: 'private',
      },
      'CMS-03C-02',
    );
    expect(details).toEqual({
      reasonCode: 'block_rules_violated',
      violations: [
        {
          path: '/roots',
          code: 'block_rules_violated',
          message: 'The value is invalid.',
        },
        {
          path: '/patternVersion',
          code: 'block_rules_violated',
          message: 'The value is invalid.',
        },
      ],
    });
    expect(CmsCompositionRefusalDetailsSchema.safeParse(details).success).toBe(
      true,
    );
    const many = cmsBlockRulesDetails(
      { violations: Array.from({ length: 80 }, () => violation('/roots')) },
      'CMS-03C-02',
    );
    expect((many.violations ?? []).length).toBe(50);
  });

  it.each([
    undefined,
    null,
    'text',
    7,
    {},
    { violations: 'x' },
    { violations: [] },
  ])('keeps the bare reasonCode for %j', (source) => {
    expect(cmsBlockRulesDetails(source, 'CMS-03C-15')).toEqual({
      reasonCode: 'block_rules_violated',
    });
  });
});
