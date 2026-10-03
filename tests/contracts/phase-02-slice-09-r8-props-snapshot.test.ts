import { describe, expect, it } from 'vitest';

import {
  BlockRegistrationRequestSchema,
  PropsSchemaSnapshotSchema,
} from '@wejammin/contracts';

import { validBlock } from './phase-02-slice-09-adversarial-fixtures';

const field = { name: 'headline', kind: 'short_text', required: true };
const snapshot = {
  schemaVersion: '1',
  fields: [field],
  additionalProperties: false,
};
const accepts = (value: unknown): boolean =>
  PropsSchemaSnapshotSchema.safeParse(value).success;

describe('[P2-S09-AC-108] propsSchemaSnapshot is a strict normalized object', () => {
  it('accepts exactly schemaVersion, fields and additionalProperties false', () => {
    expect(accepts(snapshot)).toBe(true);
    expect(accepts({ ...snapshot, fields: [] })).toBe(true);
  });

  it('refuses additionalProperties true, a missing value and any non-false value', () => {
    for (const additionalProperties of [true, undefined, null, 'false', 0])
      expect(accepts({ ...snapshot, additionalProperties })).toBe(false);
  });

  it('refuses a missing, empty or over-long schemaVersion', () => {
    expect(accepts({ ...snapshot, schemaVersion: undefined })).toBe(false);
    expect(accepts({ ...snapshot, schemaVersion: '' })).toBe(false);
    expect(accepts({ ...snapshot, schemaVersion: 'v'.repeat(33) })).toBe(false);
    expect(accepts({ ...snapshot, schemaVersion: 'v'.repeat(32) })).toBe(true);
  });

  it('refuses an unknown key on the snapshot', () => {
    expect(accepts({ ...snapshot, extra: 1 })).toBe(false);
    expect(accepts({ ...snapshot, required: ['headline'] })).toBe(false);
  });

  it('refuses an unknown key on a field and requires name, kind and required', () => {
    expect(accepts({ ...snapshot, fields: [{ ...field, extra: 1 }] })).toBe(
      false,
    );
    for (const key of ['name', 'kind', 'required'] as const) {
      const rest: Record<string, unknown> = { ...field };
      delete rest[key];
      expect(accepts({ ...snapshot, fields: [rest] })).toBe(false);
    }
    expect(
      accepts({ ...snapshot, fields: [{ ...field, required: 'true' }] }),
    ).toBe(false);
    expect(accepts({ ...snapshot, fields: [{ ...field, kind: '' }] })).toBe(
      false,
    );
  });

  it('accepts optional constraints as a JSON record and refuses a non-record', () => {
    expect(
      accepts({
        ...snapshot,
        fields: [{ ...field, constraints: { maxLength: 80 } }],
      }),
    ).toBe(true);
    for (const constraints of ['x', 1, [1], null])
      expect(
        accepts({ ...snapshot, fields: [{ ...field, constraints }] }),
      ).toBe(false);
  });

  it('is enforced on the CMS-03A-05 request: a non-strict snapshot is a refused registration', () => {
    expect(
      BlockRegistrationRequestSchema.safeParse({
        ...validBlock,
        propsSchemaSnapshot: { ...snapshot, additionalProperties: true },
      }).success,
    ).toBe(false);
    expect(
      BlockRegistrationRequestSchema.safeParse({
        ...validBlock,
        propsSchemaSnapshot: snapshot,
      }).success,
    ).toBe(true);
  });
});
