import { describe, expect, it } from 'vitest';

import { same as sameOriginAdmission } from './async-entrypoint-cms-origin-admission-test-support';
import { same as sameQueuedContinuation } from './async-entrypoint-queued-continuation-test-support';

/*
 * Both async-entrypoint harnesses prove "nothing else happened" through `same`, an exact
 * own-key structural comparison. These cases pin what it refuses, so a weaker comparison
 * cannot silently let an extra, missing, reordered or differently typed value through.
 */
const NO_PROTOTYPE = Object.create(null) as object;

describe.each([
  ['cms origin admission', sameOriginAdmission],
  ['queued continuation', sameQueuedContinuation],
])('%s structural equality', (_name, same) => {
  it('accepts identical primitives and deeply equal plain structures', () => {
    expect(() => same(7, 7)).not.toThrow();
    expect(() => same('a', 'a')).not.toThrow();
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
    ['a primitive against an object', 'x', {}],
    ['an array against an object', [], {}],
    ['an object against an array', {}, []],
    ['objects with different prototypes', NO_PROTOTYPE, {}],
    ['an extra key', { a: 1, b: 2 }, { a: 1 }],
    ['a missing key', { a: 1 }, { a: 1, b: 2 }],
    ['a renamed key', { a: 1 }, { b: 1 }],
    ['a nested difference', { a: { b: 1 } }, { a: { b: 2 } }],
    ['arrays of different lengths', [1, 2], [1]],
    ['arrays with different elements', [1, 2], [1, 3]],
  ])('refuses %s', (_label, actual, expected) => {
    expect(() => same(actual, expected)).toThrow('expected false to be true');
  });
});
