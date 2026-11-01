import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  gcc,
  launcher,
  lockPaths,
  native,
  node,
  procMethods as names,
  repository,
  type Io,
  type OwnedFixture,
  type Raw,
  type RealFs,
} from './dec203-test-observer-fixture';

export function procSchedule(io: Io, fs: RealFs, fixture: OwnedFixture) {
  const outer = process.pid + 1_000_000;
  const compiler = outer + 1;
  const owner = outer + 2;
  const unrelated = outer + 3;
  const raw = (
    pid: number,
    ppid: number,
    image: string,
    leader = outer,
  ): Raw => ({
    pid,
    ppid,
    image,
    group: leader,
    session: leader,
    startTime: String(pid + 10),
    uid: fixture.uid,
    namespace: 'pid:[700]',
  });
  const roles = new Map([
    [outer, raw(outer, process.pid, node)],
    [compiler, raw(compiler, outer, gcc, compiler)],
    [owner, raw(owner, outer, fixture.ownerFile)],
    [unrelated, raw(unrelated, 1, '/unit/unrelated', unrelated)],
  ]);
  const state = {
    stage: 'compiler' as 'compiler' | 'drained' | 'owner',
    target: '/dev/null',
    replaceTarget: null as string | null,
    replaceInode: false,
    finalNames: null as 'remove' | 'add' | null,
    processChurn: false,
    ownerNode: false,
    compilerAlive: false,
    compilerSurvivor: false,
  };
  let tableReads = 0;
  const linkReads = new Map<number, number>();
  const statReads = new Map<number, number>();
  const handles = new Map<number, { bytes: Buffer; position: number }>();
  let next = -1; // Mock transport IDs cannot alias a successful real openSync FD.
  const absent = () =>
    Object.assign(new Error('mock proc entry absent'), { code: 'ENOENT' });
  const present = (pid: number) =>
    pid === outer ||
    pid === unrelated ||
    (pid === compiler && (state.stage === 'compiler' || state.compilerAlive)) ||
    (pid === owner && state.stage === 'owner');
  const current = (pid: number) => {
    if (!present(pid)) throw absent();
    const value = roles.get(pid);
    assert.ok(value, 'only declared fixture processes');
    if (pid === owner && state.ownerNode) return { ...value, image: node };
    if (pid === unrelated && state.compilerSurvivor)
      return { ...value, group: compiler, session: compiler };
    return pid === owner && tableReads > 1 && state.processChurn
      ? { ...value, startTime: String(owner + 11) }
      : value;
  };
  const lock = (fd: number) =>
    `${fd - 2}: FLOCK ADVISORY ${fd === 4 ? 'READ' : 'WRITE'} ${owner} 00:01:${300 + fd} 0 EOF`;
  const rows = new Map<
    number,
    {
      target: string;
      inode: number;
      mode: number;
      flags: string;
      uid?: number;
      gid?: number;
    }
  >([
    [0, { target: '/dev/null', inode: 10, mode: 0o020666, flags: '02000002' }],
    ...lockPaths.map(
      (target, index) =>
        [
          index + 3,
          { target, inode: 303 + index, mode: 0o100644, flags: '02000002' },
        ] as const,
    ),
    [
      7,
      {
        target: 'anon_inode:[pidfd]',
        inode: 107,
        mode: 0o600,
        flags: '02000002',
      },
    ],
    [
      8,
      { target: 'pipe:[108]', inode: 108, mode: 0o010600, flags: '02000000' },
    ],
    [
      9,
      { target: 'socket:[109]', inode: 109, mode: 0o140600, flags: '02000002' },
    ],
  ]);
  const fdPaths = new Map(
    [...rows.keys()].map((fd) => [`/proc/${owner}/fd/${fd}`, fd]),
  );
  const textPaths = new Map<string, () => string>();
  for (const pid of roles.keys()) {
    textPaths.set(`/proc/${pid}/stat`, () => {
      const value = current(pid);
      const fields = [
        'S',
        String(value.ppid),
        String(value.group),
        String(value.session),
        ...Array<string>(15).fill('0'),
        value.startTime,
      ];
      return `${pid} (unit (${pid})) ${fields.join(' ')}`;
    });
  }
  textPaths.set(`/proc/${outer}/cmdline`, () =>
    [node, '--', launcher, ''].join('\0'),
  );
  textPaths.set(`/proc/${compiler}/cmdline`, () =>
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
  );
  textPaths.set(`/proc/${owner}/cmdline`, () =>
    [fixture.ownerFile, '11111111-1111-4111-8111-111111111111', ''].join('\0'),
  );
  textPaths.set(`/proc/${outer}/task/${outer}/children`, () =>
    state.stage === 'compiler'
      ? String(compiler)
      : state.stage === 'owner'
        ? [...(state.compilerAlive ? [compiler] : []), owner].join(' ')
        : '',
  );
  textPaths.set(`/proc/${owner}/task/${owner}/children`, () => {
    current(owner);
    return '';
  });
  textPaths.set('/proc/locks', () => [3, 4, 5, 6].map(lock).join('\n'));
  for (const [fd, value] of rows)
    textPaths.set(`/proc/${owner}/fdinfo/${fd}`, () => {
      current(owner);
      const base = `flags: ${value.flags}\npos: 0\nino: ${value.inode}\n`;
      if (fd >= 3 && fd <= 6) return base + `lock: ${lock(fd)}\n`;
      return fd === 7 ? base + `Pid: ${outer}\nNSpid: ${outer}\n` : base;
    });
  const allowed = new Set([
    node,
    gcc,
    fixture.root,
    fixture.ownerFile,
    join(fixture.root, 'owner'),
    join(fixture.root, 'lease'),
  ]);
  const real = (method: keyof typeof names, args: unknown[]) => {
    if (!['read', 'close'].includes(method)) {
      assert.equal(typeof args[0], 'string');
      assert.ok(
        allowed.has(args[0] as string),
        'only declared non-proc physical artifacts',
      );
    }
    return Reflect.apply(fs[names[method]], fs, args);
  };
  io.open.mockImplementation((...args) => {
    const path = args[0];
    if (typeof path !== 'string' || !path.startsWith('/proc/'))
      return real('open', args);
    const value = textPaths.get(path);
    assert.ok(value, 'only exact declared proc text paths');
    const subject = /^\/proc\/(\d+)\//.exec(path);
    if (subject) current(Number(subject[1]));
    const fd = next--;
    handles.set(fd, { bytes: Buffer.from(value()), position: 0 });
    return fd;
  });
  io.read.mockImplementation((...args) => {
    const fd = args[0] as number;
    if (fd >= 0) return real('read', args);
    const held = handles.get(fd);
    assert.ok(held, 'original live mock text handle');
    assert.ok(Buffer.isBuffer(args[1]));
    const buffer = args[1] as Buffer;
    const count = Math.min(
      args[3] as number,
      7,
      held.bytes.length - held.position,
    );
    held.bytes.copy(
      buffer,
      args[2] as number,
      held.position,
      held.position + count,
    );
    held.position += count;
    return count;
  });
  io.close.mockImplementation((...args) => {
    const fd = args[0] as number;
    if (fd >= 0) return real('close', args);
    assert.ok(handles.delete(fd), 'one close per original mock handle');
  });
  io.lstat.mockImplementation((...args) => {
    const match =
      typeof args[0] === 'string' && /^\/proc\/(\d+)$/.exec(args[0]);
    return match
      ? { uid: BigInt(current(Number(match[1])).uid) }
      : real('lstat', args);
  });
  io.link.mockImplementation((...args) => {
    const path = args[0] as string;
    const fd = fdPaths.get(path);
    if (fd !== undefined) {
      current(owner);
      const reads = (linkReads.get(fd) ?? 0) + 1;
      linkReads.set(fd, reads);
      return fd === 0
        ? reads > 1
          ? (state.replaceTarget ?? state.target)
          : state.target
        : rows.get(fd)!.target;
    }
    const match = /^\/proc\/(\d+)\/(exe|cwd|ns\/pid)$/.exec(path);
    if (!match) return real('link', args);
    const value = current(Number(match[1]));
    if (match[2] === 'exe') return value.image;
    if (match[2] === 'ns/pid') return value.namespace;
    return value.pid === outer
      ? repository
      : value.pid === compiler
        ? join(fixture.root, 'owner')
        : fixture.root;
  });
  io.stat.mockImplementation((...args) => {
    const fd = fdPaths.get(args[0] as string);
    if (fd === undefined) return real('stat', args);
    current(owner);
    const value = rows.get(fd)!;
    const reads = (statReads.get(fd) ?? 0) + 1;
    statReads.set(fd, reads);
    const ino = fd === 0 && reads > 1 && state.replaceInode ? 11 : value.inode;
    return {
      dev: 1n,
      ino: BigInt(ino),
      mode: BigInt(value.mode),
      uid: BigInt(value.uid ?? fixture.uid),
      gid: BigInt(value.gid ?? fixture.uid),
    };
  });
  io.names.mockImplementation((...args) => {
    if (args[0] === '/proc')
      return [...roles.keys()].filter(present).map(String);
    if (args[0] !== `/proc/${owner}/fd`) return real('names', args);
    current(owner);
    tableReads += 1;
    const values = [...rows.keys()].reverse();
    if (tableReads > 1 && state.finalNames === 'remove')
      return values.filter((fd) => fd !== 0).map(String);
    if (tableReads > 1 && state.finalNames === 'add') values.push(11);
    return values.map(String);
  });
  return {
    state,
    outer,
    owner,
    compiler,
    rawOwner: Object.freeze({ ...roles.get(owner)! }),
    rows,
    assertClosed: () =>
      assert.equal(handles.size, 0, 'all mock text reads closed'),
  };
}
export type ProcSchedule = ReturnType<typeof procSchedule>;
