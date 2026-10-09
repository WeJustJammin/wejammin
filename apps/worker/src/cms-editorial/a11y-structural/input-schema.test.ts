import { describe, expect, it } from 'vitest';

import {
  blockNode,
  checkerInput,
  fieldIdOf,
  fieldNode,
  paragraph,
  richText,
  span,
} from './a11y-structural.test-support';
import {
  ACCESSIBILITY_NODES_MAX,
  AccessibilityCheckerInputSchema,
} from './input-schema';

const accepts = (value: unknown): boolean =>
  AccessibilityCheckerInputSchema.safeParse(value).success;

const FIELD = fieldNode(1, richText(paragraph(span('Body'))));

describe('AccessibilityCheckerInputSchema: envelope', () => {
  it('accepts an empty and a populated node list', () => {
    expect(accepts(checkerInput([]))).toBe(true);
    expect(accepts(checkerInput([FIELD, blockNode(1)]))).toBe(true);
  });

  it('is strict: an unknown member is refused', () => {
    expect(accepts({ ...checkerInput([]), extra: 1 })).toBe(false);
    expect(
      accepts({ ...checkerInput([FIELD]), nodes: [{ ...FIELD, x: 1 }] }),
    ).toBe(false);
  });

  it.each([
    ['revisionId not a uuid', { revisionId: 'nope' }],
    [
      'revisionId uppercase',
      { revisionId: '11111111-1111-4111-8111-11111111111A' },
    ],
    ['revisionNumber zero', { revisionNumber: '0' }],
    ['revisionNumber leading zero', { revisionNumber: '01' }],
    ['revisionNumber not decimal', { revisionNumber: '1.5' }],
    ['locale with underscore', { locale: 'en_US' }],
    ['locale over 35 characters', { locale: `en-${'a'.repeat(33)}` }],
    ['revisionContentHash uppercase', { revisionContentHash: 'A'.repeat(64) }],
    ['dependencyHash short', { dependencyHash: 'ab' }],
    ['renderPlanHash missing', { renderPlanHash: undefined }],
  ])('refuses %s', (_name, overrides) => {
    expect(accepts({ ...checkerInput([]), ...overrides })).toBe(false);
  });

  it('bounds the node list at 256 entries', () => {
    const at = (count: number) =>
      Array.from({ length: count }, (_unused, index) =>
        fieldNode(index + 1, richText()),
      );
    expect(accepts(checkerInput(at(ACCESSIBILITY_NODES_MAX)))).toBe(true);
    expect(accepts(checkerInput(at(ACCESSIBILITY_NODES_MAX + 1)))).toBe(false);
  });
});

describe('AccessibilityCheckerInputSchema: field nodes', () => {
  it('requires fieldKind rich_text and a present value member', () => {
    expect(
      accepts(checkerInput([{ ...FIELD, fieldKind: 'short_text' }] as never)),
    ).toBe(false);
    const withoutValue = {
      kind: FIELD.kind,
      fieldId: FIELD.fieldId,
      fieldKind: FIELD.fieldKind,
    };
    expect(accepts(checkerInput([withoutValue] as never))).toBe(false);
    // An explicit undefined is still a present member: the checker reports it.
    expect(accepts(checkerInput([fieldNode(1, undefined)]))).toBe(true);
  });

  it('requires a lowercase uuid field id', () => {
    expect(accepts(checkerInput([{ ...FIELD, fieldId: 'nope' }]))).toBe(false);
    expect(
      accepts(
        checkerInput([{ ...FIELD, fieldId: fieldIdOf(10).toUpperCase() }]),
      ),
    ).toBe(false);
  });

  it('refuses a duplicate field id', () => {
    expect(accepts(checkerInput([FIELD, FIELD]))).toBe(false);
  });
});

describe('AccessibilityCheckerInputSchema: block nodes', () => {
  const GOOD_POINTERS = [
    '/composition/0',
    '/a',
    '/a~0b/c~1d',
    '/Slots_1.main-2/0',
    `/${Array.from({ length: 32 }, () => 'a').join('/')}`,
  ];
  const BAD_POINTERS = [
    '',
    '/',
    'composition/0',
    '/a//b',
    '/a/',
    '/a b',
    '/a~2',
    '/a~',
    '/café',
    '/a\n',
    `/${Array.from({ length: 33 }, () => 'a').join('/')}`,
    `/${'a'.repeat(256)}`,
  ];

  it.each(GOOD_POINTERS)('accepts the pointer %s', (pointer) => {
    expect(accepts(checkerInput([blockNode(1, { pointer })]))).toBe(true);
  });

  it.each(BAD_POINTERS)('refuses the pointer %j', (pointer) => {
    expect(accepts(checkerInput([blockNode(1, { pointer })]))).toBe(false);
  });

  it('accepts a pointer of exactly 256 characters', () => {
    expect(
      accepts(checkerInput([blockNode(1, { pointer: `/${'a'.repeat(255)}` })])),
    ).toBe(true);
  });

  it.each([
    ['blockKey with a capital', { blockKey: 'Site.landmark' }],
    ['blockKey empty', { blockKey: '' }],
    ['blockVersion zero', { blockVersion: 0 }],
    ['blockVersion negative', { blockVersion: -1 }],
    ['blockVersion fractional', { blockVersion: 1.5 }],
    ['blockVersion a string', { blockVersion: '1' }],
    ['recordHash not a hash', { recordHash: 'xyz' }],
    ['lifecycle unknown', { lifecycle: 'retired' }],
    ['nameRequired not boolean', { nameRequired: 'yes' }],
    ['accessibleName a number', { accessibleName: 5 }],
    ['accessibleName over the raw bound', { accessibleName: 'n'.repeat(4097) }],
    [
      'accessibleNameFieldDefined missing',
      { accessibleNameFieldDefined: undefined },
    ],
  ])('refuses %s', (_name, overrides) => {
    expect(
      accepts(checkerInput([{ ...blockNode(1), ...overrides }] as never)),
    ).toBe(false);
  });

  it.each(['supported', 'deprecated', 'withdrawn', 'unregistered'] as const)(
    'accepts lifecycle %s',
    (lifecycle) => {
      expect(accepts(checkerInput([blockNode(1, { lifecycle })]))).toBe(true);
    },
  );

  it('accepts a null, an empty and a 4096-unit accessibleName', () => {
    for (const accessibleName of [null, '', 'n'.repeat(4096)])
      expect(accepts(checkerInput([blockNode(1, { accessibleName })]))).toBe(
        true,
      );
  });

  it('refuses a duplicate pointer but allows a field id equal to nothing else', () => {
    const first = blockNode(1, { pointer: '/composition/a' });
    const second = blockNode(2, { pointer: '/composition/a' });
    expect(accepts(checkerInput([first, second]))).toBe(false);
    expect(accepts(checkerInput([first, blockNode(2)]))).toBe(true);
  });
});

describe('AccessibilityCheckerInputSchema: media fails closed', () => {
  it('refuses a media node of any shape', () => {
    const media = {
      kind: 'media',
      assetId: '22222222-2222-4222-8222-222222222222',
      useCode: 'hero',
    };
    expect(accepts(checkerInput([media] as never))).toBe(false);
    expect(accepts(checkerInput([FIELD, media] as never))).toBe(false);
  });

  it('refuses a field node that declares a media field kind', () => {
    expect(
      accepts(checkerInput([{ ...FIELD, fieldKind: 'media' }] as never)),
    ).toBe(false);
  });

  it('refuses a node without a kind and a non-object node', () => {
    expect(accepts(checkerInput([{ fieldId: fieldIdOf(1) }] as never))).toBe(
      false,
    );
    expect(accepts(checkerInput(['field'] as never))).toBe(false);
    expect(accepts(checkerInput([null] as never))).toBe(false);
  });
});
