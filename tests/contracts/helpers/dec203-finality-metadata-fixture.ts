export const TARGET_PATH =
  '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/.memory/pipeline/progress/verification/2026-10-22-native-finality-audit-target.json';
export const CGROUP_ROOT = '/sys/fs/cgroup';
export const CONTAINER_ID = 'a'.repeat(64);
export const IMAGE_ID = `sha256:${'b'.repeat(64)}`;
export const CGROUP_PATH = `/system.slice/docker-${CONTAINER_ID}.scope`;
export const GROUP_RECORD = `0::${CGROUP_PATH}`;
export const GROUP_PATH = `${CGROUP_ROOT}${CGROUP_PATH}`;
export const PROCS_PATH = `${GROUP_PATH}/cgroup.procs`;
export const INIT_PID = 501;
export const MEMBER_PID = 502;
export const NAMESPACE = 'pid:[4026531836]';

export type Target = {
  container: string;
  project: string;
  database: string;
  daemon: string;
  id: string;
  imageId: string;
  initPid: number;
};
export type Identity = {
  ppid: number;
  group: number;
  session: number;
  startTime: string;
  uid: number;
  nspid: number;
  namespace: string;
};
export type FlatFrame = {
  round: 0 | 1;
  pid: number;
  ppid: number;
  group: number;
  session: number;
  startTime: string;
  uids: [number, number, number, number];
  nspid: number[];
  namespace: string;
  cgroup: string;
};
export type AuditResult = {
  kind: 'diagnostic-only-native-finality-metadata';
  state: 'complete' | 'refused';
  target: Target | null;
  members: number[];
  frames: FlatFrame[];
  failure: {
    code: string;
    stage: string;
    secondaryCodes: string[];
  } | null;
};
export type FinalityFixture = {
  targetPath: string;
  target: Target;
  files: Map<string, string[]>;
  links: Map<string, string[]>;
  realpaths: Map<string, string>;
  expectedOpenPaths: string[];
};

export const TARGET: Target = Object.freeze({
  container: 'supabase_db_wejammin_ev',
  project: 'wejammin_ev',
  database: 'postgres',
  daemon: 'unix:///run/docker.sock',
  id: CONTAINER_ID,
  imageId: IMAGE_ID,
  initPid: INIT_PID,
});

const identity = (pid: number): Identity => ({
  ppid: pid === INIT_PID ? 1 : INIT_PID,
  group: INIT_PID,
  session: INIT_PID,
  startTime: String(9000 + pid),
  uid: 1000,
  nspid: pid,
  namespace: NAMESPACE,
});

const stat = (pid: number, value = identity(pid)): string => {
  const fields = [
    'S',
    String(value.ppid),
    String(value.group),
    String(value.session),
    ...Array<string>(15).fill('0'),
    value.startTime,
  ];
  return `${pid} (finality fixture) ${fields.join(' ')}`;
};

const status = (pid: number, value = identity(pid)): string =>
  [
    'Name:\tfinality-fixture',
    'State:\tS (sleeping)',
    `Pid:\t${pid}`,
    `PPid:\t${value.ppid}`,
    `Uid:\t${value.uid}\t${value.uid}\t${value.uid}\t${value.uid}`,
    `NSpid:\t${value.nspid}`,
  ].join('\n') + '\n';

const taskPaths = (pid: number) => ({
  stat: `/proc/${pid}/stat`,
  status: `/proc/${pid}/status`,
  cgroup: `/proc/${pid}/cgroup`,
  namespace: `/proc/${pid}/ns/pid`,
});

export function createFinalityFixture(): FinalityFixture {
  const init = taskPaths(INIT_PID);
  const member = taskPaths(MEMBER_PID);
  const files = new Map<string, string[]>([
    [TARGET_PATH, [JSON.stringify(TARGET)]],
    [init.stat, Array.from({ length: 4 }, () => stat(INIT_PID))],
    [init.status, Array.from({ length: 2 }, () => status(INIT_PID))],
    [init.cgroup, Array.from({ length: 2 }, () => `${GROUP_RECORD}\n`)],
    [member.stat, Array.from({ length: 4 }, () => stat(MEMBER_PID))],
    [member.status, Array.from({ length: 2 }, () => status(MEMBER_PID))],
    [member.cgroup, Array.from({ length: 2 }, () => `${GROUP_RECORD}\n`)],
    [
      PROCS_PATH,
      [`${INIT_PID}\n${MEMBER_PID}\n`, `${INIT_PID}\n${MEMBER_PID}\n`],
    ],
  ]);
  const links = new Map<string, string[]>([
    [init.namespace, [NAMESPACE, NAMESPACE]],
    [member.namespace, [NAMESPACE, NAMESPACE]],
  ]);
  const realpaths = new Map([
    [CGROUP_ROOT, CGROUP_ROOT],
    [GROUP_PATH, GROUP_PATH],
    [PROCS_PATH, PROCS_PATH],
  ]);
  const expectedOpenPaths = [
    TARGET_PATH,
    init.stat,
    init.status,
    init.cgroup,
    init.stat,
    PROCS_PATH,
    member.stat,
    member.status,
    member.cgroup,
    member.stat,
    init.stat,
    init.status,
    init.cgroup,
    init.stat,
    member.stat,
    member.status,
    member.cgroup,
    member.stat,
    PROCS_PATH,
  ];
  return {
    targetPath: TARGET_PATH,
    target: { ...TARGET },
    files,
    links,
    realpaths,
    expectedOpenPaths,
  };
}

export const frame = (round: 0 | 1, pid: number): FlatFrame => {
  const value = identity(pid);
  return {
    round,
    pid,
    ppid: value.ppid,
    group: value.group,
    session: value.session,
    startTime: value.startTime,
    uids: [value.uid, value.uid, value.uid, value.uid],
    nspid: [value.nspid],
    namespace: value.namespace,
    cgroup: CGROUP_PATH,
  };
};

export const completeResult = (): AuditResult => ({
  kind: 'diagnostic-only-native-finality-metadata',
  state: 'complete',
  target: { ...TARGET },
  members: [INIT_PID, MEMBER_PID],
  frames: [
    frame(0, INIT_PID),
    frame(0, MEMBER_PID),
    frame(1, INIT_PID),
    frame(1, MEMBER_PID),
  ],
  failure: null,
});
