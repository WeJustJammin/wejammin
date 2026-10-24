import assert from 'node:assert/strict';
import { join } from 'node:path';

// Independent decision boundary for the coordinator's sealed lease output. The
// caller has already proved the lease compiler and session absent, so this helper
// decides only whether the output FD is sealed, binds it once and reports the
// result. It reads no filesystem, /proc, secret or domain state: the caller passes
// the FD rows it observed and the artifact boundary it captures through. A false
// result means "not sealed yet, capture nothing", never "absent" or "missing".

const OWNER = 1000;
const STAMP_MODE = 0o100600;
// Literal, independent allowlist of compiled lease output modes: a regular file
// owned by the single principal, owner-only rwx through 0711.
const COMPILED_MODES = new Set([
  0o100600, 0o100601, 0o100610, 0o100611, 0o100700, 0o100701, 0o100710,
  0o100711,
]);
const DECIMAL = /^(0|[1-9][0-9]*)$/u;
const OCTAL = /^[0-7]+$/u;
const ACCESS = 3n;

const access = (flags) => BigInt(`0o${flags}`) & ACCESS;

// One observed FD row of the lease output: a regular compiled mode, owned by the
// single UID-1000 principal, with a decimal device/inode and octal flags whose
// access bits are read-only, write-only or read-write but never the reserved 3.
function validateRow(row) {
  assert.ok(
    typeof row.mode === 'number' && COMPILED_MODES.has(row.mode),
    'lease output compiled mode',
  );
  assert.ok(row.uid === OWNER && row.gid === OWNER, 'lease output owner');
  assert.ok(
    typeof row.device === 'string' && DECIMAL.test(row.device),
    'lease output device',
  );
  assert.ok(
    typeof row.inode === 'string' && DECIMAL.test(row.inode),
    'lease output inode',
  );
  assert.ok(
    typeof row.flags === 'string' && OCTAL.test(row.flags),
    'lease output flags',
  );
  const bits = access(row.flags);
  assert.ok(bits === 0n || bits === 1n || bits === 2n, 'lease output access');
}

export function captureSealedLeaseOutput(
  artifacts,
  inventory,
  alreadyCaptured,
) {
  const target = join(artifacts.root, 'lease/receiving-lease.node');
  const matched = inventory.fds.filter((row) => row.target === target);
  for (const row of matched) validateRow(row);
  // No matched row is an unknown state, not proof of absence: capture nothing.
  if (matched.length === 0) return false;
  const first = matched[0];
  for (const row of matched) {
    assert.ok(
      row.device === first.device && row.inode === first.inode,
      'lease output alias identity',
    );
  }
  // Sealed only when every alias is the read-only, exactly 0600 compiled output.
  const sealed = matched.every(
    (row) => access(row.flags) === 0n && row.mode === STAMP_MODE,
  );
  if (!sealed) {
    // An open writer or a transient mode defers before the first binding; after
    // one, the same output can no longer reseal differently, so it is a failure.
    assert.ok(!alreadyCaptured, 'lease output resealed after binding');
    return false;
  }
  const captured = artifacts.capture(target);
  assert.ok(captured?.path === target, 'bound artifact path');
  assert.ok(captured.mode === first.mode, 'bound artifact mode');
  assert.ok(captured.uid === first.uid, 'bound artifact uid');
  assert.ok(captured.device === first.device, 'bound artifact device');
  assert.ok(captured.inode === first.inode, 'bound artifact inode');
  return true;
}
