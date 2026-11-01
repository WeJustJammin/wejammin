import { describe, expect, it } from 'vitest';

type Validator = (...args: unknown[]) => unknown;
type ExportName = 'validateCompiledMode' | 'validateUnsealedOutput';

async function api(name: ExportName): Promise<Validator> {
  const url = new URL(
    '../../infra/database-upgrades/native-tracing/receiving-bootstrap-resources.mjs',
    import.meta.url,
  );
  const namespace: unknown = await import(url.href);
  const value = (namespace as Record<string, unknown>)[name];
  expect(value, `actual private export ${name}`).toBeTypeOf('function');
  return value as Validator;
}

function rejects(validate: Validator, args: readonly unknown[], code: string) {
  let thrown: unknown;
  try {
    validate(...args);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).toMatchObject({ name: 'Error', message: code, code });
}

// Independent literal full modes, not the predicate's bit-mask calculation.
const ownerModes = [
  0o100600, 0o100601, 0o100610, 0o100611, 0o100700, 0o100701, 0o100710,
  0o100711,
] as const;

const invalidModes: readonly [string, unknown][] = [
  ['other-read', 0o100604],
  ['group-read', 0o100640],
  ['other-write', 0o100602],
  ['group-write', 0o100620],
  ['world-read-write', 0o100666],
  ['execute-plus-extra-read', 0o100744],
  ['setuid', 0o104600],
  ['setgid', 0o102600],
  ['sticky', 0o101600],
  ['missing-owner-write', 0o100400],
  ['missing-owner-read', 0o100200],
  ['missing-owner-both', 0o100000],
  ['execute-without-owner-write', 0o100500],
  ['execute-without-owner-read', 0o100300],
  ['bare-permissions', 0o600],
  ['directory', 0o040600],
  ['symlink', 0o120600],
  ['socket', 0o140600],
  ['fifo', 0o010600],
  ['character-device', 0o020600],
  ['block-device', 0o060600],
  ['zero', 0],
  ['negative', -1],
  ['fraction', 0o100600 + 0.5],
  ['positive-infinity', Infinity],
  ['negative-infinity', -Infinity],
  ['nan', NaN],
  ['unsafe-integer', Number.MAX_SAFE_INTEGER + 1],
  ['largest-safe-integer', Number.MAX_SAFE_INTEGER],
  ['32-bit-alias', 2 ** 32 + 0o100600],
  ['negative-32-bit-alias', -(2 ** 32) + 0o100600],
  ['undefined', undefined],
  ['null', null],
  ['true', true],
  ['false', false],
  ['octal-string', '0o100600'],
  ['decimal-string', '33152'],
  ['permission-string', '100600'],
  ['empty-string', ''],
  ['bigint', 0o100600n],
  ['empty-array', []],
  ['coercible-array', [0o100600]],
  ['object', {}],
  ['coercible-object', Object.freeze({ valueOf: () => 0o100600 })],
  ['symbol', Symbol('mode')],
  ['function', () => 0o100600],
];

const invalidPhases: readonly [string, unknown][] = [
  ['empty', ''],
  ['uppercase', 'OWNER'],
  ['mixed-case', 'Lease'],
  ['unknown', 'compiler'],
  ['undefined', undefined],
  ['null', null],
  ['number', 0],
  ['boolean', true],
  ['array', ['owner']],
  ['coercible-object', Object.freeze({ toString: () => 'owner' })],
];

const invalidArities: readonly (readonly unknown[])[] = [
  [],
  [0o100600],
  [0o100600, 'owner', undefined],
  [0o100600, 'lease', null, 0],
  [null],
];

function initialStat(mode: number) {
  if (typeof process.getuid !== 'function')
    throw new Error('current UID premise unavailable');
  const uid = process.getuid();
  expect(uid, 'actual current UID matches the fixed profile').toBe(1000);
  // Plain predicate input only: no observed file, workspace or authority.
  return Object.freeze({
    uid: BigInt(uid),
    mode: BigInt(mode),
    isFile: () => true,
  });
}

describe('DEC203 compiled output modes, pure predicates only', () => {
  it('OM01 exposes exact two-argument validation and undefined success', async () => {
    const validate = await api('validateCompiledMode');
    expect(validate.length).toBe(2);
    expect(validate(0o100600, 'owner')).toBeUndefined();
    expect(validate(0o100600, 'lease')).toBeUndefined();
  });

  for (const mode of ownerModes)
    it(`OM02 owner accepts literal full mode ${mode.toString(8)}`, async () => {
      const validate = await api('validateCompiledMode');
      expect(validate(mode, 'owner')).toBeUndefined();
    });

  it('OM03 lease accepts full regular-file 0600 before normalization', async () => {
    const validate = await api('validateCompiledMode');
    expect(validate(0o100600, 'lease')).toBeUndefined();
  });

  for (const mode of ownerModes.slice(1))
    it(`OM04 lease accepts intermediate executable mode ${mode.toString(8)}`, async () => {
      const validate = await api('validateCompiledMode');
      expect(validate(0o100600, 'lease')).toBeUndefined();
      expect(validate(mode, 'lease')).toBeUndefined();
    });

  for (const phase of ['owner', 'lease'] as const)
    for (const [label, mode] of invalidModes)
      it(`OM05 ${phase} refuses ${label} without mode coercion`, async () => {
        const validate = await api('validateCompiledMode');
        expect(validate(0o100600, phase)).toBeUndefined();
        rejects(validate, [mode, phase], 'DEC203_SUPERVISOR_IDENTITY_CHANGED');
      });

  for (const [label, phase] of invalidPhases)
    it(`OM06 refuses exact-phase violation ${label}`, async () => {
      const validate = await api('validateCompiledMode');
      expect(validate(0o100600, 'owner')).toBeUndefined();
      rejects(validate, [0o100600, phase], 'DEC203_SUPERVISOR_REFUSED');
    });

  for (const [index, args] of invalidArities.entries())
    it(`OM07 refuses argument vector ${index} with arity ${args.length}`, async () => {
      const validate = await api('validateCompiledMode');
      expect(validate(0o100600, 'owner')).toBeUndefined();
      rejects(validate, args, 'DEC203_SUPERVISOR_REFUSED');
    });

  it('OM08 phase refusal precedes invalid-mode handling', async () => {
    const validate = await api('validateCompiledMode');
    expect(validate(0o100600, 'owner')).toBeUndefined();
    rejects(validate, [null, 'unknown'], 'DEC203_SUPERVISOR_REFUSED');
  });

  it('OM09 initial unsealed output still accepts strict 0600 only', async () => {
    const validate = await api('validateUnsealedOutput');
    expect(validate(initialStat(0o100600))).toBeUndefined();
  });

  for (const mode of ownerModes.slice(1))
    it(`OM10 initial output refuses execute bits ${mode.toString(8)}`, async () => {
      const validate = await api('validateUnsealedOutput');
      expect(validate(initialStat(0o100600))).toBeUndefined();
      rejects(
        validate,
        [initialStat(mode)],
        'DEC203_SUPERVISOR_IDENTITY_CHANGED',
      );
    });
});
