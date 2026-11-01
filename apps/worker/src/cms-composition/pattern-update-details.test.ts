import { CmsCompositionRefusalDetailsSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { patternUpdateDetails } from './pattern-update-details';
import type { PatternUpdateOperation } from './pattern-update-operations';

/**
 * BE03c 1304: a CMS-03C-13/14/15 refusal carries exactly one lowercase `reasonCode` of its own operation's list, on
 * the one status that list gives the token, and no other member. A token on another status, or one the operation does
 * not publish, is dropped, never repaired; the shared BE00 allowlist answers what remains.
 */
const TYPED: readonly (readonly [PatternUpdateOperation, number, string])[] = [
  ['CMS-03C-13', 403, 'capability_missing'],
  ['CMS-03C-14', 403, 'capability_missing'],
  ['CMS-03C-14', 422, 'diff_too_large'],
  ['CMS-03C-15', 403, 'capability_missing'],
  ['CMS-03C-15', 409, 'revision_not_editable'],
  ['CMS-03C-15', 409, 'diff_has_collisions'],
  ['CMS-03C-15', 422, 'pattern_version_not_active'],
  ['CMS-03C-15', 422, 'pattern_incompatible'],
  ['CMS-03C-15', 422, 'nested_pattern_not_active'],
];

describe('patternUpdateDetails', () => {
  it.each(TYPED)(
    '%s publishes %i %s with exactly its reasonCode',
    (operation, status, token) => {
      const details = patternUpdateDetails(
        operation,
        status as 403 | 409 | 422,
        {
          reasonCode: token,
          expectedVersion: '1',
          currentVersion: '2',
          violations: [{ path: '/x', code: 'invalid' }],
          secret: 'private',
        },
      );
      expect(details).toEqual({ reasonCode: token });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(details).success,
      ).toBe(true);
    },
  );

  it.each([
    ['CMS-03C-13', 422, 'diff_too_large'],
    ['CMS-03C-13', 409, 'revision_not_editable'],
    ['CMS-03C-14', 409, 'diff_has_collisions'],
    ['CMS-03C-15', 422, 'revision_not_editable'],
    ['CMS-03C-15', 409, 'pattern_version_not_active'],
    ['CMS-03C-15', 403, 'revision_not_editable'],
    ['CMS-03C-15', 409, 'pattern_cycle'],
    ['CMS-03C-15', 422, 'pattern_depth_exceeded'],
    ['CMS-03C-15', 422, 'pattern_nodes_exceeded'],
    ['CMS-03C-15', 409, 'review_not_open'],
    ['CMS-03C-15', 403, 'separation_of_duties'],
    ['CMS-03C-15', 409, 'not_a_token'],
    ['CMS-03C-15', 409, 'CAPABILITY_REQUIRED'],
  ] as const)('%s drops $2 on $1', (operation, status, token) => {
    expect(
      patternUpdateDetails(operation, status, { reasonCode: token }),
    ).toEqual({});
  });

  it('keeps only the version pair of a plain 409 and nothing for a cursor conflict', () => {
    expect(
      patternUpdateDetails('CMS-03C-15', 409, {
        expectedVersion: '3',
        currentVersion: '9',
        instanceId: 'c0000000-0000-4000-8000-000000000100',
        conflict: 'VERSION_MISMATCH',
      }),
    ).toEqual({ expectedVersion: '3', currentVersion: '9' });
    expect(
      patternUpdateDetails('CMS-03C-15', 409, {
        expectedVersion: '0',
        currentVersion: 'x',
      }),
    ).toEqual({});
    expect(patternUpdateDetails('CMS-03C-13', 409, {})).toEqual({});
  });

  it('relays only pointer-shaped violations of a plain 400 or 422', () => {
    const violations = [
      {
        path: '/instances/0/instanceId',
        code: 'invalid_value',
        message: 'private prose',
      },
      { path: 'not-a-pointer', code: 'invalid_value' },
      { path: '/limit', code: 'Not Lower' },
    ];
    for (const status of [400, 422] as const)
      expect(
        patternUpdateDetails('CMS-03C-15', status, { violations }),
      ).toEqual({
        violations: [
          {
            path: '/instances/0/instanceId',
            code: 'invalid_value',
            message: 'The value is invalid.',
          },
        ],
      });
    expect(patternUpdateDetails('CMS-03C-13', 422, {})).toEqual({});
  });

  it('keeps the BE00 shapes of 401, 415, 429 and the dependency statuses', () => {
    expect(patternUpdateDetails('CMS-03C-15', 401, { anything: 1 })).toEqual({
      recoveryAction: 'reauthenticate',
    });
    expect(
      patternUpdateDetails('CMS-03C-13', 415, { allowedMediaTypes: [] }),
    ).toEqual({
      allowedMediaTypes: [],
    });
    expect(
      patternUpdateDetails('CMS-03C-15', 429, {
        retryAfterSeconds: 7,
        limit: 60,
        resetAt: '1790000000',
        secret: 'x',
      }),
    ).toEqual({ retryAfterSeconds: 7, limit: 60, resetAt: '1790000000' });
    for (const status of [502, 503, 504] as const)
      expect(
        patternUpdateDetails('CMS-03C-14', status, { secret: 'x' }),
      ).toEqual({
        dependencyClass: 'cms_composition',
        retryable: true,
      });
    expect(
      patternUpdateDetails('CMS-03C-14', 404, {
        reasonCode: 'capability_missing',
      }),
    ).toEqual({});
    expect(patternUpdateDetails('CMS-03C-14', 500, { secret: 'x' })).toEqual(
      {},
    );
  });

  it('a non-object source yields no members', () => {
    for (const source of [null, undefined, 'text', 7, ['capability_missing']])
      expect(patternUpdateDetails('CMS-03C-13', 403, source)).toEqual({});
  });
});

describe('patternUpdateDetails DEC-210 block_rules_violated', () => {
  const violation = (path: string) => ({
    path,
    code: 'block_rules_violated',
    message: 'The value is invalid.',
  });

  it.each(['/instances/0/choices', '/instances/12', '/instances/31/choices'])(
    'CMS-03C-15 publishes 422 with its reasonCode and the one bounded violation %s',
    (pointer) => {
      const details = patternUpdateDetails('CMS-03C-15', 422, {
        reasonCode: 'block_rules_violated',
        violations: [violation(pointer), violation('/secret-pointer')],
        secret: 'private',
      });
      expect(details).toEqual({
        reasonCode: 'block_rules_violated',
        violations: [violation(pointer)],
      });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(details).success,
      ).toBe(true);
    },
  );

  it('publishes the bare reasonCode when no violation fits the instance grammar', () => {
    expect(
      patternUpdateDetails('CMS-03C-15', 422, {
        reasonCode: 'block_rules_violated',
        violations: [violation('/roots')],
      }),
    ).toEqual({ reasonCode: 'block_rules_violated' });
  });

  it.each(['CMS-03C-13', 'CMS-03C-14'] as const)(
    '%s does not publish block_rules_violated',
    (operation) => {
      expect(
        patternUpdateDetails(operation, 422, {
          reasonCode: 'block_rules_violated',
        }),
      ).not.toHaveProperty('reasonCode');
    },
  );
});
