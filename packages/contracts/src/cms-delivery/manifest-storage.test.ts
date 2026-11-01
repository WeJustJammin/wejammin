import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  RouteManifestVersionStorageSchema,
  RouteManifestVersionStorageStateSchema,
  type RouteManifestVersionStorage,
} from './storage';

const MANIFEST_FIELDS = [
  'id',
  'version_no',
  'publication_set_hash',
  'state',
  'generated_at',
  'activated_at',
] as const;
const ready: RouteManifestVersionStorage = {
  id: '10000000-0000-4000-8000-000000000001',
  version_no: '9007199254740993',
  publication_set_hash: 'a'.repeat(64),
  state: 'ready',
  generated_at: '2026-10-16T08:00:00.123456789Z',
  activated_at: null,
};

const rejectAt = (value: unknown, field: string): void => {
  const result = RouteManifestVersionStorageSchema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: [field] })]),
  );
};

describe('[DEC-197] RouteManifestVersion private receiving record', () => {
  it('[DEC-197-M01] preserves exactly six physical keys and lossless values', () => {
    const parsed = RouteManifestVersionStorageSchema.parse(ready);
    expect(parsed).toEqual(ready);
    expect(Object.keys(parsed).sort()).toEqual([...MANIFEST_FIELDS].sort());
    expectTypeOf(parsed.version_no).toEqualTypeOf<string>();
    expectTypeOf(parsed.activated_at).toEqualTypeOf<string | null>();
  });

  it.each(MANIFEST_FIELDS)(
    '[DEC-197-M02] requires the physical %s key even when nullable',
    (field) => {
      const missing: Record<string, unknown> = { ...ready };
      Reflect.deleteProperty(missing, field);
      rejectAt(missing, field);
      rejectAt({ ...ready, [field]: undefined }, field);
    },
  );

  it.each(MANIFEST_FIELDS.filter((field) => field !== 'activated_at'))(
    '[DEC-197-M03] rejects null for required %s',
    (field) => rejectAt({ ...ready, [field]: null }, field),
  );

  it.each([
    'owner_id',
    'ownerId',
    'created_at',
    'updated_at',
    'version',
    'extra',
  ])(
    '[DEC-197-M04] refuses unregistered %s rather than stripping it',
    (field) => {
      const result = RouteManifestVersionStorageSchema.safeParse({
        ...ready,
        [field]: ready.id,
      });
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [{ code: 'unrecognized_keys', keys: [field], path: [] }],
        },
      });
    },
  );

  it.each(['1', '9007199254740993', '9223372036854775807'])(
    '[DEC-197-M05] round-trips positive bigint boundary %s as a string',
    (version_no) => {
      expect(
        RouteManifestVersionStorageSchema.parse({ ...ready, version_no }),
      ).toEqual({ ...ready, version_no });
    },
  );

  it.each([
    ['zero', '0'],
    ['negative', '-1'],
    ['leading zero', '01'],
    ['sign', '+1'],
    ['fraction', '1.5'],
    ['exponent', '1e3'],
    ['whitespace', ' 1'],
    ['overflow', '9223372036854775808'],
    ['long overflow', '99999999999999999999'],
    ['empty', ''],
    ['safe number', 1],
    ['unsafe number', Number.MAX_SAFE_INTEGER + 1],
    ['bigint primitive', 1n],
  ])(
    '[DEC-197-M06] refuses version_no %s without coercion',
    (_label, value) => {
      rejectAt({ ...ready, version_no: value }, 'version_no');
    },
  );

  it('[DEC-197-M07] closes the sealed lifecycle and accepts every member', () => {
    expect(RouteManifestVersionStorageStateSchema.options).toEqual([
      'ready',
      'active',
      'superseded',
    ]);
    for (const state of RouteManifestVersionStorageStateSchema.options) {
      const record = {
        ...ready,
        state,
        activated_at: state === 'ready' ? null : ready.generated_at,
      };
      expect(RouteManifestVersionStorageSchema.parse(record)).toEqual(record);
    }
  });

  it.each([
    'draft',
    'review',
    'approved',
    'building',
    'blocked',
    'failed_retryable',
    'revoked',
    'pending',
    'converged',
    'degraded',
    'ACTIVE',
    '',
  ])('[DEC-197-M08] excludes candidate/attempt/aggregate state %s', (state) => {
    rejectAt({ ...ready, state }, 'state');
  });

  it('[DEC-197-M09] binds activation nullability to all three states', () => {
    rejectAt({ ...ready, activated_at: ready.generated_at }, 'activated_at');
    for (const state of ['active', 'superseded']) {
      rejectAt({ ...ready, state, activated_at: null }, 'activated_at');
    }
  });

  it.each([
    ['equivalent offset', '2026-10-16T04:00:00.123456789-04:00'],
    ['one nanosecond later', '2026-10-16T08:00:00.123456790Z'],
    ['next second', '2026-10-16T08:00:01.000000000Z'],
  ])('[DEC-197-M10] accepts activation %s exactly', (_label, activated_at) => {
    const record = { ...ready, state: 'active', activated_at };
    expect(RouteManifestVersionStorageSchema.parse(record)).toEqual(record);
  });

  it.each([
    ['one nanosecond earlier', '2026-10-16T08:00:00.123456788Z'],
    ['previous second', '2026-10-16T08:00:00.999999999+00:01'],
    ['lexically later offset', '2026-10-16T09:00:00.123456788+01:00'],
  ])('[DEC-197-M11] rejects activation %s', (_label, activated_at) => {
    for (const state of ['active', 'superseded']) {
      const result = RouteManifestVersionStorageSchema.safeParse({
        ...ready,
        state,
        activated_at,
      });
      expect(result).toMatchObject({
        success: false,
        error: {
          issues: [
            expect.objectContaining({
              path: ['activated_at'],
              message: 'manifest_activation_precedes_generation',
            }),
          ],
        },
      });
    }
  });

  it.each([
    'not-a-time',
    '2026-02-30T08:00:00Z',
    '2026-10-16T24:00:00Z',
    '2026-10-16T08:00:00',
    '2026-10-16T08:00:00+24:00',
    '2026-10-16T08:00:00.1234567890Z',
  ])('[DEC-197-M12] refuses malformed exact instant %s', (value) => {
    rejectAt({ ...ready, generated_at: value }, 'generated_at');
    rejectAt(
      { ...ready, state: 'active', activated_at: value },
      'activated_at',
    );
  });

  it.each(['', 'private', '10000000-0000-0000-0000-000000000001', 1])(
    '[DEC-197-M13] requires UUID id %s',
    (id) => rejectAt({ ...ready, id }, 'id'),
  );

  it.each([
    '',
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'g'.repeat(64),
    1,
  ])(
    '[DEC-197-M14] refuses malformed publication-set hash %s',
    (publication_set_hash) => {
      rejectAt({ ...ready, publication_set_hash }, 'publication_set_hash');
    },
  );

  it.each([null, [], 'record', 1])(
    '[DEC-197-M15] refuses a non-record root %s',
    (record) => {
      expect(RouteManifestVersionStorageSchema.safeParse(record).success).toBe(
        false,
      );
    },
  );
});
