import { describe, expect, expectTypeOf, it } from 'vitest';

import { MigrationPlanRecordSchema } from './migration-worker-plan-record-schema';
import type { MigrationPlanRecord } from './migration-worker-plan-types';
import {
  CmsSchemaDryRunClaimResponseSchema,
  type CmsSchemaDryRunClaimResponse,
} from './schema-dry-run-claim-response';
import {
  BINDINGS,
  firstFixture,
  IDS,
  LEVELS,
  levelRecord,
  replaceLevel,
  responseFixture,
  snapshot,
} from './schema-dry-run-claim-response-test-support';

const accepted = (input: CmsSchemaDryRunClaimResponse) => {
  const before = snapshot(input);
  const parsed = CmsSchemaDryRunClaimResponseSchema.safeParse(input);
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw new Error('Controlled response must parse');
  expectTypeOf(parsed.data).toEqualTypeOf<CmsSchemaDryRunClaimResponse>();
  expectTypeOf(parsed.data.plan).toEqualTypeOf<MigrationPlanRecord>();
  expect(parsed.data).toEqual(input);
  expect(MigrationPlanRecordSchema.safeParse(input.plan)).toEqual({
    success: true,
    data: parsed.data.plan,
  });
  for (const { level, keys } of LEVELS) {
    const output = level === 'outer' ? parsed.data : parsed.data[level];
    expect(Object.isFrozen(output)).toBe(true);
    expect(Reflect.ownKeys(output).sort()).toEqual([...keys].sort());
  }
  expect(snapshot(input)).toEqual(before);
  return parsed.data;
};
const rejected = (input: unknown) => {
  const before = snapshot(input);
  const parsed = CmsSchemaDryRunClaimResponseSchema.safeParse(input);
  expect(parsed.success).toBe(false);
  expect(snapshot(input)).toEqual(before);
};

describe('private claimed dry-run response schema', () => {
  it('accepts complete nonzero successor with distinct job, event and plan versions', () => {
    const parsed = accepted(responseFixture());
    expect([
      parsed.job.version,
      parsed.requestedEvent.aggregateVersion,
      parsed.plan.version,
    ]).toEqual(['9007199254740997', '9007199254740993', '13']);
    expect(parsed.plan.sourceCount).toBe('2');
  });

  it.each(['additive', 'conditional', 'breaking'] as const)(
    'preserves existing successor %s classification and transform pair',
    (classification) => {
      accepted(
        responseFixture({
          plan: {
            classification,
            transformKey:
              classification === 'additive' ? null : 'identity.revalidate',
            transformVersion: classification === 'additive' ? null : '1',
          },
        }),
      );
    },
  );
  it('accepts first-null provisional draft without adding report completion policy', () => {
    const parsed = accepted(firstFixture());
    expect(parsed.report.sourceVersionId).toBeNull();
    expect(parsed.candidate.supersedesId).toBeNull();
    expect(parsed.plan.fromVersionId).toBeNull();
  });
  it.each([
    { label: 'null', activeVersionId: null },
    { label: 'target', activeVersionId: IDS.target },
    { label: 'later UUID', activeVersionId: IDS.other },
  ])(
    'preserves completed first-null baseline active $label',
    ({ activeVersionId }) => {
      accepted(
        firstFixture({ state: 'completed', progress: 1, activeVersionId }),
      );
    },
  );
  it('preserves existing plan lease-token punctuation and UUID causation', () => {
    const parsed = accepted(
      responseFixture({
        requestedEvent: { causationId: IDS.other },
        plan: {
          leaseOwner: 'worker:legacy.1',
          leaseToken: 'lease:legacy.v1-2_3',
          leaseExpiresAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
    expect(parsed.plan.leaseToken).toBe('lease:legacy.v1-2_3');
  });

  it.each(BINDINGS)(
    'independently rejects equality $path with the other fourteen intact',
    ({ path, changes }) => {
      const input = responseFixture(changes);
      const before = snapshot(input);
      expect(MigrationPlanRecordSchema.safeParse(input.plan).success).toBe(
        true,
      );
      const parsed = CmsSchemaDryRunClaimResponseSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error(`Missing binding rejection: ${path}`);
      expect(parsed.error.issues).toEqual([
        {
          code: 'custom',
          path: path.split('.'),
          message: 'Claim response binding mismatch',
        },
      ]);
      expect(snapshot(input)).toEqual(before);
    },
  );
  describe.each([
    { label: 'successor', build: responseFixture, mismatch: null },
    { label: 'first-null', build: firstFixture, mismatch: IDS.other },
  ])('$label null-safe bindings', ({ build, mismatch }) => {
    it.each([
      { path: 'report.sourceVersionId', pair: false },
      { path: 'candidate.supersedesId', pair: true },
    ])('independently rejects $path', ({ path, pair }) => {
      const base = build();
      const raw = {
        ...base,
        report: { ...base.report, sourceVersionId: mismatch },
        candidate: pair
          ? { ...base.candidate, supersedesId: mismatch }
          : base.candidate,
      };
      const before = snapshot(raw);
      const parsed = CmsSchemaDryRunClaimResponseSchema.safeParse(raw);
      expect(parsed.success).toBe(false);
      if (parsed.success)
        throw new Error('Missing null-safe binding rejection');
      expect(parsed.error.issues).toEqual([
        {
          code: 'custom',
          path: path.split('.'),
          message: 'Claim response binding mismatch',
        },
      ]);
      expect(snapshot(raw)).toEqual(before);
    });
  });

  describe.each(LEVELS)('$level own closed shape', ({ level, keys }) => {
    it.each(keys)('rejects missing own key %s', (key) => {
      const input = responseFixture();
      const record = levelRecord(input, level);
      delete record[key];
      rejected(replaceLevel(input, level, record));
    });
    it('rejects unknown enumerable key', () => {
      const input = responseFixture();
      rejected(
        replaceLevel(input, level, {
          ...levelRecord(input, level),
          extra: true,
        }),
      );
    });
    it.each(['symbol', 'non-enumerable'] as const)(
      'rejects %s own extra',
      (kind) => {
        const input = responseFixture();
        const record = levelRecord(input, level);
        Object.defineProperty(
          record,
          kind === 'symbol' ? Symbol('extra') : 'extra',
          {
            value: true,
            enumerable: kind === 'symbol',
          },
        );
        rejected(replaceLevel(input, level, record));
      },
    );
    it.each(['none', 'symbol', 'non-enumerable'] as const)(
      'rejects inherited required key with %s own replacement',
      (kind) => {
        const input = responseFixture();
        const record = levelRecord(input, level);
        const key = keys[0];
        const inherited = record[key];
        delete record[key];
        Object.setPrototypeOf(record, { [key]: inherited });
        if (kind !== 'none')
          Object.defineProperty(
            record,
            kind === 'symbol' ? Symbol('replacement') : 'replacement',
            { value: true, enumerable: false },
          );
        expect(Object.hasOwn(record, key)).toBe(false);
        expect(record[key]).toBe(inherited);
        expect(Reflect.ownKeys(record)).toHaveLength(
          keys.length - (kind === 'none' ? 1 : 0),
        );
        rejected(replaceLevel(input, level, record));
      },
    );
    it.each([null, undefined, 1, 'not-object', []])(
      'rejects nonrecord level %j',
      (value) => {
        rejected(replaceLevel(responseFixture(), level, value));
      },
    );
  });

  it.each([
    { label: 'raw plan', value: () => responseFixture().plan },
    {
      label: 'blind plan wrapper',
      value: () => ({ plan: responseFixture().plan }),
    },
  ])('rejects forbidden projection $label', ({ value }) => rejected(value()));
  it.each([
    { level: 'job', field: 'lease_token' },
    { level: 'candidate', field: 'created_by' },
    { level: 'report', field: 'attempt' },
  ] as const)('rejects SQL projection $level.$field', ({ level, field }) => {
    const input = responseFixture();
    rejected(
      replaceLevel(input, level, {
        ...levelRecord(input, level),
        [field]: IDS.other,
      }),
    );
  });

  describe.each(LEVELS.filter(({ level }) => level !== 'outer'))(
    '$level primitive contracts',
    ({ level, keys }) => {
      it.each(keys.filter((key) => key === 'id' || key.endsWith('Id')))(
        'rejects malformed and numeric UUID %s',
        (key) => {
          for (const value of ['not-a-uuid', 1]) {
            const input = responseFixture();
            rejected(
              replaceLevel(input, level, {
                ...levelRecord(input, level),
                [key]: value,
              }),
            );
          }
        },
      );
      it.each(
        keys.filter(
          (key) =>
            (key === 'id' || key.endsWith('Id')) &&
            ![
              'sourceVersionId',
              'supersedesId',
              'fromVersionId',
              'activeVersionId',
              'causationId',
            ].includes(key),
        ),
      )('rejects null nonnullable UUID %s', (key) => {
        const input = responseFixture();
        rejected(
          replaceLevel(input, level, {
            ...levelRecord(input, level),
            [key]: null,
          }),
        );
      });
    },
  );
  it.each([
    { level: 'job', field: 'version' },
    { level: 'requestedEvent', field: 'aggregateVersion' },
    { level: 'plan', field: 'version' },
  ] as const)('rejects invalid decimal $level.$field', ({ level, field }) => {
    for (const value of [null, 1, '0', '01', '9223372036854775808']) {
      const input = responseFixture();
      rejected(
        replaceLevel(input, level, {
          ...levelRecord(input, level),
          [field]: value,
        }),
      );
    }
  });
  it.each([
    { level: 'job', field: 'type', value: 'object.verify' },
    { level: 'requestedEvent', field: 'eventType', value: 'object.uploaded' },
    { level: 'requestedEvent', field: 'aggregateType', value: 'content' },
    { level: 'requestedEvent', field: 'schemaVersion', value: 2 },
  ] as const)(
    'rejects wrong CMS/event narrowing $level.$field',
    ({ level, field, value }) => {
      const input = responseFixture();
      rejected(
        replaceLevel(input, level, {
          ...levelRecord(input, level),
          [field]: value,
        }),
      );
    },
  );

  it.each([
    'cursor',
    'sourceCount',
    'targetCount',
    'rowErrorCount',
    'migratedCount',
    'failedCount',
  ])('retains plan counter validation for %s', (field) => {
    for (const value of [null, 1, '01', '-1']) {
      const input = responseFixture();
      rejected({ ...input, plan: { ...input.plan, [field]: value } });
    }
  });
  it.each([
    ['state', { state: 'unknown' }],
    ['progress lower bound', { progress: -0.1 }],
    ['progress upper bound', { progress: 1.1 }],
    ['classification', { classification: 'unknown' }],
    ['additive transform', { transformKey: 'identity', transformVersion: '1' }],
    ['missing conditional transform', { classification: 'conditional' }],
    [
      'bad transform key',
      {
        classification: 'breaking',
        transformKey: '!bad',
        transformVersion: '1',
      },
    ],
    [
      'bad transform version',
      {
        classification: 'breaking',
        transformKey: 'identity',
        transformVersion: '0',
      },
    ],
    ['compiler hash', { compilerHash: 'bad' }],
    ['source hash', { sourceHash: 'bad' }],
    ['target hash', { targetHash: 'bad' }],
    ['lease owner', { leaseOwner: '!bad' }],
    ['lease token', { leaseToken: '!bad' }],
    ['lease expiry', { leaseExpiresAt: 'bad' }],
    ['successor null active', { activeVersionId: null }],
  ] as const)('retains existing plan validation: %s', (_label, change) => {
    const input = responseFixture();
    rejected({ ...input, plan: { ...input.plan, ...change } });
  });
  it('retains first-null zero-shape and noncompleted active constraints', () => {
    rejected(firstFixture({ sourceCount: '1' }));
    rejected(firstFixture({ sourceHash: 'a'.repeat(64) }));
    rejected(firstFixture({ activeVersionId: IDS.target }));
  });
  it('retains distinct source and target plan IDs with response bindings aligned', () => {
    rejected(
      responseFixture({
        report: { sourceVersionId: IDS.target },
        candidate: { supersedesId: IDS.target },
        plan: { fromVersionId: IDS.target },
      }),
    );
  });
});
