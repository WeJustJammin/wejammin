import { beforeAll, describe, expect, it } from 'vitest';
import type {
  InventoryAnchor,
  InventoryFixture,
  InventoryPayload,
  InventoryRow,
  Metadata,
  ProductionPaths,
  ProductionValidator,
} from './helpers/dec203-proc-locks-metadata-types';

let validateDiagnostic: ProductionValidator;
let diagnosticPaths: ProductionPaths;
let bootstrapTargetAllowed: (target: string, root: string) => boolean;
let assertInventoryPayload: (value: unknown, anchor: unknown) => void;
let inventoryFixture: InventoryFixture;
let clonePayload: <T>(value: T) => T;
let inventoryPhases: readonly string[];

beforeAll(async () => {
  const production: unknown = await import(
    new URL(
      '../../infra/database-upgrades/native-tracing/receiving-bootstrap-diagnostic-values.mjs',
      import.meta.url,
    ).href
  );
  const helpers: unknown = await import(
    new URL(
      '../native/helpers/dec203-bootstrap-pre-ready-values.mjs',
      import.meta.url,
    ).href
  );
  const fixtures: unknown = await import(
    new URL(
      '../native/helpers/dec203-bootstrap-pre-ready-inventory-fixtures.mjs',
      import.meta.url,
    ).href
  );
  const productionExports = production as Record<string, unknown>;
  const helperExports = helpers as Record<string, unknown>;
  const fixtureExports = fixtures as Record<string, unknown>;
  validateDiagnostic =
    productionExports.validateDiagnostic as ProductionValidator;
  diagnosticPaths = productionExports.diagnosticPaths as ProductionPaths;
  bootstrapTargetAllowed = productionExports.bootstrapTargetAllowed as (
    target: string,
    root: string,
  ) => boolean;
  assertInventoryPayload = helperExports.assertInventoryPayload as (
    value: unknown,
    anchor: unknown,
  ) => void;
  inventoryFixture = fixtureExports.inventoryFixture as InventoryFixture;
  clonePayload = fixtureExports.clonePayload as <T>(value: T) => T;
  inventoryPhases = fixtureExports.inventoryPhases as readonly string[];
  expect(validateDiagnostic).toBeTypeOf('function');
  expect(diagnosticPaths).toBeTypeOf('function');
  expect(bootstrapTargetAllowed).toBeTypeOf('function');
  expect(assertInventoryPayload).toBeTypeOf('function');
  expect(inventoryFixture).toBeTypeOf('function');
});

const ROOT = '/tmp/dec203-bootstrap-ABC123';
const METADATA: Metadata = Object.freeze({
  target: '/proc/locks',
  device: '8',
  inode: '131',
  mode: 0o100444,
  uid: 0,
  gid: 0,
});
const FLAGS = ['02400000', '02500000'] as const;

function productionBody(phase: string, flags: string): Record<string, unknown> {
  const paths = diagnosticPaths(ROOT);
  return {
    phase,
    process: {
      pid: 501,
      ppid: 500,
      startTime: '5010',
      session: 500,
      uid: 1000,
      executable: {
        path: paths[0],
        sha256: 'a'.repeat(64),
        device: '1',
        inode: '801',
        size: 32,
        mode: 0o100755,
        uid: 1000,
      },
    },
    fds: [
      {
        fd: 30,
        ...METADATA,
        flags,
        pos: '0',
        pidfd: null,
      },
    ],
    locks: [],
  };
}

function productionAccepts(phase: string, flags: string): void {
  validateDiagnostic(
    'inventory',
    productionBody(phase, flags),
    'inventory-1',
    diagnosticPaths(ROOT),
    ROOT,
  );
}

function testMetadataRow(flags: string): InventoryRow {
  return {
    fd: 30,
    target: '/proc/locks',
    device: '8',
    inode: '131',
    mode: 0o100444,
    uid: 0,
    gid: 0,
    flags,
    pos: '0',
    pidfd: null,
  };
}

function testInventory(
  phase: string,
  flags: string,
  anchorExtra?: object,
): {
  payload: InventoryPayload;
  anchor: InventoryAnchor;
} {
  const base = inventoryFixture(phase);
  const payload = clonePayload(base.payload);
  payload.fds.push(testMetadataRow(flags));
  const kernelMetadata = Object.freeze({ ...METADATA });
  const anchor = Object.freeze({
    ...base.anchor,
    kernelMetadata,
    ...anchorExtra,
  });
  return { payload, anchor };
}

const nonCompilerPhases = [
  'owner-leased',
  'coordinator-precompile',
  'coordinator-adopted',
] as const;

const INVALID_ROW_MUTATIONS = [
  ['writable mode', (row: InventoryRow) => (row.mode = 0o100644)],
  ['directory type', (row: InventoryRow) => (row.mode = 0o040444)],
  ['character-device type', (row: InventoryRow) => (row.mode = 0o020444)],
  ['non-root uid', (row: InventoryRow) => (row.uid = 1000)],
  ['non-root gid', (row: InventoryRow) => (row.gid = 1000)],
  ['RDWR access', (row: InventoryRow) => (row.flags = '02400002')],
  ['noncanonical flag', (row: InventoryRow) => (row.flags = '02400001')],
  ['missing CLOEXEC', (row: InventoryRow) => (row.flags = '0400000')],
  ['missing NOFOLLOW', (row: InventoryRow) => (row.flags = '02000000')],
  ['O_PATH', (row: InventoryRow) => (row.flags = '010000000')],
  ['extra descriptor flag', (row: InventoryRow) => (row.flags = '02400010')],
  ['pidfd', (row: InventoryRow) => (row.pidfd = { pid: 501, nspid: [501] })],
] as const satisfies readonly (readonly [
  string,
  (row: InventoryRow) => void,
])[];

describe('DEC203 /proc/locks metadata binding (private contract RED)', () => {
  for (const phase of nonCompilerPhases)
    for (const flags of FLAGS)
      it(`PROD accepts exact /proc/locks FD30 in ${phase} with flags ${flags}`, () => {
        expect(() => productionAccepts(phase, flags)).not.toThrow();
      });

  it('PROD refuses /proc/locks metadata during lease-compiler-live', () => {
    expect(() => productionAccepts('lease-compiler-live', FLAGS[0])).toThrow();
  });

  for (const [label, mutate] of INVALID_ROW_MUTATIONS)
    it(`PROD refuses metadata with ${label}`, () => {
      const body = productionBody('owner-leased', FLAGS[0]);
      mutate((body.fds as InventoryRow[])[0]!);
      expect(() =>
        validateDiagnostic(
          'inventory',
          body,
          'inventory-negative',
          diagnosticPaths(ROOT),
          ROOT,
        ),
      ).toThrow();
    });

  for (const target of [
    '/proc/self/locks',
    '/proc/locksx',
    '/proc//locks',
    '/proc/123/fd',
    '/proc/123/stat',
    '/proc/123/fdinfo/7',
    '/proc/locks\0forged',
  ])
    it(`PROD refuses unknown proc target ${JSON.stringify(target)}`, () => {
      const body = productionBody('coordinator-precompile', FLAGS[0]);
      (body.fds as InventoryRow[])[0]!.target = target;
      expect(() =>
        validateDiagnostic(
          'inventory',
          body,
          'inventory-target-negative',
          diagnosticPaths(ROOT),
          ROOT,
        ),
      ).toThrow();
    });

  it('PROD exact-name predicate allows only the selected kernel object', () => {
    expect(bootstrapTargetAllowed('/proc/locks', ROOT)).toBe(true);
    for (const target of [
      '/proc/self/locks',
      '/proc/123/fd',
      '/proc/123/stat',
      '/proc/123/fdinfo/7',
      '/proc/locksx',
      '/proc/locks\0forged',
    ])
      expect(bootstrapTargetAllowed(target, ROOT)).toBe(false);
  });

  for (const phase of nonCompilerPhases)
    for (const flags of FLAGS)
      it(`TEST accepts independently anchored FD30 in ${phase} with flags ${flags}`, () => {
        const { payload, anchor } = testInventory(phase, flags);
        expect(() => assertInventoryPayload(payload, anchor)).not.toThrow();
      });

  it('TEST legacy payload and anchor remain valid without metadata', () => {
    for (const phase of inventoryPhases) {
      const { payload, anchor } = inventoryFixture(phase);
      expect(() => assertInventoryPayload(payload, anchor)).not.toThrow();
    }
  });

  it('TEST refuses metadata without the independent kernel anchor', () => {
    const { payload } = testInventory('owner-leased', FLAGS[0]);
    const { anchor } = inventoryFixture('owner-leased');
    expect(() => assertInventoryPayload(payload, anchor)).toThrow();
  });

  for (const [label, mutate] of [
    ['device', (metadata: Metadata) => (metadata.device = '9')],
    ['inode', (metadata: Metadata) => (metadata.inode = '132')],
    ['mode', (metadata: Metadata) => (metadata.mode = 0o100644)],
    ['uid', (metadata: Metadata) => (metadata.uid = 1000)],
    ['gid', (metadata: Metadata) => (metadata.gid = 1000)],
    [
      'target spelling',
      (metadata: Metadata) => (metadata.target = '/proc/self/locks'),
    ],
  ] as const)
    it(`TEST refuses forged independent kernel ${label}`, () => {
      const { payload, anchor } = testInventory(
        'coordinator-adopted',
        FLAGS[0],
      );
      const forged = { ...anchor.kernelMetadata! };
      mutate(forged);
      const candidate = Object.freeze({
        ...anchor,
        kernelMetadata: Object.freeze(forged),
      });
      expect(() => assertInventoryPayload(payload, candidate)).toThrow();
    });

  for (const key of ['device', 'inode', 'mode', 'uid', 'gid'] as const)
    it(`TEST refuses missing independent kernel ${key}`, () => {
      const { payload, anchor } = testInventory(
        'coordinator-precompile',
        FLAGS[0],
      );
      const missing = { ...anchor.kernelMetadata! } as Record<string, unknown>;
      delete missing[key];
      const candidate = Object.freeze({
        ...anchor,
        kernelMetadata: Object.freeze(missing),
      });
      expect(() => assertInventoryPayload(payload, candidate)).toThrow();
    });

  it('TEST refuses an extra kernel anchor key', () => {
    const { payload, anchor } = testInventory('owner-leased', FLAGS[0]);
    const kernelMetadata = Object.freeze({
      ...anchor.kernelMetadata!,
      extra: 'x',
    });
    const forged = Object.freeze({ ...anchor, kernelMetadata });
    expect(() => assertInventoryPayload(payload, forged)).toThrow();
  });

  for (const [label, mutate] of INVALID_ROW_MUTATIONS)
    it(`TEST refuses metadata with ${label}`, () => {
      const { payload, anchor } = testInventory(
        'coordinator-precompile',
        FLAGS[0],
      );
      mutate(payload.fds.at(-1)!);
      expect(() => assertInventoryPayload(payload, anchor)).toThrow();
    });

  it('TEST retains sorted-table and complete-required-FD guards', () => {
    const sorted = testInventory('owner-leased', FLAGS[0]);
    sorted.payload.fds.reverse();
    expect(() =>
      assertInventoryPayload(sorted.payload, sorted.anchor),
    ).toThrow();

    const missingBase = inventoryFixture('owner-leased');
    const missingPayload = clonePayload(missingBase.payload);
    missingPayload.fds = missingPayload.fds.filter((row) => row.fd !== 3);
    expect(() =>
      assertInventoryPayload(missingPayload, missingBase.anchor),
    ).toThrow();
  });

  it('TEST retains FLOCK completeness and protected-object alias guards', () => {
    const noLockBase = inventoryFixture('owner-leased');
    const noLockPayload = clonePayload(noLockBase.payload);
    noLockPayload.locks = noLockPayload.locks.slice(1);
    expect(() =>
      assertInventoryPayload(noLockPayload, noLockBase.anchor),
    ).toThrow();

    const aliasBase = inventoryFixture('owner-leased');
    const aliasPayload = clonePayload(aliasBase.payload);
    aliasPayload.fds.push({ ...aliasPayload.fds[0]!, fd: 31 });
    expect(() =>
      assertInventoryPayload(aliasPayload, aliasBase.anchor),
    ).toThrow();
  });

  it('TEST refuses metadata in lease-compiler-live', () => {
    const { payload, anchor } = testInventory('lease-compiler-live', FLAGS[0]);
    expect(() => assertInventoryPayload(payload, anchor)).toThrow();
  });

  it('TEST refuses metadata disguised as required compiler stdio', () => {
    const base = testInventory('lease-compiler-live', FLAGS[0]);
    const payload = clonePayload(base.payload);
    const payloadMetadata: InventoryRow = {
      fd: 0,
      ...METADATA,
      flags: FLAGS[0],
      pos: '0',
      pidfd: null,
    };
    payload.fds = payload.fds
      .filter((row) => row.fd !== 30)
      .map((row) => (row.fd === 0 ? { ...payloadMetadata } : row));
    const kernelMetadata = Object.freeze({ ...METADATA });
    const anchorMetadata: InventoryRow = {
      fd: 0,
      ...METADATA,
      flags: FLAGS[0],
      pos: '0',
      pidfd: null,
    };
    const anchor = Object.freeze({
      ...base.anchor,
      kernelMetadata,
      requiredFds: Object.freeze([
        anchorMetadata,
        ...base.anchor.requiredFds.filter((row) => row.fd !== 0),
      ]),
    });
    expect(() => assertInventoryPayload(payload, anchor)).toThrow();
  });
});
