import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  gcc,
  lockPaths,
  ownedFixture,
  type Artifact,
  type ArtifactCache,
  type ArtifactConstructor,
  type OwnedFixture,
  type RealFs,
} from './helpers/dec203-test-observer-fixture';
import {
  procSchedule,
  type ProcSchedule,
} from './helpers/dec203-test-observer-proc';
import {
  procLocksIdentity,
  procLocksLstat,
  procLocksNamedMutations,
  type ObserverMetadataRow,
} from './helpers/dec203-proc-locks-observation-fixture';

const io = vi.hoisted(() => ({
  open: vi.fn<(...args: unknown[]) => unknown>(),
  read: vi.fn<(...args: unknown[]) => unknown>(),
  close: vi.fn<(...args: unknown[]) => unknown>(),
  lstat: vi.fn<(...args: unknown[]) => unknown>(),
  stat: vi.fn<(...args: unknown[]) => unknown>(),
  link: vi.fn<(...args: unknown[]) => unknown>(),
  names: vi.fn<(...args: unknown[]) => unknown>(),
}));
vi.mock('node:fs', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  openSync: io.open,
  readSync: io.read,
  closeSync: io.close,
  lstatSync: io.lstat,
  statSync: io.stat,
  readlinkSync: io.link,
  readdirSync: io.names,
}));

type Info = {
  process: {
    pid: number;
    ppid: number;
    startTime: string;
    session: number;
    uid: number;
    executable: Artifact;
  };
  group: number;
  namespace: string;
  fds: unknown[];
  locks: unknown[];
};
type View = {
  seen: {
    processes: Map<string, Info>;
    inventories: Map<string, Info>;
    races: number;
  };
  sample(): void;
};
type Api = {
  observer(outer: { pid: number }, artifacts: ArtifactCache): View;
  assertAbsent(record: Info['process']): void;
  assertSessionAbsent(session: number): void;
};

function bindProcLocksLstat(
  value: typeof procLocksLstat | Error = procLocksLstat,
): void {
  const previous = io.lstat.getMockImplementation();
  expect(previous).toBeTypeOf('function');
  io.lstat.mockImplementation((...args) => {
    if (args[0] === '/proc/locks') {
      if (value instanceof Error) throw value;
      return value;
    }
    return previous!(...args);
  });
}

function configureProcLocks(proc: ProcSchedule, flags = '02400000'): void {
  const row = proc.rows.get(0)!;
  proc.state.target = '/proc/locks';
  row.target = '/proc/locks';
  row.inode = Number(procLocksIdentity.ino);
  row.mode = Number(procLocksIdentity.mode);
  row.uid = Number(procLocksIdentity.uid);
  row.gid = Number(procLocksIdentity.gid);
  row.flags = flags;
  bindProcLocksLstat();
}

describe.sequential(
  'DEC203 TEST observer, mocked proc schedule, not native proof',
  () => {
    let fixture: OwnedFixture | undefined;
    let proc: ProcSchedule | undefined;
    let api: Api;
    let view: View;
    beforeAll(async () => {
      const fs = await vi.importActual<RealFs>('node:fs');
      const methods = {
        open: 'openSync',
        read: 'readSync',
        close: 'closeSync',
        lstat: 'lstatSync',
        stat: 'statSync',
        link: 'readlinkSync',
        names: 'readdirSync',
      } as const;
      for (const key of Object.keys(methods) as (keyof typeof methods)[])
        io[key].mockImplementation((...args) => {
          if (typeof args[0] === 'string' && args[0].startsWith('/proc/'))
            throw new Error('proc access before mock transport');
          return Reflect.apply(fs[methods[key]], fs, args);
        });
      const artifacts: unknown = await import(
        new URL(
          '../native/helpers/dec203-bootstrap-pre-ready-artifacts.mjs',
          import.meta.url,
        ).href
      );
      const Constructor = (artifacts as Record<string, unknown>).Artifacts;
      expect(Constructor).toBeTypeOf('function');
      fixture = ownedFixture(fs, Constructor as ArtifactConstructor);
      const observer: unknown = await import(
        new URL(
          '../native/helpers/dec203-bootstrap-pre-ready-observe.mjs',
          import.meta.url,
        ).href
      );
      for (const key of ['observer', 'assertAbsent', 'assertSessionAbsent'])
        expect((observer as Record<string, unknown>)[key]).toBeTypeOf(
          'function',
        );
      api = observer as Api;
    });
    beforeEach(async () => {
      if (!fixture) throw new Error('physical fixture premise unavailable');
      vi.clearAllMocks();
      proc = procSchedule(
        io,
        await vi.importActual<RealFs>('node:fs'),
        fixture,
      );
      view = api.observer({ pid: proc.outer }, fixture.artifacts);
      view.sample(); // Real processInfo over mocked first-stage GCC, not a live GCC claim.
      const compiler = view.seen.processes.get('owner-compiler');
      expect(compiler?.process.executable).toEqual(
        fixture.artifacts.observed(gcc),
      );
      expect(compiler?.process.pid).toBe(proc.compiler);
      expect(compiler?.process.session).toBe(proc.compiler);
      expect(compiler?.group).toBe(proc.compiler);
      expect(view.seen.races).toBe(0);
      expect(view.seen.inventories.size).toBe(0);
      if (!compiler) throw new Error('bracketed compiler premise unavailable');
      proc.state.stage = 'drained';
      api.assertAbsent(compiler.process);
      api.assertSessionAbsent(compiler.process.session);
      proc.assertClosed();
      proc.state.stage = 'owner';
    });
    afterEach(() => proc?.assertClosed());
    afterAll(() => fixture?.cleanup());
    const context = () => {
      if (!fixture || !proc) throw new Error('owned unit fixture unavailable');
      return { fixture, proc };
    };
    const raced = () => {
      expect(() => view.sample()).not.toThrow();
      expect(view.seen.processes.has('owner')).toBe(true);
      expect(view.seen.races).toBe(1);
      expect(view.seen.inventories.size).toBe(0);
    };
    const hard = (message?: string, expectedCode = 'ERR_ASSERTION') => {
      let error: unknown;
      try {
        view.sample();
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: expectedCode });
      expect(view.seen.processes.has('owner')).toBe(true);
      if (message) expect((error as Error).message).toContain(message);
      expect(view.seen.races).toBe(0);
      expect(view.seen.inventories.size).toBe(0);
    };

    it('OT01 publishes every sorted allowed FD and all FOUR FLOCK rows', () => {
      const { fixture, proc } = context();
      view.sample();
      expect(view.seen.races).toBe(0);
      expect([...view.seen.inventories.keys()]).toEqual(['owner-leased']);
      const value = view.seen.inventories.get('owner-leased');
      expect(value?.process).toEqual({
        pid: proc.owner,
        ppid: proc.outer,
        startTime: proc.rawOwner.startTime,
        session: proc.rawOwner.session,
        uid: fixture.uid,
        executable: fixture.artifacts.observed(fixture.ownerFile),
      });
      expect(value?.namespace).toBe(proc.rawOwner.namespace);
      expect(value?.group).toBe(proc.rawOwner.group);
      const common = {
        device: '1',
        uid: fixture.uid,
        gid: fixture.uid,
        pos: '0',
        flags: '02000002',
        pidfd: null,
      };
      const locked = lockPaths.map((target, index) => ({
        ...common,
        fd: index + 3,
        target,
        inode: String(index + 303),
        mode: 0o100644,
      }));
      expect(value?.fds).toEqual([
        { ...common, fd: 0, target: '/dev/null', inode: '10', mode: 0o020666 },
        ...locked,
        {
          ...common,
          fd: 7,
          target: 'anon_inode:[pidfd]',
          inode: '107',
          mode: 0o600,
          pidfd: { pid: proc.outer, nspid: [proc.outer] },
        },
        {
          ...common,
          fd: 8,
          target: 'pipe:[108]',
          inode: '108',
          mode: 0o010600,
          flags: '02000000',
        },
        {
          ...common,
          fd: 9,
          target: 'socket:[109]',
          inode: '109',
          mode: 0o140600,
        },
      ]);
      expect(value?.locks).toEqual(
        lockPaths.map((_, index) => ({
          fd: index + 3,
          ownerPid: proc.owner,
          mode: index === 1 ? 'READ' : 'WRITE',
          device: '1',
          inode: String(index + 303),
          start: '0',
          end: 'EOF',
        })),
      );
    });
    it('OT02 coherent unknown target remains a closed-policy assertion', () => {
      context().proc.state.target = '/unknown';
      hard('closed diagnostic target');
    });
    for (const changed of ['target', 'inode'])
      it(`OT03 unknown row ${changed} churn is only a race`, () => {
        const { proc } = context();
        proc.state.target = '/unknown';
        if (changed === 'target') proc.state.replaceTarget = '/dev/null';
        else proc.state.replaceInode = true;
        raced();
      });
    for (const changed of ['remove', 'add'] as const)
      it(`OT04 unknown row final-table ${changed} is only a race`, () => {
        const { proc } = context();
        proc.state.target = '/unknown';
        proc.state.finalNames = changed;
        raced();
      });
    it('OT05 unknown row plus post-table process churn is only a race', () => {
      const { proc } = context();
      proc.state.target = '/unknown';
      proc.state.processChurn = true;
      raced();
    });
    it('OT06 known-to-unknown cannot publish an inventory', () => {
      context().proc.state.replaceTarget = '/unknown';
      raced();
    });
    for (const bound of ['nul', 'newline', 'ascii', 'utf8'])
      it(`OT07 immediate ${bound} target bound precedes later churn`, () => {
        const { fixture, proc } = context();
        const tails = {
          nul: 'bad\0name',
          newline: 'bad\nname',
          ascii: 'a'.repeat(513),
          utf8: 'é'.repeat(256),
        };
        proc.state.target =
          fixture.root + '/' + tails[bound as keyof typeof tails];
        proc.state.replaceTarget = '/dev/null';
        proc.state.replaceInode = true;
        proc.state.finalNames = 'remove';
        hard();
      });
    for (const flags of ['02400000', '02500000'] as const)
      it(`OT08 publishes complete /proc/locks FD0 with canonical flags ${flags}`, () => {
        const { proc } = context();
        configureProcLocks(proc, flags);
        view.sample();
        expect(io.lstat).toHaveBeenCalledWith('/proc/locks', { bigint: true });
        const value = view.seen.inventories.get('owner-leased');
        const fds = value?.fds as
          Array<{ fd: number; target: string }> | undefined;
        expect(fds).toHaveLength(8);
        expect(fds?.map((row) => row.fd)).toEqual([0, 3, 4, 5, 6, 7, 8, 9]);
        expect(fds?.[0]).toEqual({
          fd: 0,
          target: '/proc/locks',
          device: '1',
          inode: '10',
          mode: 0o100444,
          uid: 0,
          gid: 0,
          flags,
          pos: '0',
          pidfd: null,
        });
        expect(fds?.slice(1).map(({ fd, target }) => ({ fd, target }))).toEqual(
          [
            ...lockPaths.map((target, index) => ({ fd: index + 3, target })),
            { fd: 7, target: 'anon_inode:[pidfd]' },
            { fd: 8, target: 'pipe:[108]' },
            { fd: 9, target: 'socket:[109]' },
          ],
        );
        expect(value?.locks).toEqual(
          lockPaths.map((target, index) => ({
            fd: index + 3,
            ownerPid: proc.owner,
            mode: index === 1 ? 'READ' : 'WRITE',
            device: '1',
            inode: String(index + 303),
            start: '0',
            end: 'EOF',
          })),
        );
      });
    for (const [label, mutate] of [
      ['WRITE', (row: ObserverMetadataRow) => (row.flags = '02400001')],
      ['RDWR', (row: ObserverMetadataRow) => (row.flags = '02400002')],
      ['noCLOEXEC', (row: ObserverMetadataRow) => (row.flags = '00400000')],
      ['noNOFOLLOW', (row: ObserverMetadataRow) => (row.flags = '02000000')],
      ['O_PATH', (row: ObserverMetadataRow) => (row.flags = '010000000')],
      ['wrong mode', (row: ObserverMetadataRow) => (row.mode = 0o100644)],
      ['wrong uid', (row: ObserverMetadataRow) => (row.uid = 1000)],
      ['wrong gid', (row: ObserverMetadataRow) => (row.gid = 1000)],
    ] as const)
      it(`OT09 refuses /proc/locks metadata with ${label}`, () => {
        const { proc } = context();
        configureProcLocks(proc);
        mutate(proc.rows.get(0)!);
        hard();
      });
    it('OT10 missing or unreadable named /proc/locks object is refused', () => {
      const { proc } = context();
      configureProcLocks(proc);
      bindProcLocksLstat(
        Object.assign(new Error('named proc locks unreadable'), {
          code: 'EACCES',
        }),
      );
      hard(undefined, 'EACCES');
    });
    for (const [label, mutate] of procLocksNamedMutations)
      it(`OT11 refuses forged named /proc/locks ${label}`, () => {
        const { proc } = context();
        configureProcLocks(proc);
        bindProcLocksLstat(mutate(procLocksLstat));
        hard();
      });
  },
);
