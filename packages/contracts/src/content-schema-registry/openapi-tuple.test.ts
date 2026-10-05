import { describe, expect, it } from 'vitest';

import { pinTupleLengths } from './openapi-tuple.ts';

describe('pinTupleLengths', () => {
  it('rewrites a draft-7 tuple into a length-bounded 2020-12 prefix tuple', () => {
    expect(
      pinTupleLengths({
        type: 'array',
        items: [{ type: 'string' }, { type: 'number' }],
      }),
    ).toEqual({
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
      items: false,
      minItems: 2,
      maxItems: 2,
    });
  });

  it('rewrites nested tuples and leaves homogeneous arrays untouched', () => {
    expect(
      pinTupleLengths({
        properties: {
          pair: { type: 'array', items: [{ const: 1 }, { const: 2 }] },
          list: { type: 'array', items: { type: 'string' } },
          items: { type: 'string' },
        },
        anyOf: [{ type: 'array', items: [{ type: 'null' }] }],
      }),
    ).toEqual({
      properties: {
        pair: {
          type: 'array',
          prefixItems: [{ const: 1 }, { const: 2 }],
          items: false,
          minItems: 2,
          maxItems: 2,
        },
        list: { type: 'array', items: { type: 'string' } },
        items: { type: 'string' },
      },
      anyOf: [
        {
          type: 'array',
          prefixItems: [{ type: 'null' }],
          items: false,
          minItems: 1,
          maxItems: 1,
        },
      ],
    });
  });

  it('treats property names that match literal keywords as schema positions', () => {
    expect(
      pinTupleLengths({
        properties: {
          default: { type: 'array', items: [{ const: 1 }] },
          items: { type: 'array', items: [{ const: 2 }, { const: 3 }] },
        },
      }),
    ).toEqual({
      properties: {
        default: {
          type: 'array',
          prefixItems: [{ const: 1 }],
          items: false,
          minItems: 1,
          maxItems: 1,
        },
        items: {
          type: 'array',
          prefixItems: [{ const: 2 }, { const: 3 }],
          items: false,
          minItems: 2,
          maxItems: 2,
        },
      },
    });
  });

  it('preserves literal data and primitives verbatim', () => {
    const literal = {
      const: { items: [1, 2] },
      default: { items: [1] },
      enum: [{ items: [3] }],
      examples: [{ items: [4] }],
    };
    expect(pinTupleLengths(literal)).toEqual(literal);
    expect(pinTupleLengths('text')).toBe('text');
    expect(pinTupleLengths(null)).toBeNull();
    expect(pinTupleLengths(7)).toBe(7);
  });
});
