import { describe, expect, it } from 'vitest';

import { TemplateDesignerContextSchema } from './index';

const typeId = '123e4567-e89b-42d3-a456-426614174000';
const selector = (n: number) => ({
  blockKey: `gap.b${String(n).padStart(3, '0')}`,
  blockVersion: 1,
});
const contentType = {
  id: typeId,
  typeKey: 'profile',
  activeVersionId: typeId,
  activeVersion: 1,
  sourceLocale: 'en-US',
};

/** [P2-S12-AC-159] cmsTemplateContextRead: at most 64 content-type selectors and at most 128 block selectors. */
describe('TemplateDesignerContext bounds', () => {
  it('accepts exactly 128 registered block selectors and refuses 129', () => {
    const blocks = (count: number) =>
      Array.from({ length: count }, (_, index) => selector(index));
    expect(
      TemplateDesignerContextSchema.safeParse({
        contentTypes: [contentType],
        registeredBlocks: blocks(128),
      }).success,
    ).toBe(true);
    expect(
      TemplateDesignerContextSchema.safeParse({
        contentTypes: [contentType],
        registeredBlocks: blocks(129),
      }).success,
    ).toBe(false);
  });

  it('accepts exactly 64 content-type selectors and refuses 65', () => {
    const types = (count: number) =>
      Array.from({ length: count }, () => contentType);
    expect(
      TemplateDesignerContextSchema.safeParse({
        contentTypes: types(64),
        registeredBlocks: [],
      }).success,
    ).toBe(true);
    expect(
      TemplateDesignerContextSchema.safeParse({
        contentTypes: types(65),
        registeredBlocks: [],
      }).success,
    ).toBe(false);
  });
});
