import { expect, type Mock } from 'vitest';

export type Stat = Record<
  'dev' | 'ino' | 'mode' | 'uid' | 'gid' | 'size' | 'mtimeNs' | 'ctimeNs',
  bigint
>;
export type Facts = {
  pid: number;
  ppid: number;
  startTime: string;
  uid: number;
  namespace: string;
};
export type Row = { target: string; stat: Stat; info: string };
type MockIo = {
  lstat: Mock<(path: string) => { uid: bigint }>;
  names: Mock<(path: string) => string[]>;
  link: Mock<(path: string) => string>;
  stat: Mock<(path: string) => Stat>;
  text: Mock<(path: string, limit?: number) => string>;
};

export const root = '/tmp/dec203-bootstrap-Ab12Cd';
const image = '/unit/node';
const process = { pid: 501, ppid: 500, startTime: '9001', uid: 1000 };
export const observed = {
  process: { ...process, executable: { path: image } },
  namespace: 'pid:[700]',
};
export const lock = '1: FLOCK ADVISORY WRITE 501 00:01:33 0 EOF';
export const stat = (ino: bigint, mode = 0o100644n): Stat => ({
  dev: 1n,
  ino,
  mode,
  uid: 1000n,
  gid: 1000n,
  size: 0n,
  mtimeNs: 1n,
  ctimeNs: 1n,
});
export const info = (ino: number) => `flags: 02000002\npos: 0\nino: ${ino}\n`;

export function schedule(io: MockIo) {
  const rows = new Map<number, Row>([
    [
      10,
      {
        target: 'anon_inode:[pidfd]',
        stat: stat(110n, 0o600n),
        info: info(110) + 'Pid: 501\nNSpid: 501\n',
      },
    ],
    [
      3,
      {
        target: '/tmp/wejammin-supabase-ci.lock',
        stat: stat(33n),
        info: info(33) + `lock: ${lock}\n`,
      },
    ],
    [0, { target: '/dev/null', stat: stat(10n, 0o020666n), info: info(10) }],
    [4, { target: 'pipe:[44]', stat: stat(44n, 0o010600n), info: info(44) }],
  ]);
  const plan = {
    rows,
    replaced: new Map<number, Partial<Row>>(),
    final: null as number[] | null,
    after: {} as Partial<Facts>,
    global: lock,
  };
  const links = new Map<string, number>();
  const stats = new Map<string, number>();
  let factReads = 0;
  const facts = () => ({
    ...process,
    namespace: observed.namespace,
    ...(factReads > 1 ? plan.after : {}),
  });
  const row = (path: string) => {
    const match = /^\/proc\/501\/(?:fd|fdinfo)\/(\d+)$/.exec(path);
    expect(match, 'only planned proc row paths').not.toBeNull();
    const fd = Number(match?.[1]);
    const value = rows.get(fd);
    expect(value, 'complete planned FD table').not.toBeUndefined();
    return { fd, value: value as Row };
  };
  io.names.mockImplementation((path) => {
    expect(path).toBe('/proc/501/fd');
    return (
      io.names.mock.calls.length > 1 && plan.final
        ? plan.final
        : [...rows.keys()]
    ).map(String);
  });
  io.lstat.mockImplementation((path) => {
    expect(path).toBe('/proc/501');
    return { uid: BigInt(facts().uid) };
  });
  io.link.mockImplementation((path) => {
    if (path === '/proc/501/exe') return image;
    if (path === '/proc/501/ns/pid') return facts().namespace;
    const { fd, value } = row(path);
    const count = (links.get(path) ?? 0) + 1;
    links.set(path, count);
    return count > 1
      ? (plan.replaced.get(fd)?.target ?? value.target)
      : value.target;
  });
  io.stat.mockImplementation((path) => {
    const { fd, value } = row(path);
    const count = (stats.get(path) ?? 0) + 1;
    stats.set(path, count);
    return count > 1 ? (plan.replaced.get(fd)?.stat ?? value.stat) : value.stat;
  });
  io.text.mockImplementation((path) => {
    if (path === '/proc/locks') return plan.global;
    if (path === '/proc/501/stat') {
      factReads += 1;
      const value = facts();
      const fields = [
        'S',
        String(value.ppid),
        '501',
        '501',
        ...Array<string>(15).fill('0'),
        value.startTime,
      ];
      return `${value.pid} (node fixture) ${fields.join(' ')}`;
    }
    return row(path).value.info;
  });
  return plan;
}
