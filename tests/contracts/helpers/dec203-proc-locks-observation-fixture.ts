type ProcLocksIdentity = {
  dev: bigint;
  ino: bigint;
  mode: bigint;
  uid: bigint;
  gid: bigint;
};
type ProcLocksLstat = ProcLocksIdentity & {
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
};

export const procLocksIdentity: ProcLocksIdentity = Object.freeze({
  dev: 1n,
  ino: 10n,
  mode: 0o100444n,
  uid: 0n,
  gid: 0n,
});
export const procLocksIsFile = () => true;
export const procLocksIsSymbolicLink = () => false;
export const procLocksLstat: ProcLocksLstat = Object.freeze({
  ...procLocksIdentity,
  isFile: procLocksIsFile,
  isSymbolicLink: procLocksIsSymbolicLink,
});
export const procLocksNamedMutations = [
  ['device', (value: typeof procLocksLstat) => ({ ...value, dev: 9n })],
  ['inode', (value: typeof procLocksLstat) => ({ ...value, ino: 11n })],
  ['mode', (value: typeof procLocksLstat) => ({ ...value, mode: 0o100644n })],
  ['uid', (value: typeof procLocksLstat) => ({ ...value, uid: 1000n })],
  ['gid', (value: typeof procLocksLstat) => ({ ...value, gid: 1000n })],
  [
    'symlink',
    (value: typeof procLocksLstat) => ({
      ...value,
      isSymbolicLink: () => true,
    }),
  ],
  [
    'type',
    (value: typeof procLocksLstat) => ({ ...value, isFile: () => false }),
  ],
] as const;

export type SnapshotMetadataRow = {
  info: string;
  stat: {
    dev: bigint;
    ino: bigint;
    mode: bigint;
    uid: bigint;
    gid: bigint;
    size: bigint;
    mtimeNs: bigint;
    ctimeNs: bigint;
  };
};
export type ObserverMetadataRow = {
  flags: string;
  mode: number;
  uid?: number;
  gid?: number;
};

export function procLocksSnapshotRows(flags: string) {
  const common = {
    device: '1',
    uid: 1000,
    gid: 1000,
    pos: '0',
    pidfd: null,
  };
  return [
    {
      ...common,
      fd: 0,
      target: '/proc/locks',
      inode: '10',
      mode: 0o100444,
      uid: 0,
      gid: 0,
      flags,
    },
    {
      ...common,
      fd: 3,
      target: '/tmp/wejammin-supabase-ci.lock',
      inode: '33',
      mode: 0o100644,
      flags: '02000002',
    },
    {
      ...common,
      fd: 4,
      target: 'pipe:[44]',
      inode: '44',
      mode: 0o010600,
      flags: '02000002',
    },
    {
      ...common,
      fd: 10,
      target: 'anon_inode:[pidfd]',
      inode: '110',
      mode: 0o600,
      flags: '02000002',
      pidfd: { pid: 501, nspid: [501] },
    },
  ];
}
