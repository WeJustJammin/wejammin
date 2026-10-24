// Shared type-only module for the coordinator startup fixture: no imports,
// no runtime and no subject. Exported only so the fixture can re-export it.

export type StartupExecutable = {
  path: string;
  sha256: string;
  device: string;
  inode: string;
  size: number;
  mode: number;
  uid: number;
};

export type StartupProcess = {
  pid: number;
  ppid: number;
  startTime: string;
  session: number;
  uid: number;
  executable: StartupExecutable;
};

export type StartupPidfd = { pid: number; nspid: number[] };

export type StartupFdRow = {
  fd: number;
  target: string;
  device: string;
  inode: string;
  mode: number;
  uid: number;
  gid: number;
  flags: string;
  pos: string;
  pidfd: StartupPidfd | null;
};

export type StartupLockRow = {
  fd: number;
  ownerPid: number;
  mode: 'READ' | 'WRITE';
  device: string;
  inode: string;
  start: '0';
  end: 'EOF';
};

export type StartupCapture = {
  process: StartupProcess;
  argv: string[];
  cwd: string;
  group: number;
  namespace: string;
};

export type StartupInventory = {
  process: StartupProcess;
  fds: StartupFdRow[];
  locks: StartupLockRow[];
};

export type StartupNamedStat = {
  dev: bigint;
  ino: bigint;
  mode: bigint;
  uid: bigint;
  gid: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
};
