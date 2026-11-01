import assert from 'node:assert/strict';

// Pure data fixture for the coordinator startup unit boundary: the expected
// createOwnerObserver contract from fixed literals plus the frozen profile. It
// reads no filesystem, /proc or process, runs no subject and returns fresh
// mutable records on every call.

import type {
  StartupCapture,
  StartupExecutable,
  StartupFdRow,
  StartupInventory,
  StartupLockRow,
  StartupNamedStat,
  StartupProcess,
} from './dec203-coordinator-startup-fixture-types';
export type {
  StartupCapture,
  StartupExecutable,
  StartupFdRow,
  StartupInventory,
  StartupLockRow,
  StartupNamedStat,
  StartupProcess,
  StartupPidfd,
} from './dec203-coordinator-startup-fixture-types';

// The frozen profile is inert configuration: load it by URL, treat the module
// as unknown and narrow only the fixed fields this fixture reproduces.
const profileUrl = new URL(
  '../../../infra/database-upgrades/native-tracing/receiving-bootstrap-profile.mjs',
  import.meta.url,
);
const loaded: unknown = await import(profileUrl.href);
assert.ok(
  loaded !== null && typeof loaded === 'object',
  'frozen profile module',
);
const profile = loaded as {
  NODE: string;
  COMPILER: string;
  COORDINATOR: string;
  LOCK_PATHS: readonly [string, string, string, string];
  LEASE_FLAGS: readonly string[];
  PHASES: { lease: { source: string; directory: string } };
};
assert.ok(
  typeof profile.NODE === 'string' &&
    typeof profile.COMPILER === 'string' &&
    typeof profile.COORDINATOR === 'string' &&
    Array.isArray(profile.LOCK_PATHS) &&
    profile.LOCK_PATHS.length === 4 &&
    profile.LOCK_PATHS.every((value) => typeof value === 'string') &&
    Array.isArray(profile.LEASE_FLAGS) &&
    profile.LEASE_FLAGS.length > 0 &&
    profile.LEASE_FLAGS.every((value) => typeof value === 'string') &&
    typeof profile.PHASES?.lease?.source === 'string' &&
    typeof profile.PHASES?.lease?.directory === 'string',
  'frozen profile configuration',
);
const { NODE, COMPILER, COORDINATOR, LOCK_PATHS, LEASE_FLAGS } = profile;
const PHASES = profile.PHASES;

const ROOT = '/tmp/dec203-startup-Ab12Cd';
const ID = '018f0c45-73fe-4dc2-9c09-68f7ecf132da';
const NAMESPACE = 'pid:[4026532001]';
const DEVICE = '1';
const UID = 1000;
const OWNER_PID = 501;
const COORDINATOR_PID = 502;
const COMPILER_PID = 503;
const OWNER_IMAGE = ROOT + '/owner/receiving-lease-owner';
const LEASE_IMAGE = ROOT + '/lease/receiving-lease.node';
const LEASE_DIRECTORY = ROOT + '/' + PHASES.lease.directory;

const executable = (
  path: string,
  inode: string,
  size: number,
  mode: number,
  uid: number,
): StartupExecutable => ({
  path,
  sha256: inode.repeat(32).slice(0, 64),
  device: DEVICE,
  inode,
  size,
  mode,
  uid,
});
const nodeTemplate = executable(NODE, '11', 124835376, 0o100755, UID);
const gccTemplate = executable(COMPILER, '12', 2455168, 0o100755, 0);
const ownerTemplate = executable(OWNER_IMAGE, '13', 4096, 0o100700, UID);

const proc = (
  pid: number,
  ppid: number,
  session: number,
  startTime: string,
  image: StartupExecutable,
): StartupProcess => ({
  pid,
  ppid,
  startTime,
  session,
  uid: UID,
  executable: image,
});

const fdRow = (
  fd: number,
  target: string,
  inode: string,
  mode: number,
  flags: string,
  owner = UID,
): StartupFdRow => ({
  fd,
  target,
  device: DEVICE,
  inode,
  mode,
  uid: owner,
  gid: owner,
  flags,
  pos: '0',
  pidfd: null,
});
const pidfdRow = (fd: number, inode: string, pid: number): StartupFdRow => ({
  ...fdRow(fd, 'anon_inode:[pidfd]', inode, 0o700, '02000000'),
  pidfd: { pid, nspid: [pid] },
});
const lockRow = (
  fd: number,
  inode: string,
  mode: 'READ' | 'WRITE',
): StartupLockRow => ({
  fd,
  ownerPid: OWNER_PID,
  mode,
  device: DEVICE,
  inode,
  start: '0',
  end: 'EOF',
});

const capture = (
  process_: StartupProcess,
  argv: string[],
  cwd: string,
  group: number,
): StartupCapture => ({
  process: process_,
  argv,
  cwd,
  group,
  namespace: NAMESPACE,
});
const inventory = (
  process_: StartupProcess,
  fds: StartupFdRow[],
  locks: StartupLockRow[],
): StartupInventory => ({ process: process_, fds, locks });

const sharedFds = (): StartupFdRow[] => [
  fdRow(0, '/dev/null', '10', 0o020666, '0', 0),
  fdRow(1, 'pipe:[801]', '801', 0o010600, '02000001'),
  fdRow(2, 'pipe:[802]', '802', 0o010600, '02000001'),
  fdRow(3, LOCK_PATHS[0], '103', 0o100644, '02000001'),
  fdRow(4, LOCK_PATHS[1], '104', 0o100644, '02000000'),
  fdRow(5, LOCK_PATHS[2], '105', 0o100644, '02000001'),
  fdRow(6, LOCK_PATHS[3], '106', 0o100644, '02000001'),
];
const ownerFds = (driverPid: number): StartupFdRow[] => [
  ...sharedFds(),
  pidfdRow(7, '707', OWNER_PID),
  fdRow(8, 'pipe:[808]', '808', 0o010600, '02000000'),
  fdRow(9, 'pipe:[809]', '809', 0o010600, '02000001'),
  pidfdRow(10, '710', driverPid),
  fdRow(12, 'pipe:[909]', '909', 0o010600, '02000000'),
  fdRow(13, 'pipe:[908]', '908', 0o010600, '02000001'),
];
const coordinatorFds = (driverPid: number): StartupFdRow[] => [
  ...sharedFds(),
  pidfdRow(7, '707', OWNER_PID),
  fdRow(8, 'pipe:[908]', '908', 0o010600, '02000000'),
  fdRow(9, 'pipe:[909]', '909', 0o010600, '02000001'),
  pidfdRow(10, '710', driverPid),
];
const compilerFds = (): StartupFdRow[] => [
  fdRow(0, '/dev/null', '60', 0o020666, '0', 0),
  fdRow(1, 'pipe:[811]', '811', 0o010600, '02000001'),
  fdRow(2, 'pipe:[812]', '812', 0o010600, '02000001'),
];
const locks = (): StartupLockRow[] =>
  [3, 4, 5, 6].map((fd, index) =>
    lockRow(fd, String(103 + index), fd === 4 ? 'READ' : 'WRITE'),
  );

const namedStat = (ino: bigint): StartupNamedStat => ({
  dev: 1n,
  ino,
  mode: 0o100644n,
  uid: 1000n,
  gid: 1000n,
  size: 0n,
  mtimeNs: 1n,
  ctimeNs: 1n,
});
const named = (): Map<string, StartupNamedStat> =>
  new Map(
    LOCK_PATHS.map((path, index) => [path, namedStat(BigInt(103 + index))]),
  );

export function createCoordinatorStartupFixture(driverPid: number) {
  assert.ok(Number.isSafeInteger(driverPid) && driverPid > 0, 'driver pid');
  const nodeImage = { ...nodeTemplate };
  const gccImage = { ...gccTemplate };
  const ownerImage = { ...ownerTemplate };
  const owner = proc(OWNER_PID, driverPid, driverPid, '9001', ownerImage);
  const coordinator = proc(
    COORDINATOR_PID,
    OWNER_PID,
    driverPid,
    '9002',
    nodeImage,
  );
  const compiler = proc(
    COMPILER_PID,
    COORDINATOR_PID,
    COMPILER_PID,
    '9003',
    gccImage,
  );
  return {
    root: ROOT,
    id: ID,
    namespace: NAMESPACE,
    info: { root: ROOT, inputs: [nodeImage, gccImage] },
    output: ownerImage,
    child: { pid: OWNER_PID },
    captures: {
      owner: capture(owner, [OWNER_IMAGE, ID], ROOT, driverPid),
      coordinator: capture(
        coordinator,
        [NODE, '--', COORDINATOR, ID],
        ROOT,
        driverPid,
      ),
      compiler: capture(
        compiler,
        [COMPILER, ...LEASE_FLAGS, PHASES.lease.source, '-o', LEASE_IMAGE],
        LEASE_DIRECTORY,
        COMPILER_PID,
      ),
    },
    inventories: {
      owner: inventory(owner, ownerFds(driverPid), locks()),
      coordinator: inventory(coordinator, coordinatorFds(driverPid), locks()),
      compiler: inventory(compiler, compilerFds(), []),
    },
    named: named(),
  };
}

export type CoordinatorStartupFixture = ReturnType<
  typeof createCoordinatorStartupFixture
>;

export function row(
  inventoryValue: StartupInventory,
  fd: number,
): StartupFdRow {
  const matches = inventoryValue.fds.filter((value) => value.fd === fd);
  assert.ok(matches.length === 1, 'one fixture FD row');
  return matches[0] as StartupFdRow;
}
