import {
  CMS_A11Y_CHECKER_KEY,
  CMS_A11Y_CHECKER_TIMEOUT_MS,
  CMS_A11Y_CHECKER_VERSION,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { checkerInput } from './a11y-structural.test-support';
import {
  ACCESSIBILITY_CHECKER_REGISTRY,
  CMS_ENTRY_REVISION_TARGET_TYPE,
  CheckerRegistryError,
  checkerTargetOf,
  defineCheckerRegistry,
  type CheckerRegistration,
} from './registry';

/**
 * BE05c "Accessibility and content-quality checker", registry row:
 *   checkerKey and checkerVersion  cms.a11y.structural and 1; versions are
 *                                  positive integers, older versions stay
 *                                  readable, and the registry marks exactly one
 *                                  current version per target type
 *   targetType                     cms.entry_revision with targetId the
 *                                  revision UUID and targetVersion its
 *                                  revision_number
 *   timeoutMs                      2,000 inside the 100 to 2,000 range
 */

const registration = (
  overrides: Partial<CheckerRegistration> = {},
): CheckerRegistration => ({
  checkerKey: 'cms.a11y.structural',
  checkerVersion: '1',
  targetType: 'cms.entry_revision',
  current: true,
  timeoutMs: 2_000,
  ...overrides,
});

const codeOf = (registrations: readonly CheckerRegistration[]): string => {
  try {
    defineCheckerRegistry(registrations);
  } catch (error) {
    if (error instanceof CheckerRegistryError) return error.code;
    throw error;
  }
  return 'accepted';
};

describe('the Phase 2 accessibility registry row', () => {
  it('registers cms.a11y.structural version 1 for cms.entry_revision as the one current version', () => {
    expect(ACCESSIBILITY_CHECKER_REGISTRY.registrations).toEqual([
      {
        checkerKey: CMS_A11Y_CHECKER_KEY,
        checkerVersion: CMS_A11Y_CHECKER_VERSION,
        targetType: 'cms.entry_revision',
        current: true,
        timeoutMs: CMS_A11Y_CHECKER_TIMEOUT_MS,
      },
    ]);
    expect(CMS_ENTRY_REVISION_TARGET_TYPE).toBe('cms.entry_revision');
    expect(
      ACCESSIBILITY_CHECKER_REGISTRY.currentFor('cms.entry_revision'),
    ).toEqual(ACCESSIBILITY_CHECKER_REGISTRY.registrations[0]);
    expect(CMS_A11Y_CHECKER_TIMEOUT_MS).toBe(2_000);
  });

  it('reads the registered version and knows it is current', () => {
    expect(
      ACCESSIBILITY_CHECKER_REGISTRY.find('cms.a11y.structural', '1'),
    ).toBeDefined();
    expect(
      ACCESSIBILITY_CHECKER_REGISTRY.isCurrent('cms.a11y.structural', '1'),
    ).toBe(true);
    expect(
      ACCESSIBILITY_CHECKER_REGISTRY.find('cms.a11y.structural', '2'),
    ).toBeUndefined();
    expect(
      ACCESSIBILITY_CHECKER_REGISTRY.isCurrent('cms.a11y.structural', '2'),
    ).toBe(false);
  });

  it('has no current checker for a target type it does not register', () => {
    expect(ACCESSIBILITY_CHECKER_REGISTRY.currentFor('cms.route')).toBe(
      undefined,
    );
  });

  it('is immutable', () => {
    expect(Object.isFrozen(ACCESSIBILITY_CHECKER_REGISTRY)).toBe(true);
    expect(Object.isFrozen(ACCESSIBILITY_CHECKER_REGISTRY.registrations)).toBe(
      true,
    );
    expect(
      Object.isFrozen(ACCESSIBILITY_CHECKER_REGISTRY.registrations[0]),
    ).toBe(true);
  });
});

describe('checkerTargetOf: the cms.entry_revision target', () => {
  it('is the revision uuid and its revision_number', () => {
    expect(
      checkerTargetOf(
        checkerInput([], {
          revisionId: '22222222-2222-4222-8222-222222222222',
          revisionNumber: '17',
        }),
      ),
    ).toEqual({
      targetType: 'cms.entry_revision',
      targetId: '22222222-2222-4222-8222-222222222222',
      targetVersion: '17',
    });
  });
});

describe('one current version per target type, older versions readable', () => {
  const older = registration({ checkerVersion: '1', current: false });
  const newer = registration({ checkerVersion: '2', current: true });
  const registry = defineCheckerRegistry([newer, older]);

  it('marks the newer version current and keeps the older one readable', () => {
    expect(registry.currentFor('cms.entry_revision')).toEqual(newer);
    expect(registry.isCurrent('cms.a11y.structural', '2')).toBe(true);
    expect(registry.isCurrent('cms.a11y.structural', '1')).toBe(false);
    expect(registry.find('cms.a11y.structural', '1')).toEqual(older);
    expect(registry.find('cms.a11y.structural', '2')).toEqual(newer);
  });

  it('lists every readable version of a checker, ascending by number, whatever the input order', () => {
    const ten = registration({ checkerVersion: '10', current: false });
    const all = defineCheckerRegistry([ten, newer, older]);
    expect(
      all.versionsOf('cms.a11y.structural').map((row) => row.checkerVersion),
    ).toEqual(['1', '2', '10']);
    expect(all.versionsOf('cms.other')).toEqual([]);
  });

  it('sorts the registrations by checker key and then by version number, whatever the input order', () => {
    const route = registration({
      checkerKey: 'cms.route.links',
      targetType: 'cms.route',
    });
    const sorted = defineCheckerRegistry([route, newer, older]);
    expect(
      sorted.registrations.map(
        (row) => `${row.checkerKey}@${row.checkerVersion}`,
      ),
    ).toEqual([
      'cms.a11y.structural@1',
      'cms.a11y.structural@2',
      'cms.route.links@1',
    ]);
    expect(sorted.currentFor('cms.route')).toEqual(route);
    expect(sorted.currentFor('cms.entry_revision')).toEqual(newer);
  });

  it('refuses a target type with no current version', () => {
    expect(codeOf([older])).toBe('no_current_version');
    expect(codeOf([registration({ current: false })])).toBe(
      'no_current_version',
    );
  });

  it('refuses a target type with two current versions, of one checker or of two', () => {
    expect(codeOf([older, newer, registration({ checkerVersion: '3' })])).toBe(
      'multiple_current_versions',
    );
    expect(
      codeOf([
        registration(),
        registration({ checkerKey: 'cms.other.checker', checkerVersion: '1' }),
      ]),
    ).toBe('multiple_current_versions');
  });

  it('accepts one current version for each of two target types', () => {
    expect(
      codeOf([
        registration(),
        registration({
          checkerKey: 'cms.route.links',
          targetType: 'cms.route',
        }),
      ]),
    ).toBe('accepted');
  });

  it('refuses an empty registry and a repeated checker key and version', () => {
    expect(codeOf([])).toBe('empty_registry');
    expect(codeOf([registration(), registration()])).toBe(
      'duplicate_registration',
    );
    // a checker version names exactly one target type
    expect(
      codeOf([registration(), registration({ targetType: 'cms.route' })]),
    ).toBe('duplicate_registration');
  });
});

describe('registration fields', () => {
  it.each(['0', '01', '-1', '1.5', 'one', '', '1000000000000000000'])(
    'refuses the version %j (a positive decimal integer of at most 18 digits)',
    (checkerVersion) => {
      expect(codeOf([registration({ checkerVersion })])).toBe(
        'version_invalid',
      );
    },
  );

  it.each(['1', '9', '999999999999999999'])('accepts the version %s', (v) => {
    expect(codeOf([registration({ checkerVersion: v })])).toBe('accepted');
  });

  it.each([
    '',
    'A',
    'a b',
    '1a',
    'a..b',
    'a.',
    `a${'.b'.repeat(16)}`,
    'a'.repeat(129),
  ])('refuses the checker key %j', (checkerKey) => {
    expect(codeOf([registration({ checkerKey })])).toBe('key_invalid');
  });

  it.each(['', 'a', 'Cms.entry', 'cms entry', '1cms', `c${'x'.repeat(64)}`])(
    'refuses the target type %j',
    (targetType) => {
      expect(codeOf([registration({ targetType })])).toBe(
        'target_type_invalid',
      );
    },
  );

  it.each([99, 2_001, 100.5, Number.NaN, 0])(
    'refuses timeoutMs %s (an integer from 100 to 2,000)',
    (timeoutMs) => {
      expect(codeOf([registration({ timeoutMs })])).toBe(
        'timeout_out_of_range',
      );
    },
  );

  it.each([100, 250, 2_000])('accepts timeoutMs %s', (timeoutMs) => {
    expect(codeOf([registration({ timeoutMs })])).toBe('accepted');
  });
});
