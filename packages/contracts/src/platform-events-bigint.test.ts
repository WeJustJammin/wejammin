import { describe, expect, it } from 'vitest';

import { PositiveBigintDecimalSchema } from './platform-events.ts';

describe('PositiveBigintDecimalSchema', () => {
  it('accepts canonical positive decimals up to the signed 64-bit maximum', () => {
    expect(PositiveBigintDecimalSchema.safeParse('1').success).toBe(true);
    expect(
      PositiveBigintDecimalSchema.safeParse('9223372036854775807').success,
    ).toBe(true);
  });

  it('refuses values above the signed 64-bit maximum', () => {
    expect(
      PositiveBigintDecimalSchema.safeParse('9223372036854775808').success,
    ).toBe(false);
  });

  it.each(['1e3', '0x10', '1.5', '-1', '0', '01', '', ' 1', '1n', 'Infinity'])(
    'reports %j as a validation failure instead of throwing',
    (value) => {
      const result = PositiveBigintDecimalSchema.safeParse(value);
      expect(result.success).toBe(false);
    },
  );
});
