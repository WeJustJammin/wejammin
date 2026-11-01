export const REPOSITORY = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
export const DIRECTORY = `${REPOSITORY}/infra/database-upgrades/native-tracing`;
export const NODE =
  '/home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node';
export const COMPILER = '/usr/bin/gcc';
export const INCLUDE_DIRECTORY = '/usr/include/node';
export const LAUNCHER = `${DIRECTORY}/receiving-native-launch.mjs`;
export const COORDINATOR = `${DIRECTORY}/receiving-native-coordinator.mjs`;
export const INPUT = 'DEC203_PRE_READY_CLOSE_V1\n';
export const UID = 1000;
export const VERSION = 'v22.23.1';
export const CONSTRUCTION_MILLISECONDS = 90_000;
export const SETTLEMENT_MILLISECONDS = 5_000;
export const NATIVE_FRAME_BYTES = 4096;
export const DIAGNOSTIC_RECORD_BYTES = 65_536;
export const DIAGNOSTIC_RECORD_COUNT = 256;
export const DIAGNOSTIC_TOTAL_BYTES = 1_048_576;
export const ENVIRONMENT = Object.freeze({
  PATH: '/usr/bin:/bin',
  LANG: 'C',
  LC_ALL: 'C',
  TZ: 'UTC',
});

export const SOURCE_NAMES = Object.freeze([
  'receiving-bootstrap-profile.mjs',
  'receiving-bootstrap-profile.h',
  'receiving-bootstrap-resources.mjs',
  'receiving-bootstrap-build.mjs',
  'receiving-bootstrap-compiler.mjs',
  'receiving-bootstrap-artifacts.mjs',
  'receiving-bootstrap-processes.mjs',
  'receiving-bootstrap-workspaces.mjs',
  'receiving-bootstrap-files.mjs',
  'receiving-bootstrap-protocol.mjs',
  'receiving-bootstrap-diagnostic-values.mjs',
  'receiving-bootstrap-diagnostics.mjs',
  'receiving-bootstrap-observe.mjs',
  'receiving-bootstrap-owner.mjs',
  'receiving-native-launch.mjs',
  'receiving-lease.mjs',
  'receiving-native-bootstrap.mjs',
  'receiving-native-coordinator.mjs',
  'receiving-lease-owner.c',
  'receiving-lease.c',
  'receiving-bootstrap-json.h',
  'receiving-bootstrap-frame-values.h',
  'receiving-bootstrap-frame.h',
  'receiving-bootstrap-wire.h',
  'receiving-bootstrap-sha256.h',
  'receiving-bootstrap-process.h',
  'receiving-bootstrap-entry.h',
  'receiving-bootstrap-locks.h',
  'receiving-lease-owner-state.h',
  'receiving-lease-owner-ledger.h',
  'receiving-lease-state.h',
  'receiving-lease-reader.h',
]);

export const HEADERS = Object.freeze(
  [
    'js_native_api.h',
    'js_native_api_types.h',
    'node_api.h',
    'node_api_types.h',
  ].map((name) => `${INCLUDE_DIRECTORY}/${name}`),
);

export const PROFILE = Object.freeze(
  [
    {
      path: NODE,
      sha256:
        '93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068',
      size: 124835376,
      uid: 1000,
      mode: 0o100755,
    },
    {
      path: COMPILER,
      sha256:
        '4063c2a4919a7531523a61397052b6582386df1cbe0e558c3ffb045c0717d3bc',
      size: 2455168,
      uid: 0,
      mode: 0o100755,
    },
    {
      path: HEADERS[0],
      sha256:
        '82d3708ce120f8000ec34d72e1aa70b0d7d8a43027986293681374a71b2cb840',
      size: 33170,
      uid: 0,
      mode: 0o100644,
    },
    {
      path: HEADERS[1],
      sha256:
        'c12406a8c0036aefdb66b98065fc88e2e7a053c1f274deef33af6c26c099b933',
      size: 8335,
      uid: 0,
      mode: 0o100644,
    },
    {
      path: HEADERS[2],
      sha256:
        '2d4560831e525b47b060ec8a0864ab73993df9e20215ce9f0fe7b24cd31af32a',
      size: 10370,
      uid: 0,
      mode: 0o100644,
    },
    {
      path: HEADERS[3],
      sha256:
        'a25356630d3058f0a0c8937d9f297e9471e037fda58c2696d8a505c2bd99cb00',
      size: 1930,
      uid: 0,
      mode: 0o100644,
    },
  ].map((record) => Object.freeze(record)),
);

export const LOCK_PATHS = Object.freeze([
  '/tmp/wejammin-supabase-ci.lock',
  '/tmp/wejammin-quiet.lock',
  '/tmp/wejammin-altdb.lock',
  '/tmp/wejammin-reset.lock',
]);

export const OWNER_FLAGS = Object.freeze([
  '-std=c11',
  '-O2',
  '-Wall',
  '-Wextra',
  '-Werror',
  '-D_GNU_SOURCE',
]);
export const LEASE_FLAGS = Object.freeze([
  '-std=c11',
  '-O2',
  '-fPIC',
  '-shared',
  '-pthread',
  '-DNAPI_VERSION=8',
  '-Wall',
  '-Wextra',
  '-Werror',
  '-I',
  INCLUDE_DIRECTORY,
]);

export const PHASES = Object.freeze({
  owner: Object.freeze({
    source: `${DIRECTORY}/receiving-lease-owner.c`,
    directory: 'owner',
    basename: 'receiving-lease-owner',
    flags: OWNER_FLAGS,
    support: Object.freeze([
      'receiving-bootstrap-profile.h',
      'receiving-bootstrap-json.h',
      'receiving-bootstrap-frame-values.h',
      'receiving-bootstrap-frame.h',
      'receiving-bootstrap-wire.h',
      'receiving-bootstrap-sha256.h',
      'receiving-bootstrap-process.h',
      'receiving-bootstrap-entry.h',
      'receiving-bootstrap-locks.h',
      'receiving-lease-owner-state.h',
      'receiving-lease-owner-ledger.h',
    ]),
  }),
  lease: Object.freeze({
    source: `${DIRECTORY}/receiving-lease.c`,
    directory: 'lease',
    basename: 'receiving-lease.node',
    flags: LEASE_FLAGS,
    support: Object.freeze([
      'receiving-bootstrap-profile.h',
      'receiving-bootstrap-json.h',
      'receiving-bootstrap-frame-values.h',
      'receiving-bootstrap-frame.h',
      'receiving-bootstrap-wire.h',
      'receiving-bootstrap-sha256.h',
      'receiving-bootstrap-process.h',
      'receiving-bootstrap-entry.h',
      'receiving-bootstrap-locks.h',
      'receiving-lease-state.h',
      'receiving-lease-reader.h',
    ]),
  }),
});

export const ERRORS = Object.freeze(
  [
    'REFUSED',
    'IDENTITY_CHANGED',
    'UNAVAILABLE',
    'PROTOCOL',
    'HISTORY_GAP',
    'CANCELLED',
    'TIMEOUT',
    'FAILED',
    'DRAIN_UNCERTAIN',
  ].map((suffix) => `DEC203_SUPERVISOR_${suffix}`),
);
