import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  info,
  lock,
  observed,
  root,
  schedule,
  stat,
  type Stat,
} from './helpers/dec203-fd-snapshot-fixture';
import {
  procLocksIdentity,
  procLocksLstat,
  procLocksNamedMutations,
  procLocksSnapshotRows,
  type SnapshotMetadataRow,
} from './helpers/dec203-proc-locks-observation-fixture';

const io = vi.hoisted(() => ({
  lstat: vi.fn<(path: string) => { uid: bigint }>(),
  names: vi.fn<(path: string) => string[]>(),
  link: vi.fn<(path: string) => string>(),
  stat: vi.fn<(path: string) => Stat>(),
  text: vi.fn<(path: string, limit?: number) => string>(),
}));
vi.mock('node:fs', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  lstatSync: io.lstat,
  readdirSync: io.names,
  readlinkSync: io.link,
  statSync: io.stat,
}));
vi.mock(
  '../../infra/database-upgrades/native-tracing/receiving-bootstrap-artifacts.mjs',
  async (original) => ({
    ...(await original<Record<string, unknown>>()),
    kernelText: io.text,
  }),
);

function bindProcLocksLstat(
  value: typeof procLocksLstat | Error = procLocksLstat,
): void {
  const previous = io.lstat.getMockImplementation();
  expect(previous).toBeTypeOf('function');
  io.lstat.mockImplementation((path) => {
    if (path === '/proc/locks') {
      if (value instanceof Error) throw value;
      return value;
    }
    return previous!(path);
  });
}

function configureProcLocks(
  plan: ReturnType<typeof schedule>,
  flags = '02400000',
): void {
  const row = plan.rows.get(0)!;
  row.target = '/proc/locks';
  row.stat = { ...row.stat, ...procLocksIdentity };
  row.info = row.info.replace('flags: 02000002', `flags: ${flags}`);
  bindProcLocksLstat();
}

async function take() {
  const namespace: unknown = await import(
    new URL(
      '../../infra/database-upgrades/native-tracing/receiving-bootstrap-processes.mjs',
      import.meta.url,
    ).href
  );
  const value = (namespace as Record<string, unknown>).fdSnapshot;
  expect(value).toBeTypeOf('function');
  return (
    value as (
      value: typeof observed,
      root: string,
    ) => {
      process: typeof observed.process;
      fds: unknown[];
      locks: unknown[];
    }
  )(observed, root);
}
async function refused(incomplete = false) {
  let error: unknown;
  let returned = false;
  try {
    await take();
    returned = true;
  } catch (caught) {
    error = caught;
  }
  expect(returned).toBe(false);
  expect(error).toBeInstanceOf(Error);
  const code = `DEC203_SUPERVISOR_${incomplete ? 'HISTORY_GAP' : 'IDENTITY_CHANGED'}`;
  expect(error).toMatchObject({ code, message: code });
  expect((error as { incompleteSnapshot?: unknown }).incompleteSnapshot).toBe(
    incomplete ? true : undefined,
  );
}
async function refusedAny() {
  let error: unknown;
  let returned = false;
  try {
    await take();
    returned = true;
  } catch (caught) {
    error = caught;
  }
  expect(returned).toBe(false);
  expect(error).toBeInstanceOf(Error);
}

describe('DEC203 fdSnapshot, deterministic mocked reads, not kernel proof', () => {
  let plan: ReturnType<typeof schedule>;
  beforeEach(() => {
    vi.resetAllMocks();
    plan = schedule(io);
  });

  it('FS01 returns the entire sorted allowed table and lock/pidfd metadata', async () => {
    const result = await take();
    expect(result.process).toBe(observed.process);
    const common = {
      device: '1',
      uid: 1000,
      gid: 1000,
      flags: '02000002',
      pos: '0',
    };
    expect(result.fds).toEqual([
      {
        ...common,
        fd: 0,
        target: '/dev/null',
        inode: '10',
        mode: 0o020666,
        pidfd: null,
      },
      {
        ...common,
        fd: 3,
        target: '/tmp/wejammin-supabase-ci.lock',
        inode: '33',
        mode: 0o100644,
        pidfd: null,
      },
      {
        ...common,
        fd: 4,
        target: 'pipe:[44]',
        inode: '44',
        mode: 0o010600,
        pidfd: null,
      },
      {
        ...common,
        fd: 10,
        target: 'anon_inode:[pidfd]',
        inode: '110',
        mode: 0o600,
        pidfd: { pid: 501, nspid: [501] },
      },
    ]);
    expect(result.locks).toEqual([
      {
        fd: 3,
        ownerPid: 501,
        mode: 'WRITE',
        device: '1',
        inode: '33',
        start: '0',
        end: 'EOF',
      },
    ]);
    expect(io.names).toHaveBeenCalledTimes(2);
    for (const fd of [0, 3, 4, 10]) {
      expect(
        io.stat.mock.calls.filter(([path]) => path === `/proc/501/fd/${fd}`),
      ).toHaveLength(2);
      expect(io.text).toHaveBeenCalledWith(`/proc/501/fdinfo/${fd}`);
    }
  });
  it('FS02 stable coherent unknown target is a hard refusal', async () => {
    plan.rows.get(0)!.target = '/unknown';
    await refused();
  });
  for (const changed of ['target', 'stat'])
    it(`FS03 torn unknown ${changed} is incomplete, not a policy refusal`, async () => {
      plan.rows.get(0)!.target = '/unknown';
      plan.replaced.set(
        0,
        changed === 'target' ? { target: '/dev/null' } : { stat: stat(11n) },
      );
      await refused(true);
    });
  it('FS04 unknown row missing from the final table is incomplete', async () => {
    plan.rows.get(0)!.target = '/unknown';
    plan.final = [3, 4, 10];
    await refused(true);
  });
  it('FS05 known to unknown replacement cannot return a snapshot', async () => {
    plan.replaced.set(0, { target: '/unknown' });
    await refused(true);
  });
  for (const [key, value] of Object.entries({
    pid: 502,
    ppid: 499,
    startTime: '9002',
    uid: 1001,
    namespace: 'pid:[701]',
  }))
    it(`FS06 immutable process ${key} change remains fatal`, async () => {
      for (const unknown of [false, true]) {
        vi.clearAllMocks();
        plan = schedule(io);
        if (unknown) plan.rows.get(0)!.target = '/unknown';
        Object.assign(plan.after, { [key]: value });
        await refused();
      }
    });
  for (const [index, target] of [
    '',
    'relative',
    'pipe:[x]',
    root + '/bad\nname',
    root + '/' + 'a'.repeat(513),
    root + '/' + 'é'.repeat(256),
  ].entries())
    it(`FS07 malformed or oversized target ${index} is hard refusal`, async () => {
      plan.rows.get(0)!.target = target;
      await refused();
    });
  for (const [from, to] of [
    ['flags: 02000002', 'flags: bad'],
    ['pos: 0', 'pos: -1'],
    ['ino: 10', 'ino: 11'],
  ] as const)
    it(`FS08 incomplete row metadata ${from} cannot return`, async () => {
      plan.rows.get(0)!.info = info(10).replace(from, to);
      await refused(true);
    });
  for (const kind of ['format', 'duplicate', 'global', 'device', 'inode'])
    it(`FS09 invalid lock ${kind} cannot return`, async () => {
      const row = plan.rows.get(3)!;
      if (kind === 'format') row.info = row.info.replace('FLOCK', 'POSIX');
      if (kind === 'duplicate') row.info += `lock: ${lock}\n`;
      if (kind === 'global') plan.global = '';
      if (kind === 'device')
        row.info = row.info.replace('00:01:33', '00:02:33');
      if (kind === 'inode') row.info = row.info.replace('00:01:33', '00:01:34');
      await refused(!['format', 'duplicate'].includes(kind));
    });
  for (const kind of [
    'missing-namespace',
    'zero-namespace',
    'unsafe-pid',
    'too-many',
  ])
    it(`FS10 invalid pidfd ${kind} cannot return`, async () => {
      const row = plan.rows.get(10)!;
      if (kind === 'missing-namespace') row.info = info(110) + 'Pid: 501\n';
      if (kind === 'zero-namespace')
        row.info = row.info.replace('NSpid: 501', 'NSpid: 0');
      if (kind === 'unsafe-pid')
        row.info = row.info.replace('Pid: 501', 'Pid: 9007199254740993');
      if (kind === 'too-many')
        row.info =
          info(110) +
          'Pid: 501\nNSpid: ' +
          Array<string>(17).fill('501').join(' ') +
          '\n';
      await refused(kind === 'missing-namespace');
    });
  it('FS11 an added final-table row prevents a partial result', async () => {
    plan.final = [0, 3, 4, 10, 11];
    await refused(true);
  });
  for (const [index, target] of [
    root + '/bad\0name',
    root + '/bad\nname',
    root + '/' + 'a'.repeat(513),
    root + '/' + 'é'.repeat(256),
  ].entries())
    it(`FS12 hard target bound ${index} precedes later incoherence`, async () => {
      plan.rows.get(0)!.target = target;
      plan.replaced.set(0, { target: '/dev/null', stat: stat(11n) });
      plan.final = [3, 4, 10];
      await refused();
    });
  for (const flags of ['02400000', '02500000'] as const)
    it(`FS13 accepts complete /proc/locks row with canonical flags ${flags}`, async () => {
      configureProcLocks(plan, flags);
      const result = await take();
      expect(io.lstat).toHaveBeenCalledWith('/proc/locks', { bigint: true });
      expect(result.fds).toEqual(procLocksSnapshotRows(flags));
      expect(result.locks).toEqual([
        {
          fd: 3,
          ownerPid: 501,
          mode: 'WRITE',
          device: '1',
          inode: '33',
          start: '0',
          end: 'EOF',
        },
      ]);
    });
  for (const [label, mutate] of [
    [
      'WRITE',
      (row: SnapshotMetadataRow) =>
        (row.info = row.info.replace('flags: 02400000', 'flags: 02400001')),
    ],
    [
      'RDWR',
      (row: SnapshotMetadataRow) =>
        (row.info = row.info.replace('flags: 02400000', 'flags: 02400002')),
    ],
    [
      'noCLOEXEC',
      (row: SnapshotMetadataRow) =>
        (row.info = row.info.replace('flags: 02400000', 'flags: 00400000')),
    ],
    [
      'noNOFOLLOW',
      (row: SnapshotMetadataRow) =>
        (row.info = row.info.replace('flags: 02400000', 'flags: 02000000')),
    ],
    [
      'O_PATH',
      (row: SnapshotMetadataRow) =>
        (row.info = row.info.replace('flags: 02400000', 'flags: 010000000')),
    ],
    [
      'wrong mode',
      (row: SnapshotMetadataRow) =>
        (row.stat = { ...row.stat, mode: 0o100644n }),
    ],
    [
      'wrong uid',
      (row: SnapshotMetadataRow) => (row.stat = { ...row.stat, uid: 1000n }),
    ],
    [
      'wrong gid',
      (row: SnapshotMetadataRow) => (row.stat = { ...row.stat, gid: 1000n }),
    ],
  ] as const)
    it(`FS14 refuses /proc/locks metadata with ${label}`, async () => {
      configureProcLocks(plan);
      mutate(plan.rows.get(0)!);
      await refused();
    });
  it('FS15 metadata row replacement remains an incomplete snapshot', async () => {
    configureProcLocks(plan);
    plan.replaced.set(0, { target: '/dev/null', stat: stat(11n) });
    await refused(true);
  });
  it('FS16 missing or unreadable named /proc/locks object is refused', async () => {
    configureProcLocks(plan);
    bindProcLocksLstat(
      Object.assign(new Error('named proc locks unavailable'), {
        code: 'ENOENT',
      }),
    );
    await refusedAny();
  });
  for (const [label, mutate] of procLocksNamedMutations)
    it(`FS17 refuses forged named /proc/locks ${label}`, async () => {
      configureProcLocks(plan);
      bindProcLocksLstat(mutate(procLocksLstat));
      await refused();
    });
});
