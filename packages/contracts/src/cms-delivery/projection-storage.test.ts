import { describe, expect, expectTypeOf, it } from 'vitest';

import type { JsonValue } from '../api-error';
import { PublicationProjectionStateSchema } from '../cms-editorial/workflow-models';
import {
  PublicationProjectionStorageSchema,
  PublicationProjectionStorageStateSchema,
  type PublicationProjectionStorage,
} from './storage';

const PROJECTION_FIELDS = [
  'id',
  'publication_id',
  'route_manifest_id',
  'locale',
  'audience',
  'render_payload',
  'render_hash',
  'discovery_hash',
  'required_refs',
  'state',
  'version',
  'created_at',
  'updated_at',
] as const;
const projection: PublicationProjectionStorage = {
  id: '20000000-0000-4000-8000-000000000002',
  publication_id: '30000000-0000-4000-8000-000000000003',
  route_manifest_id: '10000000-0000-4000-8000-000000000001',
  locale: 'en-US',
  audience: 'public',
  render_payload: { blocks: [{ text: 'Frozen projection', visible: true }] },
  render_hash: 'b'.repeat(64),
  discovery_hash: 'c'.repeat(64),
  required_refs: [{ consumer: 'media', version: '9007199254740993' }],
  state: 'building',
  version: '9007199254740993',
  created_at: '2026-10-16T08:00:00.123456789Z',
  updated_at: '2026-10-16T04:00:00.123456790-04:00',
};

const rejectAt = (value: unknown, field: string): void => {
  const result = PublicationProjectionStorageSchema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: [field] })]),
  );
};

describe('[DEC-197] PublicationProjection private receiving record', () => {
  it('[DEC-197-P01] preserves thirteen exact physical keys and JSON-safe types', () => {
    const parsed = PublicationProjectionStorageSchema.parse(projection);
    expect(parsed).toEqual(projection);
    expect(Object.keys(parsed).sort()).toEqual([...PROJECTION_FIELDS].sort());
    expectTypeOf(parsed.version).toEqualTypeOf<string>();
    expectTypeOf(parsed.render_payload).toEqualTypeOf<
      Readonly<Record<string, JsonValue>>
    >();
    expectTypeOf(parsed.required_refs).toEqualTypeOf<readonly JsonValue[]>();
  });

  it.each(PROJECTION_FIELDS)(
    '[DEC-197-P02] requires non-null physical %s',
    (field) => {
      const missing: Record<string, unknown> = { ...projection };
      Reflect.deleteProperty(missing, field);
      rejectAt(missing, field);
      rejectAt({ ...projection, [field]: undefined }, field);
      rejectAt({ ...projection, [field]: null }, field);
    },
  );

  it.each([
    'owner_id',
    'ownerId',
    'publicationId',
    'route',
    'createdAt',
    'activated_at',
    'projectionState',
    'extra',
  ])('[DEC-197-P03] refuses unregistered %s', (field) => {
    const result = PublicationProjectionStorageSchema.safeParse({
      ...projection,
      [field]: projection.id,
    });
    expect(result).toMatchObject({
      success: false,
      error: {
        issues: [{ code: 'unrecognized_keys', keys: [field], path: [] }],
      },
    });
  });

  it('[DEC-197-P04] preserves storage and public summary state vocabularies', () => {
    expect(PublicationProjectionStorageStateSchema.options).toEqual([
      'building',
      'ready',
      'blocked',
      'failed_retryable',
      'active',
      'superseded',
      'revoked',
    ]);
    expect(PublicationProjectionStateSchema.options).toEqual([
      'pending',
      'converged',
      'degraded',
    ]);
    for (const state of PublicationProjectionStorageStateSchema.options) {
      expect(
        PublicationProjectionStorageSchema.parse({ ...projection, state }),
      ).toEqual({ ...projection, state });
      expect(PublicationProjectionStateSchema.safeParse(state).success).toBe(
        false,
      );
    }
  });

  it.each([
    'pending',
    'converged',
    'degraded',
    'draft',
    'review',
    'approved',
    '',
    'ACTIVE',
  ])('[DEC-197-P05] refuses non-storage state %s', (state) => {
    rejectAt({ ...projection, state }, 'state');
  });

  it.each(['1', '9007199254740993', '9223372036854775807'])(
    '[DEC-197-P06] round-trips bigint version %s losslessly',
    (version) => {
      expect(
        PublicationProjectionStorageSchema.parse({ ...projection, version }),
      ).toEqual({ ...projection, version });
    },
  );

  it.each([
    '0',
    '-1',
    '01',
    '+1',
    '1.5',
    '1e3',
    '1 ',
    '',
    '9223372036854775808',
    '99999999999999999999',
    1,
    Number.MAX_SAFE_INTEGER + 1,
    1n,
  ])('[DEC-197-P07] refuses invalid or numeric version %s', (version) => {
    rejectAt({ ...projection, version }, 'version');
  });

  it.each(['id', 'publication_id', 'route_manifest_id'])(
    '[DEC-197-P08] requires UUID %s',
    (field) => {
      for (const value of ['private', '', 1]) {
        rejectAt({ ...projection, [field]: value }, field);
      }
    },
  );

  it.each(['render_hash', 'discovery_hash'])(
    '[DEC-197-P09] requires lowercase hex-64 %s',
    (field) => {
      for (const value of [
        '',
        'a'.repeat(63),
        'a'.repeat(65),
        'A'.repeat(64),
        'g'.repeat(64),
        1,
      ]) {
        rejectAt({ ...projection, [field]: value }, field);
      }
    },
  );

  it.each([
    ['locale', 16],
    ['audience', 48],
  ] as const)(
    '[DEC-197-P10] applies only the varchar character maximum to %s',
    (field, maximum) => {
      for (const value of [
        '',
        'x_y !',
        'x'.repeat(maximum),
        '🎵'.repeat(maximum),
      ]) {
        const record = { ...projection, [field]: value };
        expect(PublicationProjectionStorageSchema.parse(record)).toEqual(
          record,
        );
      }
      for (const value of [
        'x'.repeat(maximum + 1),
        '🎵'.repeat(maximum + 1),
        1,
      ]) {
        rejectAt({ ...projection, [field]: value }, field);
      }
    },
  );

  it('[DEC-197-P11] accepts empty JSON kinds and nested JSON primitives', () => {
    const values: readonly JsonValue[] = [
      null,
      true,
      false,
      0,
      -0.5,
      'text',
      [],
      {},
      { nested: [null, 1, { visible: false }] },
    ];
    for (const [render_payload, required_refs] of [
      [{}, []],
      [{ values }, values],
    ]) {
      const record = { ...projection, render_payload, required_refs };
      expect(PublicationProjectionStorageSchema.parse(record)).toEqual(record);
    }
  });

  it.each([[], 'text', 1, true, null])(
    '[DEC-197-P12] refuses non-object render_payload %s',
    (render_payload) => {
      rejectAt({ ...projection, render_payload }, 'render_payload');
    },
  );

  it.each([{}, 'text', 1, true, null])(
    '[DEC-197-P13] refuses non-array required_refs %s',
    (required_refs) =>
      rejectAt({ ...projection, required_refs }, 'required_refs'),
  );

  it.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['infinity', Infinity],
    ['negative infinity', -Infinity],
    ['bigint', 1n],
    ['function', (): null => null],
    ['symbol', Symbol('private')],
    ['Date', new Date('2026-10-16T08:00:00Z')],
    ['Map', new Map()],
  ])(
    '[DEC-197-P14] rejects nested non-JSON %s in either field',
    (_label, value) => {
      rejectAt(
        { ...projection, render_payload: { nested: [value] } },
        'render_payload',
      );
      rejectAt(
        { ...projection, required_refs: [{ nested: value }] },
        'required_refs',
      );
    },
  );

  it('[DEC-197-P15] safely rejects cycles and hostile properties', () => {
    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;
    const arrayCycle: unknown[] = [];
    arrayCycle.push(arrayCycle);
    const throwingGetter = Object.defineProperty({}, 'value', {
      get: (): never => {
        throw new Error('must refuse safely');
      },
    });
    const symbolKey = { [Symbol('private')]: 'value' };
    for (const value of [cycle, arrayCycle, throwingGetter, symbolKey]) {
      rejectAt(
        { ...projection, render_payload: { nested: value } },
        'render_payload',
      );
      rejectAt({ ...projection, required_refs: [value] }, 'required_refs');
    }
  });

  it('[DEC-197-P16] accepts shared acyclic values and null-prototype objects', () => {
    const shared = { leaf: 'safe' };
    const nullPrototype: unknown = Object.assign(Object.create(null), {
      safe: true,
    });
    const record = {
      ...projection,
      render_payload: { left: shared, right: shared, nullPrototype },
      required_refs: [shared, shared],
    };
    expect(PublicationProjectionStorageSchema.parse(record)).toEqual(record);
  });

  it('[DEC-197-P17] accepts JSON beyond error-detail size/depth caps', () => {
    let deep: JsonValue = null;
    for (let depth = 0; depth < 16; depth += 1) deep = { child: deep };
    const render_payload = {
      deep,
      keys: Object.fromEntries(
        Array.from({ length: 129 }, (_, index) => [`k${index}`, index]),
      ),
      large: 'x'.repeat(262_145),
    };
    const required_refs = Array.from({ length: 129 }, () => ({ deep }));
    const record = { ...projection, render_payload, required_refs };
    expect(PublicationProjectionStorageSchema.parse(record)).toEqual(record);
  });

  it.each(['created_at', 'updated_at'])(
    '[DEC-197-P18] validates exact timestamp %s without invented row ordering',
    (field) => {
      for (const value of [
        '2026-10-16T04:00:00.123456789-04:00',
        '2026-10-15T08:00:00.000000001Z',
      ]) {
        const record = { ...projection, [field]: value };
        expect(PublicationProjectionStorageSchema.parse(record)).toEqual(
          record,
        );
      }
      for (const value of [
        'invalid',
        '2026-02-30T08:00:00Z',
        '2026-10-16T08:00:00',
        '2026-10-16T08:00:00.1234567890Z',
        1,
      ]) {
        rejectAt({ ...projection, [field]: value }, field);
      }
    },
  );

  it.each([null, [], 'record', 1])(
    '[DEC-197-P19] refuses a non-record root %s',
    (record) => {
      expect(PublicationProjectionStorageSchema.safeParse(record).success).toBe(
        false,
      );
    },
  );

  it.each([
    ['P20', 'root render_payload', false, false],
    ['P21', 'nested render_payload', true, false],
    ['P22', 'nested required_refs', true, true],
  ] as const)(
    '[DEC-197-%s] preserves own __proto__ JSON data in %s',
    (_id, _location, nested, refs) => {
      const json: unknown = JSON.parse(
        '{"__proto__":{"dec197OwnJson":true},"kept":"json"}',
      );
      const container = nested ? { nested: json } : json;
      const record = {
        ...projection,
        render_payload: refs ? projection.render_payload : container,
        required_refs: refs ? [container] : projection.required_refs,
      };
      expect(Object.hasOwn(Object.prototype, 'dec197OwnJson')).toBe(false);
      const parsed = PublicationProjectionStorageSchema.parse(record);
      let output: unknown = refs
        ? parsed.required_refs[0]
        : parsed.render_payload;
      if (nested && output !== null && typeof output === 'object')
        output = Reflect.get(output, 'nested');
      for (const value of [json, output]) {
        if (value === null || typeof value !== 'object')
          throw new Error('Expected JSON object with own __proto__ data');
        expect(Object.hasOwn(value, '__proto__')).toBe(true);
        expect(
          Object.getOwnPropertyDescriptor(value, '__proto__'),
        ).toMatchObject({
          value: { dec197OwnJson: true },
          enumerable: true,
        });
        const prototype: unknown = Object.getPrototypeOf(value);
        expect(prototype === Object.prototype || prototype === null).toBe(true);
        expect('dec197OwnJson' in value).toBe(false);
      }
      expect(parsed).toEqual(record);
      expect(Object.hasOwn(Object.prototype, 'dec197OwnJson')).toBe(false);
    },
  );
});
