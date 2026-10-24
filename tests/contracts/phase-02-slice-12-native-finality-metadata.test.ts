import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CGROUP_ROOT,
  GROUP_PATH,
  INIT_PID,
  MEMBER_PID,
  NAMESPACE,
  PROCS_PATH,
  TARGET_PATH,
  completeResult,
  createFinalityFixture,
  type AuditResult,
  type FinalityFixture,
} from './helpers/dec203-finality-metadata-fixture';
import { loadFinalityMetadataAudit } from './helpers/dec203-finality-metadata-vm';

const io = vi.hoisted(() => ({
  open: vi.fn<(path: string, flags: 'r') => number>(),
  read: vi.fn<
    (
      fd: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: null,
    ) => number
  >(),
  close: vi.fn<(fd: number) => void>(),
  link: vi.fn<(path: string) => string>(),
  realpath: vi.fn<(path: string) => string>(),
}));

type RunMetadataAudit = () => AuditResult;
let runMetadataAudit: RunMetadataAudit;
let fixture: FinalityFixture;
let handles: Map<number, { path: string; bytes: Buffer; position: number }>;
let rawBytes: Map<string, Buffer>;
let fileReads: Map<string, number>;
let linkReads: Map<string, number>;
let nextFd: number;
let openErrors: Map<string, Error>;
let readErrors: Map<string, Error>;
let closeErrors: Map<string, Error>;
let events: string[];

beforeAll(() => {
  runMetadataAudit = loadFinalityMetadataAudit({
    openSync: io.open,
    readSync: io.read,
    closeSync: io.close,
    readlinkSync: io.link,
    realpathSync: io.realpath,
  });
  expect(io.open).not.toHaveBeenCalled();
  expect(io.read).not.toHaveBeenCalled();
  expect(io.close).not.toHaveBeenCalled();
  expect(io.link).not.toHaveBeenCalled();
  expect(io.realpath).not.toHaveBeenCalled();
});

beforeEach(() => {
  vi.clearAllMocks();
  fixture = createFinalityFixture();
  handles = new Map();
  rawBytes = new Map();
  fileReads = new Map();
  linkReads = new Map();
  nextFd = -10_000;
  openErrors = new Map();
  readErrors = new Map();
  closeErrors = new Map();
  events = [];
  io.open.mockImplementation((path, flags) => {
    expect(flags).toBe('r');
    events.push(`open:${path}`);
    const error = openErrors.get(path);
    if (error) throw error;
    const values = fixture.files.get(path);
    if (!values) throw new Error(`unplanned open path: ${path}`);
    const index = fileReads.get(path) ?? 0;
    fileReads.set(path, index + 1);
    const value = values[Math.min(index, values.length - 1)];
    if (value === undefined) throw new Error(`empty file plan: ${path}`);
    const fd = nextFd--;
    handles.set(fd, {
      path,
      bytes: rawBytes.get(path) ?? Buffer.from(value),
      position: 0,
    });
    return fd;
  });
  io.read.mockImplementation((fd, buffer, offset, length, position) => {
    expect(position).toBeNull();
    const held = handles.get(fd);
    if (!held) throw new Error(`unplanned read handle: ${fd}`);
    const error = readErrors.get(held.path);
    if (error) throw error;
    const count = Math.min(length, held.bytes.length - held.position);
    held.bytes.copy(
      buffer,
      offset,
      held.position,
      held.position + Math.max(count, 0),
    );
    held.position += Math.max(count, 0);
    return Math.max(count, 0);
  });
  io.close.mockImplementation((fd) => {
    const held = handles.get(fd);
    if (!held) throw new Error(`unplanned close handle: ${fd}`);
    handles.delete(fd);
    events.push(`close:${held.path}`);
    const error = closeErrors.get(held.path);
    if (error) throw error;
  });
  io.link.mockImplementation((path) => {
    events.push(`link:${path}`);
    const values = fixture.links.get(path);
    if (!values) throw new Error(`unplanned namespace path: ${path}`);
    const index = linkReads.get(path) ?? 0;
    linkReads.set(path, index + 1);
    return values[Math.min(index, values.length - 1)]!;
  });
  io.realpath.mockImplementation((path) => {
    events.push(`realpath:${path}`);
    const value = fixture.realpaths.get(path);
    if (value === undefined) throw new Error(`unplanned realpath: ${path}`);
    return value;
  });
});

const openPaths = (): string[] =>
  events
    .filter((event) => event.startsWith('open:'))
    .map((event) => event.slice('open:'.length));
const closePaths = (): string[] =>
  events
    .filter((event) => event.startsWith('close:'))
    .map((event) => event.slice('close:'.length));
const coded = (result: AuditResult, code: string): void => {
  expect(result.state).toBe('refused');
  expect(result.failure).toMatchObject({ code });
  expect(
    result.failure?.secondaryCodes.every((value) => typeof value === 'string'),
  ).toBe(true);
};
const error = (code: string): Error => Object.assign(new Error(code), { code });
const initPaths = {
  stat: `/proc/${INIT_PID}/stat`,
  status: `/proc/${INIT_PID}/status`,
  cgroup: `/proc/${INIT_PID}/cgroup`,
  namespace: `/proc/${INIT_PID}/ns/pid`,
};
const memberPaths = {
  stat: `/proc/${MEMBER_PID}/stat`,
  status: `/proc/${MEMBER_PID}/status`,
  cgroup: `/proc/${MEMBER_PID}/cgroup`,
  namespace: `/proc/${MEMBER_PID}/ns/pid`,
};

describe('DEC203 finality metadata helper, strict mocked FS, not native proof', () => {
  it('FM01 returns exact complete two-round init/member metadata and closes every read', () => {
    const result = runMetadataAudit();
    expect(result).toEqual(completeResult());
    expect(Object.keys(result).sort()).toEqual([
      'failure',
      'frames',
      'kind',
      'members',
      'state',
      'target',
    ]);
    expect(openPaths()).toEqual(fixture.expectedOpenPaths);
    expect(closePaths()).toEqual(fixture.expectedOpenPaths);
    expect(handles.size).toBe(0);
    expect(io.realpath.mock.calls.map(([path]) => path)).toEqual([
      CGROUP_ROOT,
      GROUP_PATH,
      PROCS_PATH,
    ]);
    expect(io.link.mock.calls.map(([path]) => path)).toEqual([
      `/proc/${INIT_PID}/ns/pid`,
      `/proc/${MEMBER_PID}/ns/pid`,
      `/proc/${INIT_PID}/ns/pid`,
      `/proc/${MEMBER_PID}/ns/pid`,
    ]);
    expect(
      io.read.mock.calls.every(
        ([, buffer, offset, length, position]) =>
          Buffer.isBuffer(buffer) &&
          offset >= 0 &&
          length >= 0 &&
          length <= buffer.length - offset &&
          buffer.length <= 65_537 &&
          position === null,
      ),
    ).toBe(true);
  });

  it('FM02 invalid target refuses before any proc or sysfs observation', () => {
    fixture.files.set(TARGET_PATH, [
      JSON.stringify({ ...fixture.target, project: 'wrong_project' }),
    ]);
    const result = runMetadataAudit();
    coded(result, 'AUDIT_INVALID_TARGET');
    expect(result.target).toBeNull();
    expect(openPaths()).toEqual([TARGET_PATH]);
    expect(io.link).not.toHaveBeenCalled();
    expect(io.realpath).not.toHaveBeenCalled();
  });

  it('FM03 EACCES on init stat stops immediately after target read', () => {
    openErrors.set(initPaths.stat, error('EACCES'));
    const result = runMetadataAudit();
    coded(result, 'EACCES');
    expect(openPaths()).toEqual([TARGET_PATH, initPaths.stat]);
    expect(openPaths()).not.toContain(initPaths.status);
    expect(io.link).not.toHaveBeenCalled();
    expect(io.realpath).not.toHaveBeenCalled();
    expect(handles.size).toBe(0);
  });

  const malformed = [
    ['stat', initPaths.stat, 'not a stat record', 'AUDIT_MALFORMED_STAT'],
    ['status', initPaths.status, 'Pid:\t501\n', 'AUDIT_MALFORMED_STATUS'],
    [
      'cgroup',
      initPaths.cgroup,
      '11:memory:/foreign\n',
      'AUDIT_UNSUPPORTED_CGROUP',
    ],
  ] as const;
  for (const [label, path, value, code] of malformed)
    it(`FM04 refuses malformed ${label} without later reads`, () => {
      fixture.files.set(path, [value]);
      const result = runMetadataAudit();
      coded(result, code);
      expect(handles.size).toBe(0);
      const expected =
        path === initPaths.stat
          ? [TARGET_PATH, initPaths.stat]
          : path === initPaths.status
            ? [TARGET_PATH, initPaths.stat, initPaths.status]
            : [TARGET_PATH, initPaths.stat, initPaths.status, initPaths.cgroup];
      expect(openPaths()).toEqual(expected);
    });

  it('FM05 malformed namespace refuses before the identity bracket closes', () => {
    fixture.links.set(initPaths.namespace, ['not-a-pid-namespace']);
    const result = runMetadataAudit();
    coded(result, 'AUDIT_MALFORMED_NAMESPACE');
    expect(io.link).toHaveBeenCalledTimes(1);
    expect(openPaths()).not.toContain(PROCS_PATH);
  });

  for (const [label, mutate] of [
    ['container', () => ({ ...fixture.target, container: 'other' })],
    ['id', () => ({ ...fixture.target, id: 'z'.repeat(64) })],
    ['project', () => ({ ...fixture.target, project: 'other' })],
  ] as const)
    it(`FM06 refuses target ${label} mismatch with no observation`, () => {
      fixture.files.set(TARGET_PATH, [JSON.stringify(mutate())]);
      const result = runMetadataAudit();
      coded(result, 'AUDIT_INVALID_TARGET');
      expect(openPaths()).toEqual([TARGET_PATH]);
      expect(io.link).not.toHaveBeenCalled();
      expect(io.realpath).not.toHaveBeenCalled();
    });

  for (const [label, value, code] of [
    ['cgroup escape', '0::/docker/../foreign.scope\n', 'AUDIT_CGROUP_ESCAPE'],
    ['foreign leaf', '0::/docker/foreign.scope\n', 'AUDIT_UNSUPPORTED_CGROUP'],
    ['v1 hierarchy', '12:memory:/docker/foreign\n', 'AUDIT_UNSUPPORTED_CGROUP'],
  ] as const)
    it(`FM07 refuses ${label} before membership read`, () => {
      fixture.files.set(initPaths.cgroup, [value]);
      const result = runMetadataAudit();
      coded(result, code);
      expect(openPaths()).not.toContain(PROCS_PATH);
      expect(io.realpath).not.toHaveBeenCalled();
    });

  it('FM08 identity drift in the init stat bracket refuses', () => {
    const values = fixture.files.get(initPaths.stat)!;
    fixture.files.set(initPaths.stat, [
      values[0]!,
      values[1]!.replace('9501', '9502'),
      ...values.slice(2),
    ]);
    const result = runMetadataAudit();
    coded(result, 'AUDIT_IDENTITY_CHANGED');
    expect(result.frames).toHaveLength(0);
    expect(io.realpath).not.toHaveBeenCalled();
  });

  for (const [label, mutate] of [
    [
      'namespace',
      () => fixture.links.set(memberPaths.namespace, [NAMESPACE, 'pid:[999]']),
    ],
    [
      'cgroup parent',
      () => {
        const cgroups = fixture.files.get(memberPaths.cgroup)!;
        fixture.files.set(memberPaths.cgroup, [
          cgroups[0]!,
          `0::/other.slice/docker-${fixture.target.id}.scope\n`,
        ]);
      },
    ],
  ] as const)
    it(`FM09 ${label} identity drift refuses after preserving prior frames`, () => {
      mutate();
      const result = runMetadataAudit();
      coded(result, 'AUDIT_IDENTITY_CHANGED');
      expect(result.frames.length).toBeGreaterThan(0);
    });

  it('FM10 membership change reads final membership once and refuses', () => {
    fixture.files.set(PROCS_PATH, [
      `${INIT_PID}\n${MEMBER_PID}\n`,
      `${INIT_PID}\n`,
    ]);
    const result = runMetadataAudit();
    coded(result, 'AUDIT_MEMBERSHIP_CHANGED');
    expect(fileReads.get(PROCS_PATH)).toBe(2);
  });

  it('FM11 duplicate or 257-member cgroup lists hit the bounded limit before task reads', () => {
    fixture.files.set(PROCS_PATH, [
      `${INIT_PID}\n${MEMBER_PID}\n${MEMBER_PID}\n`,
    ]);
    coded(runMetadataAudit(), 'AUDIT_LIMIT');
    expect(openPaths()).not.toContain(memberPaths.stat);
    fixture = createFinalityFixture();
    handles = new Map();
    fileReads = new Map();
    linkReads = new Map();
    events = [];
    const members = [
      INIT_PID,
      ...Array.from({ length: 256 }, (_, index) => index + 1000),
    ];
    fixture.files.set(PROCS_PATH, [`${members.join('\n')}\n`]);
    coded(runMetadataAudit(), 'AUDIT_LIMIT');
    expect(openPaths()).not.toContain(memberPaths.stat);
  });

  it('FM12 file-byte overflow refuses and closes the target handle', () => {
    fixture.files.set(TARGET_PATH, ['x'.repeat(8_193)]);
    const result = runMetadataAudit();
    coded(result, 'AUDIT_LIMIT');
    expect(openPaths()).toEqual([TARGET_PATH]);
    expect(closePaths()).toEqual([TARGET_PATH]);
    expect(handles.size).toBe(0);
  });

  it('FM13 invalid UTF-8 target bytes refuse through the fatal decoder', () => {
    rawBytes.set(TARGET_PATH, Buffer.from([0xc3, 0x28]));
    closeErrors.set(TARGET_PATH, error('EIO'));
    const result = runMetadataAudit();
    coded(result, 'AUDIT_INVALID_TARGET');
    expect(result.failure?.secondaryCodes).toEqual(['EIO']);
    expect(openPaths()).toEqual([TARGET_PATH]);
    expect(closePaths()).toEqual([TARGET_PATH]);
    expect(io.close).toHaveBeenCalledTimes(1);
    expect(io.link).not.toHaveBeenCalled();
  });

  it('FM14 preserves close-only and primary-plus-close errors', () => {
    closeErrors.set(TARGET_PATH, error('EIO'));
    const closeOnly = runMetadataAudit();
    coded(closeOnly, 'EIO');
    expect(closeOnly.failure?.secondaryCodes).toEqual([]);
    fixture = createFinalityFixture();
    handles = new Map();
    fileReads = new Map();
    linkReads = new Map();
    openErrors = new Map();
    readErrors = new Map();
    closeErrors = new Map();
    events = [];
    readErrors.set(`/proc/${INIT_PID}/stat`, error('EACCES'));
    closeErrors.set(`/proc/${INIT_PID}/stat`, error('EIO'));
    const primary = runMetadataAudit();
    coded(primary, 'EACCES');
    expect(primary.failure?.secondaryCodes).toEqual(['EIO']);
  });
});
