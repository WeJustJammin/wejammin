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
import { join } from 'node:path';
import {
  gcc,
  native,
  node,
  ownedFixture,
  procMethods,
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
  argv: string[];
  cwd: string;
  group: number;
  namespace: string;
};
type View = {
  seen: {
    processes: Map<string, Info>;
    inventories: Map<string, unknown>;
    races: number;
  };
  sample(): void;
  assertComplete(): void;
};
type Api = {
  observer(outer: { pid: number }, artifacts: ArtifactCache): View;
};
type CmdlineResult = string | { readonly code: string };

describe.sequential(
  'DEC203 observer caller order, mocked proc not native proof',
  () => {
    let fixture: OwnedFixture | undefined;
    let proc: ProcSchedule | undefined;
    let api: Api;
    let view: View;
    beforeAll(async () => {
      const fs = await vi.importActual<RealFs>('node:fs');
      for (const key of Object.keys(
        procMethods,
      ) as (keyof typeof procMethods)[])
        io[key].mockImplementation((...args) => {
          if (typeof args[0] === 'string' && args[0].startsWith('/proc/'))
            throw new Error('proc access before mock transport');
          return Reflect.apply(fs[procMethods[key]], fs, args);
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
      expect((observer as Record<string, unknown>).observer).toBeTypeOf(
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
      expect(view.assertComplete).toBeTypeOf('function');
      view.sample();
      const compiler = view.seen.processes.get('owner-compiler');
      expect(compiler?.process.executable).toEqual(
        fixture.artifacts.observed(gcc),
      );
      expect(compiler?.process.pid).toBe(proc.compiler);
      expect(compiler?.process.session).toBe(proc.compiler);
      expect(compiler?.group).toBe(proc.compiler);
      expect(view.assertComplete()).toBeUndefined();
      expect(view.seen.races).toBe(0);
      expect(view.seen.inventories.size).toBe(0);
      proc.assertClosed();
      proc.state.stage = 'owner';
    });
    afterEach(() => proc?.assertClosed());
    afterAll(() => fixture?.cleanup());
    const context = () => {
      if (!fixture || !proc) throw new Error('owned unit fixture unavailable');
      return { fixture, proc };
    };
    const unsaved = () => {
      expect(view.seen.processes.has('owner')).toBe(false);
      expect(view.seen.inventories.size).toBe(0);
      expect(view.seen.races).toBe(0);
    };
    const refused = (message?: string) => {
      let error: unknown;
      try {
        view.sample();
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: 'ERR_ASSERTION' });
      if (message) expect((error as Error).message).toBe(message);
      unsaved();
    };
    const pending = () => {
      context().proc.state.ownerNode = true;
      expect(() => view.sample()).not.toThrow();
      unsaved();
      expect(() => view.assertComplete()).toThrow();
    };
    const fresh = () => {
      const { fixture, proc } = context();
      proc.state.stage = 'compiler';
      return {
        fixture,
        proc,
        view: api.observer({ pid: proc.outer }, fixture.artifacts),
      };
    };
    const injectCompilerCmdline = (
      proc: ProcSchedule,
      results: readonly CmdlineResult[],
    ) => {
      const path = `/proc/${proc.compiler}/cmdline`;
      const fallback = results[results.length - 1];
      if (fallback === undefined) throw new Error('cmdline result required');
      const queue = [...results];
      const handles = new Map<
        number,
        { bytes: Buffer; error: Error | undefined; position: number }
      >();
      let next = -10_000;
      const open = io.open.getMockImplementation();
      const read = io.read.getMockImplementation();
      const close = io.close.getMockImplementation();
      expect(open).toBeTypeOf('function');
      expect(read).toBeTypeOf('function');
      expect(close).toBeTypeOf('function');
      io.open.mockImplementation((...args) => {
        if (args[0] !== path) return open!(...args);
        const selected = queue.shift() ?? fallback;
        const error =
          typeof selected === 'string'
            ? undefined
            : Object.assign(new Error(`compiler cmdline ${selected.code}`), {
                code: selected.code,
              });
        const fd = next--;
        handles.set(fd, {
          bytes:
            typeof selected === 'string'
              ? Buffer.from(selected)
              : Buffer.alloc(0),
          error,
          position: 0,
        });
        return fd;
      });
      io.read.mockImplementation((...args) => {
        const held =
          typeof args[0] === 'number' ? handles.get(args[0]) : undefined;
        if (!held) return read!(...args);
        if (held.error) throw held.error;
        const buffer = args[1];
        expect(Buffer.isBuffer(buffer)).toBe(true);
        const count = Math.min(
          args[3] as number,
          7,
          held.bytes.length - held.position,
        );
        held.bytes.copy(
          buffer as Buffer,
          args[2] as number,
          held.position,
          held.position + count,
        );
        held.position += count;
        return count;
      });
      io.close.mockImplementation((...args) => {
        if (typeof args[0] === 'number' && handles.delete(args[0])) return;
        return close!(...args);
      });
      return () => expect(handles.size).toBe(0);
    };
    const hardFresh = (candidate: View, expectedCode: string) => {
      let error: unknown;
      try {
        candidate.sample();
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: expectedCode });
      expect(candidate.seen.races).toBe(0);
      expect(candidate.seen.processes.has('owner-compiler')).toBe(false);
      expect(candidate.seen.inventories.size).toBe(0);
      expect(() => candidate.assertComplete()).toThrow();
    };
    const guards = [
      ['compilerAlive', 'original owned instance must be absent'],
      ['compilerSurvivor', 'owned compiler session must be empty'],
    ] as const;

    for (const [flag, message] of guards) {
      it(`CO01 ${flag} refuses before second-slot consideration`, () => {
        const { proc } = context();
        proc.state.ownerNode = true;
        proc.state[flag] = true;
        refused(message);
        expect(view.assertComplete()).toBeUndefined();
      });
      it(`CO02 ${flag} changes on final bracket facts read`, () => {
        pending();
        const { proc } = context();
        proc.state.ownerNode = false;
        const open = io.open.getMockImplementation();
        expect(open).toBeTypeOf('function');
        let reads = 0;
        io.open.mockImplementation((...args) => {
          if (args[0] === `/proc/${proc.owner}/stat` && ++reads === 4)
            proc.state[flag] = true;
          return open!(...args);
        });
        refused(message);
        expect(reads).toBe(flag === 'compilerAlive' ? 4 : 5);
        expect(() => view.assertComplete()).toThrow();
      });
    }
    it('CO03 absent compiler permits pending Node then exact bracketed C', () => {
      pending();
      const { fixture, proc } = context();
      proc.state.ownerNode = false;
      expect(() => view.sample()).not.toThrow();
      expect(view.seen.processes.get('owner')).toEqual({
        process: {
          pid: proc.owner,
          ppid: proc.outer,
          startTime: proc.rawOwner.startTime,
          session: proc.rawOwner.session,
          uid: fixture.uid,
          executable: fixture.artifacts.observed(fixture.ownerFile),
        },
        argv: [fixture.ownerFile, '11111111-1111-4111-8111-111111111111'],
        cwd: fixture.root,
        group: proc.rawOwner.group,
        namespace: proc.rawOwner.namespace,
      });
      expect(view.assertComplete()).toBeUndefined();
      expect(view.seen.races).toBe(0);
    });
    it('CO04 repeated saved GCC bypasses owner absence checks', () => {
      const { proc } = context();
      proc.state.stage = 'compiler';
      const saved = view.seen.processes.get('owner-compiler');
      expect(() => view.sample()).not.toThrow();
      expect(view.seen.processes.get('owner-compiler')).toEqual(saved);
      expect(view.assertComplete()).toBeUndefined();
      unsaved();
    });
    it('CO05 a saved GCC PID regressing to raw Node latches failure', () => {
      const { proc } = context();
      proc.state.stage = 'compiler';
      const link = io.link.getMockImplementation();
      expect(link).toBeTypeOf('function');
      io.link.mockImplementation((...args) =>
        args[0] === `/proc/${proc.compiler}/exe` ? node : link!(...args),
      );
      refused();
      expect(() => view.assertComplete()).toThrow();
    });
    it('CO06 empty first compiler argv remains incomplete until a valid bracket', () => {
      const { fixture, proc, view: candidate } = fresh();
      const assertCompilerCmdlineClosed = injectCompilerCmdline(proc, [
        '',
        [
          gcc,
          '-std=c11',
          '-O2',
          '-Wall',
          '-Wextra',
          '-Werror',
          '-D_GNU_SOURCE',
          join(native, 'receiving-lease-owner.c'),
          '-o',
          fixture.ownerFile,
          '',
        ].join('\0'),
      ]);
      candidate.sample();
      assertCompilerCmdlineClosed();
      expect(candidate.seen.races).toBe(1);
      expect(candidate.seen.processes.has('owner-compiler')).toBe(false);
      expect(candidate.seen.inventories.size).toBe(0);
      expect(() => candidate.assertComplete()).toThrow();
      candidate.sample();
      assertCompilerCmdlineClosed();
      expect(candidate.seen.races).toBe(1);
      expect(candidate.seen.processes.get('owner-compiler')?.argv).toEqual([
        gcc,
        '-std=c11',
        '-O2',
        '-Wall',
        '-Wextra',
        '-Werror',
        '-D_GNU_SOURCE',
        join(native, 'receiving-lease-owner.c'),
        '-o',
        fixture.ownerFile,
      ]);
      expect(candidate.assertComplete()).toBeUndefined();
      expect(candidate.seen.inventories.size).toBe(0);
    });
    it('CO07 nonempty malformed compiler argv remains a hard refusal', () => {
      const { proc, view: candidate } = fresh();
      const assertCompilerCmdlineClosed = injectCompilerCmdline(proc, [
        `${gcc}\0-std=c11`,
      ]);
      hardFresh(candidate, 'ERR_ASSERTION');
      assertCompilerCmdlineClosed();
    });
    it('CO08 compiler argv EACCES remains a hard refusal', () => {
      const { proc, view: candidate } = fresh();
      const assertCompilerCmdlineClosed = injectCompilerCmdline(proc, [
        { code: 'EACCES' },
      ]);
      hardFresh(candidate, 'EACCES');
      assertCompilerCmdlineClosed();
    });
  },
);
