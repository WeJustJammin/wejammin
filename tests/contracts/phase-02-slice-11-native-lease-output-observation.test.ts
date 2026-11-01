import { AssertionError } from 'node:assert';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

// Frozen behavioural contract for the observer-owned helper:
//   tests/native/helpers/dec203-bootstrap-pre-ready-lease-output.mjs
//   export function captureSealedLeaseOutput(artifacts, inventory, alreadyCaptured): boolean
// The caller has already proved the lease compiler and session absent; this
// helper decides only whether the lease output is sealed, binds it and reports
// the result. Pure unit boundary: literal FD and artifact metadata with a fake
// capture. No filesystem, /proc, runtime output, secret or domain acceptance.
//
// FD row metadata (DEC203 observer fd table): { target, device, inode, mode,
// uid, gid, flags } with a numeric full mode (e.g. 0o100600) and an octal flags
// string (e.g. '02000000'). Captured metadata (artifacts.capture result):
// { path, sha256, device, inode, size, mode, uid }.

const HELPER_FILE = 'dec203-bootstrap-pre-ready-lease-output.mjs';
const EXPORT_NAME = 'captureSealedLeaseOutput';

const ROOT = '/observer/dec203';
const TARGET = join(ROOT, 'lease/receiving-lease.node');
const DEVICE = '66306';
const INODE = '424242';
const OWNER = 1000;

// Independent literal full compiled modes (octal owner/group/other variants).
const COMPILED_MODES = [
  0o100600, 0o100601, 0o100610, 0o100611, 0o100700, 0o100701, 0o100710,
  0o100711,
] as const;

type FdRow = {
  target: string;
  device: string;
  inode: string;
  mode: number;
  uid: number;
  gid: number;
  flags: string;
};

type CapturedArtifact = {
  path: string;
  sha256: string;
  device: string;
  inode: string;
  size: number;
  mode: number;
  uid: number;
};

type Artifacts = { root: string; capture: (path: string) => CapturedArtifact };
type Inventory = { fds: FdRow[] };
type CaptureSealedLeaseOutput = (
  artifacts: Artifacts,
  inventory: Inventory,
  alreadyCaptured: boolean,
) => boolean;

const row = (overrides: Partial<FdRow> = {}): FdRow => ({
  target: TARGET,
  device: DEVICE,
  inode: INODE,
  mode: 0o100600,
  uid: OWNER,
  gid: OWNER,
  flags: '02000000',
  ...overrides,
});

const inventory = (...fds: FdRow[]): Inventory => ({ fds });

const artifact = (
  overrides: Partial<CapturedArtifact> = {},
): CapturedArtifact => ({
  path: TARGET,
  sha256: 'a'.repeat(64),
  device: DEVICE,
  inode: INODE,
  size: 32,
  mode: 0o100600,
  uid: OWNER,
  ...overrides,
});

type Boundary = { result?: Partial<CapturedArtifact>; error?: unknown };

const boundary = (options: Boundary = {}) => {
  const calls: string[] = [];
  const artifacts: Artifacts = {
    root: ROOT,
    capture: (path) => {
      calls.push(path);
      if ('error' in options) throw options.error;
      return artifact(options.result);
    },
  };
  return { artifacts, calls };
};

// Only the helper's own absence is tolerated: a present helper whose transitive
// import fails must still surface, and the export assertion below keeps absence
// an assertion failure rather than a passing negative control.
async function loadCapture(): Promise<CaptureSealedLeaseOutput> {
  const helperPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'native',
    'helpers',
    HELPER_FILE,
  );
  const url = pathToFileURL(helperPath).href;
  let namespace: unknown;
  try {
    namespace = await import(url);
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    const errorUrl = (error as { url?: unknown }).url;
    const helperAbsent =
      errorUrl === undefined ? !existsSync(helperPath) : errorUrl === url;
    if (code === 'ERR_MODULE_NOT_FOUND' && helperAbsent) {
      namespace = undefined;
    } else {
      throw error;
    }
  }
  const value = (namespace as Record<string, unknown> | undefined)?.[
    EXPORT_NAME
  ];
  expect(value, `actual helper export ${EXPORT_NAME}`).toBeTypeOf('function');
  return value as CaptureSealedLeaseOutput;
}

type Outcome = { value: boolean | undefined; error: unknown; calls: string[] };

async function run(
  inv: Inventory,
  options: { capture?: Boundary; alreadyCaptured?: boolean } = {},
): Promise<Outcome> {
  const capture = await loadCapture();
  const { artifacts, calls } = boundary(options.capture);
  try {
    const value = capture(artifacts, inv, options.alreadyCaptured ?? false);
    return { value, error: undefined, calls };
  } catch (error) {
    return { value: undefined, error, calls };
  }
}

// Guard refusals must be real node assertions, never an incidental TypeError.
const expectRefusal = (error: unknown): void => {
  expect(error, 'guarded refusal identity').toBeInstanceOf(AssertionError);
  expect((error as { code?: unknown }).code).toBe('ERR_ASSERTION');
};

const deny = async (inv: Inventory): Promise<void> => {
  const result = await run(inv);
  expect(result.value).toBe(false);
  expect(result.calls).toEqual([]);
};

const refuse = async (inv: Inventory): Promise<void> => {
  const result = await run(inv);
  expectRefusal(result.error);
  expect(result.calls).toEqual([]);
};

const bind = async (inv: Inventory): Promise<void> => {
  const result = await run(inv);
  expect(result.value).toBe(true);
  expect(result.calls).toEqual([TARGET]);
};

const invalidModes: readonly (readonly [string, number])[] = [
  ['directory', 0o040600],
  ['symlink', 0o120600],
  ['socket', 0o140600],
  ['other-read', 0o100604],
  ['group-read', 0o100640],
  ['other-write', 0o100602],
  ['group-write', 0o100620],
  ['setuid', 0o104600],
  ['bare-permissions', 0o600],
];

const invalidOwners: readonly (readonly [string, Partial<FdRow>])[] = [
  ['root-uid', { uid: 0 }],
  ['foreign-uid', { uid: 1001 }],
  ['root-gid', { gid: 0 }],
  ['unknown-gid', { gid: Number.NaN }],
];

const invalidFlags: readonly (readonly [string, string])[] = [
  ['non-octal-digit', '08'],
  ['non-octal-letter', '2x'],
  ['invalid-access-mode', '02000003'],
  ['empty', ''],
  ['hex-prefix', '0x10'],
];

const invalidStrings: readonly (readonly [string, Partial<FdRow>])[] = [
  ['empty-device', { device: '' }],
  ['empty-inode', { inode: '' }],
  ['nondigit-device', { device: '0x10' }],
  ['negative-device', { device: '-1' }],
  ['nondigit-inode', { inode: '4a' }],
  ['negative-inode', { inode: '-1' }],
];

const driftFields: readonly (readonly [string, Partial<CapturedArtifact>])[] = [
  ['path', { path: join(ROOT, 'lease/other.node') }],
  ['mode', { mode: 0o100700 }],
  ['uid', { uid: 0 }],
  ['device', { device: '1' }],
  ['inode', { inode: '1' }],
];

describe('DEC203 sealed lease output capture, pure unit boundary', () => {
  it('LO01 binds the sealed 0600 read-only FD and ignores a foreign target', async () => {
    const foreign = row({ target: join(ROOT, 'lease/other.node') });
    await bind(inventory(row(), foreign));
  });

  it('LO02 rejects a foreign-only set without capture', async () => {
    await deny(inventory(row({ target: join(ROOT, 'lease/other.node') })));
  });

  it('LO03 rejects an empty matched set without capture', async () => {
    await deny({ fds: [] });
  });

  for (const [label, mode] of invalidModes)
    it(`LO04 throws on invalid compiled mode ${label}`, async () => {
      await refuse(inventory(row({ mode })));
    });

  for (const [label, override] of invalidOwners)
    it(`LO05 throws on invalid ownership ${label}`, async () => {
      await refuse(inventory(row(override)));
    });

  for (const [label, flags] of invalidFlags)
    it(`LO06 throws on invalid octal flags ${label}`, async () => {
      await refuse(inventory(row({ flags })));
    });

  for (const [label, override] of invalidStrings)
    it(`LO07 throws on invalid identity string ${label}`, async () => {
      await refuse(inventory(row(override)));
    });

  it('LO08 throws on conflicting device or inode across aliases while pending', async () => {
    await refuse(inventory(row({ inode: '1' }), row({ inode: '2' })));
    await refuse(inventory(row({ device: '1' }), row({ device: '2' })));
    await refuse(
      inventory(row({ flags: '02000001', inode: '1' }), row({ inode: '2' })),
    );
  });

  it('LO09 defers while a WRONLY writer is open, even at 0600', async () => {
    await deny(inventory(row({ flags: '02000001' })));
  });

  it('LO10 defers while an RDWR writer is open, even at 0600', async () => {
    await deny(inventory(row({ flags: '02000002' })));
  });

  it('LO11 defers a same-mode 0600 writer beside a 0600 reader', async () => {
    await deny(
      inventory(row({ flags: '02000001' }), row({ flags: '02000000' })),
    );
  });

  it('LO12 defers a transient 0711 writer beside the temporary 0600 reader', async () => {
    await deny(
      inventory(
        row({ flags: '02000001', mode: 0o100711 }),
        row({ flags: '02000000', mode: 0o100600 }),
      ),
    );
  });

  it('LO13 validates rows before deferring to an open writer', async () => {
    await refuse(inventory(row({ flags: '02000001', uid: 0 })));
  });

  for (const mode of COMPILED_MODES)
    it(`LO14 gates ${mode.toString(8)} as a compiled read-only mode`, async () => {
      if (mode === 0o100600) await bind(inventory(row({ mode })));
      else await deny(inventory(row({ mode })));
    });

  it('LO15 defers read-only aliases that are not all 0600', async () => {
    await deny(inventory(row({ mode: 0o100600 }), row({ mode: 0o100700 })));
  });

  it('LO16 seals once a raw 0711 writer resolves to the normalized 0600 reader', async () => {
    await deny(inventory(row({ flags: '02000001', mode: 0o100711 })));
    await bind(inventory(row({ flags: '02000000', mode: 0o100600 })));
  });

  for (const [label, drift] of driftFields)
    it(`LO17 throws when captured ${label} drifts from the FD identity`, async () => {
      const result = await run(inventory(row()), {
        capture: { result: drift },
      });
      expectRefusal(result.error);
      expect(result.calls).toEqual([TARGET]);
    });

  it('LO18 throws after a binding when a writer appears', async () => {
    const result = await run(inventory(row({ flags: '02000001' })), {
      alreadyCaptured: true,
    });
    expectRefusal(result.error);
  });

  it('LO19 throws after a binding on a wrong read-only mode', async () => {
    const result = await run(inventory(row({ mode: 0o100700 })), {
      alreadyCaptured: true,
    });
    expectRefusal(result.error);
  });

  it('LO20 throws after a binding when the captured identity drifts', async () => {
    const result = await run(inventory(row()), {
      alreadyCaptured: true,
      capture: { result: { inode: '1' } },
    });
    expectRefusal(result.error);
  });

  it('LO21 propagates a capture drift unchanged after a binding', async () => {
    const drift = new AssertionError({ message: 'bound artifact drift' });
    const result = await run(inventory(row()), {
      alreadyCaptured: true,
      capture: { error: drift },
    });
    expect(result.error).toBe(drift);
  });
});
