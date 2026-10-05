import { describe, expect, it } from 'vitest';

import { ApiErrorSchema, JsonValueSchema } from '../api-error.ts';
import { FieldDefinitionInputSchema } from './models-fields.ts';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

const nested = (levels: number): unknown => {
  let value: unknown = 'safe';
  for (let index = 0; index < levels; index += 1) value = { child: value };
  return value;
};

const field = {
  stableFieldId: uuid,
  key: 'display_name',
  kind: 'object' as const,
  constraints: {
    objectStructure: {
      properties: [
        { key: 'child', kind: 'scalar' as const, required: true, constraints: {} },
      ],
    },
  },
  required: false,
  validatorKey: null,
  validatorVersion: null,
  defaultMode: 'literal' as const,
  localizationMode: 'none' as const,
  editorConfig: { label: 'Display name', order: 0 },
  lifecycle: 'active' as const,
};

describe('bounded CMS JSON values', () => {
  it('enforces depth, object-key, array-item, and serialized-byte limits', () => {
    expect(JsonValueSchema.safeParse(nested(8)).success).toBe(true);
    expect(JsonValueSchema.safeParse(nested(9)).success).toBe(false);
    expect(JsonValueSchema.safeParse(nested(10_000)).success).toBe(false);
    expect(
      JsonValueSchema.safeParse(
        Object.fromEntries(
          Array.from({ length: 128 }, (_, index) => [`key${index}`, index]),
        ),
      ).success,
    ).toBe(true);
    expect(
      JsonValueSchema.safeParse(
        Object.fromEntries(
          Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
        ),
      ).success,
    ).toBe(false);
    expect(
      JsonValueSchema.safeParse(Array.from({ length: 128 }, () => null))
        .success,
    ).toBe(true);
    expect(
      JsonValueSchema.safeParse(Array.from({ length: 129 }, () => null))
        .success,
    ).toBe(false);
    expect(JsonValueSchema.safeParse('x'.repeat(262_143)).success).toBe(false);
  });

  it('applies the same bounded value contract to field defaults and errors', () => {
    expect(
      FieldDefinitionInputSchema.safeParse({
        ...field,
        defaultValue: { child: 'safe' },
      }).success,
    ).toBe(true);
    expect(
      FieldDefinitionInputSchema.safeParse({
        ...field,
        defaultValue: { child: { child: 'safe' } },
      }).success,
    ).toBe(false);
    expect(
      ApiErrorSchema.safeParse({
        code: 'INVALID_REQUEST',
        message: 'The value is invalid.',
        requestId: uuid,
        details: { value: nested(5) },
      }).success,
    ).toBe(false);
  });
});
