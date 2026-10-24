import assert from 'node:assert/strict';

// Fictional unit identities only: no host observation, ownership or authority.
export const clonePayload = (value) => structuredClone(value);
export const different = (value) =>
  typeof value === 'string' ? value + '9' : value + 1;
export const statLiteral =
  '503 (gcc worker (phase)) S 502 503 503 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 5030 0 0\n';

function freeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function image(path, inode, mode, uid = 1000) {
  return {
    path,
    sha256: 'a'.repeat(64),
    device: '1',
    inode,
    size: 32,
    mode,
    uid,
  };
}

const nodeImage = image('/unit/node', '801', 0o100755);
const gccImage = image('/unit/gcc', '802', 0o100755, 0);
const sourceImage = image('/unit/source.c', '901', 0o100644);
const ownerImage = image(
  '/unit/run/owner/receiving-lease-owner',
  '803',
  0o100700,
);

function processValue(pid, ppid, session, executable) {
  return { pid, ppid, startTime: `${pid}0`, session, uid: 1000, executable };
}

function row(
  fd,
  target,
  inode,
  mode = 0o100644,
  flags = '02000002',
  pidfd = null,
) {
  return {
    fd,
    target,
    device: '1',
    inode,
    mode,
    uid: target === '/dev/null' ? 0 : 1000,
    gid: target === '/dev/null' ? 0 : 1000,
    flags,
    pos: '0',
    pidfd,
  };
}

function flock(fd, mode, inode) {
  return {
    fd,
    ownerPid: 501,
    mode,
    device: '1',
    inode,
    start: '0',
    end: 'EOF',
  };
}

export const inventoryPhases = freeze([
  'owner-leased',
  'coordinator-precompile',
  'lease-compiler-live',
  'coordinator-adopted',
]);

const expectedLocks = [
  flock(3, 'WRITE', '103'),
  flock(4, 'READ', '104'),
  flock(5, 'WRITE', '105'),
  flock(6, 'WRITE', '106'),
];
const expectedOwner = [
  row(3, '/tmp/wejammin-supabase-ci.lock', '103'),
  row(4, '/tmp/wejammin-quiet.lock', '104'),
  row(5, '/tmp/wejammin-altdb.lock', '105'),
  row(6, '/tmp/wejammin-reset.lock', '106'),
  row(7, 'anon_inode:[pidfd]', '707', 0o700, '02000002', {
    pid: 501,
    nspid: [501],
  }),
  row(8, 'socket:[808]', '808', 0o140777, '02004002'),
  row(9, 'socket:[809]', '809', 0o140777, '02004002'),
  row(10, 'anon_inode:[pidfd]', '710', 0o700, '02000002', {
    pid: 500,
    nspid: [500],
  }),
];
const expectedCoordinator = [
  ...expectedOwner.slice(0, 5),
  row(8, 'pipe:[908]', '908', 0o010600, '02004000'),
  row(9, 'pipe:[909]', '909', 0o010600, '02004001'),
  expectedOwner[7],
];
const expectedGcc = [
  row(0, '/dev/null', '5', 0o020666, '0100002'),
  row(1, 'pipe:[811]', '811', 0o010600, '04001'),
  row(2, 'pipe:[812]', '812', 0o010600, '04001'),
];
const expectedDirectories = [
  row(21, '/unit/run', '921', 0o040700, '02000000'),
  row(22, '/unit/run/owner', '922', 0o040700, '02000000'),
  row(23, '/unit/run/lease', '923', 0o040700, '02000000'),
];
const forbiddenObjects = [
  '1:103',
  '1:104',
  '1:105',
  '1:106',
  '1:707',
  '1:710',
  '1:808',
  '1:809',
  '1:908',
  '1:909',
];
const processes = {
  owner: processValue(501, 500, 500, ownerImage),
  coordinator: processValue(502, 501, 500, nodeImage),
  compiler: processValue(503, 502, 503, gccImage),
};
const anchors = freeze(
  Object.fromEntries(
    inventoryPhases.map((phase) => {
      const compiler = phase === 'lease-compiler-live';
      const owner = phase === 'owner-leased';
      return [
        phase,
        {
          phase,
          process:
            processes[compiler ? 'compiler' : owner ? 'owner' : 'coordinator'],
          root: '/unit/run',
          requiredFds: compiler
            ? expectedGcc
            : owner
              ? expectedOwner
              : expectedCoordinator,
          locks: compiler ? [] : expectedLocks,
          forbiddenObjects,
          artifacts: [nodeImage, gccImage, sourceImage, ownerImage],
          directories: expectedDirectories,
        },
      ];
    }),
  ),
);

// Payload rows are separately declared; expected anchors never read a payload.
function payloadRows(phase) {
  if (phase === 'lease-compiler-live')
    return [
      row(0, '/dev/null', '5', 0o020666, '0100002'),
      row(1, 'pipe:[811]', '811', 0o010600, '04001'),
      row(2, 'pipe:[812]', '812', 0o010600, '04001'),
    ];
  const owner = phase === 'owner-leased';
  return [
    row(3, '/tmp/wejammin-supabase-ci.lock', '103'),
    row(4, '/tmp/wejammin-quiet.lock', '104'),
    row(5, '/tmp/wejammin-altdb.lock', '105'),
    row(6, '/tmp/wejammin-reset.lock', '106'),
    row(7, 'anon_inode:[pidfd]', '707', 0o700, '02000002', {
      pid: 501,
      nspid: [501],
    }),
    owner
      ? row(8, 'socket:[808]', '808', 0o140777, '02004002')
      : row(8, 'pipe:[908]', '908', 0o010600, '02004000'),
    owner
      ? row(9, 'socket:[809]', '809', 0o140777, '02004002')
      : row(9, 'pipe:[909]', '909', 0o010600, '02004001'),
    row(10, 'anon_inode:[pidfd]', '710', 0o700, '02000002', {
      pid: 500,
      nspid: [500],
    }),
  ];
}

export function inventoryFixture(phase) {
  assert.ok(inventoryPhases.includes(phase), 'closed unit phase');
  const compiler = phase === 'lease-compiler-live';
  const owner = phase === 'owner-leased';
  const anchor = anchors[phase];
  const payload = {
    phase,
    process: clonePayload(
      processValue(
        compiler ? 503 : owner ? 501 : 502,
        compiler ? 502 : owner ? 500 : 501,
        compiler ? 503 : 500,
        compiler ? gccImage : owner ? ownerImage : nodeImage,
      ),
    ),
    fds: [
      ...payloadRows(phase),
      row(20, '/unit/source.c', '901', 0o100644, '02000000'),
      row(21, '/unit/run', '921', 0o040700, '02000000'),
      row(22, '/unit/run/owner', '922', 0o040700, '02000000'),
      row(23, '/unit/run/lease', '923', 0o040700, '02000000'),
    ],
    locks: compiler
      ? []
      : [
          flock(3, 'WRITE', '103'),
          flock(4, 'READ', '104'),
          flock(5, 'WRITE', '105'),
          flock(6, 'WRITE', '106'),
        ],
  };
  const numbers = new Set(anchor.requiredFds.map((value) => value.fd));
  assert.deepEqual(
    [...numbers],
    compiler ? [0, 1, 2] : [3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(anchor.locks.length, compiler ? 0 : 4);
  assert.deepEqual(payload.process, anchor.process);
  assert.deepEqual(payload.locks, anchor.locks);
  assert.deepEqual(
    payload.fds.filter((value) => numbers.has(value.fd)),
    anchor.requiredFds,
  );
  assert.deepEqual(
    payload.fds.filter((value) => [21, 22, 23].includes(value.fd)),
    anchor.directories,
  );
  assert.notEqual(payload.process, anchor.process);
  assert.notEqual(payload.fds[0], anchor.requiredFds[0]);
  assert.ok(Object.isFrozen(anchor) && Object.isFrozen(anchor.requiredFds[0]));
  assert.equal(
    new Set(anchor.requiredFds.map((value) => `${value.device}:${value.inode}`))
      .size,
    numbers.size,
  );
  return Object.freeze({ payload: freeze(payload), anchor });
}

export function crossedBindings() {
  const fd = (value, number) => {
    const found = value.fds.find((entry) => entry.fd === number);
    assert.ok(found, `actual FD${number} premise missing`);
    return found;
  };
  return [
    (value) => {
      fd(value, 7).pidfd = { pid: 500, nspid: [500] };
    },
    (value) => {
      fd(value, 10).pidfd = { pid: 501, nspid: [501] };
    },
    (value) => {
      const left = clonePayload(fd(value, 8));
      const right = clonePayload(fd(value, 9));
      Object.assign(fd(value, 8), right, { fd: 8 });
      Object.assign(fd(value, 9), left, { fd: 9 });
    },
  ];
}

export function namedMutations() {
  return [20, 21, 22, 23].flatMap((number) => [
    (value) => {
      const entry = value.fds.find((candidate) => candidate.fd === number);
      assert.ok(entry, 'literal named-FD mutation premise');
      entry.target = number === 20 ? '/unit/unknown.c' : '/unit/run-trap';
    },
    ...['device', 'inode', 'mode', 'uid']
      .concat(number === 20 ? [] : ['gid'])
      .map((key) => (value) => {
        const entry = value.fds.find((candidate) => candidate.fd === number);
        assert.ok(entry, 'literal named-FD mutation premise');
        entry[key] = different(entry[key]);
      }),
  ]);
}
