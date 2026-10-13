import { describe, expect, it } from 'vitest';

import {
  need,
  same,
  type Control,
} from './consumer-cms-lease-control-test-support';

const NO_PROTOTYPE = Object.create(null) as object;

describe('the CMS lease-control harness structural equality', () => {
  it('accepts identical primitives and deeply equal plain structures', () => {
    expect(() => same(7, 7)).not.toThrow();
    expect(() => same(null, null)).not.toThrow();
    expect(() =>
      same({ a: [1, { b: 'c' }], d: null }, { d: null, a: [1, { b: 'c' }] }),
    ).not.toThrow();
  });

  it.each([
    ['different primitives', 1, 2],
    ['a number against a string', 1, '1'],
    ['null against an object', null, {}],
    ['an object against null', {}, null],
    ['an object against a primitive', {}, 'x'],
    ['an array against an object', [], {}],
    ['an object against an array', {}, []],
    ['objects with different prototypes', NO_PROTOTYPE, {}],
    ['an extra key', { a: 1, b: 2 }, { a: 1 }],
    ['a missing key', { a: 1 }, { a: 1, b: 2 }],
    ['a renamed key', { a: 1 }, { b: 1 }],
    ['a nested difference', { a: { b: 1 } }, { a: { b: 2 } }],
    ['arrays of different lengths', [1, 2], [1]],
  ])('refuses %s', (_label, actual, expected) => {
    expect(() => same(actual, expected)).toThrow('expected false to be true');
  });
});

describe('need', () => {
  it('returns the CMS lease control it is given', () => {
    const control: Control = { checkpoint: async () => ({ kind: 'lost' }) };
    expect(need(control)).toBe(control);
  });

  it('refuses a missing CMS lease control', () => {
    expect(() => need(undefined)).toThrow('Expected CMS lease control');
  });
});
