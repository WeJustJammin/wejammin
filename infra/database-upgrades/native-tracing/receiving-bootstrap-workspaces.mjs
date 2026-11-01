import { join } from 'node:path';
import { assertInputs, ensure } from './receiving-bootstrap-artifacts.mjs';
import {
  assertFiles,
  closeFiles,
  fileInfo,
  initializeFiles,
  reserveLeaseFiles,
  reserveOwnerFiles,
  sealFiles,
} from './receiving-bootstrap-files.mjs';
import { PHASES } from './receiving-bootstrap-profile.mjs';

const records = new WeakMap();
const retained = new Set();
const attempted = new Set();

function state(key) {
  const value = records.get(key);
  ensure(value !== undefined, 'DEC203_SUPERVISOR_REFUSED');
  return value;
}

function reserve(phase) {
  ensure(!attempted.has(phase), 'DEC203_SUPERVISOR_REFUSED');
  attempted.add(phase);
  const key = Object.freeze({});
  const value = {
    phase,
    status: 'reserved',
    files: null,
    inputs: null,
    closeAttempted: false,
    closeFailed: false,
    closeError: undefined,
  };
  records.set(key, value);
  retained.add(value);
  value.files = phase === 'owner' ? reserveOwnerFiles() : reserveLeaseFiles();
  return key;
}

export function reserveOwnerWorkspace() {
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  return reserve('owner');
}

export function reserveLeaseWorkspace() {
  ensure(arguments.length === 0, 'DEC203_SUPERVISOR_REFUSED');
  return reserve('lease');
}

export function initializeWorkspace(key) {
  ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
  const value = state(key);
  ensure(value.status === 'reserved', 'DEC203_SUPERVISOR_REFUSED');
  value.status = 'initializing';
  initializeFiles(value.files);
  value.inputs = fileInfo(value.files).inputs;
  value.status = 'initialized';
}

export function workspaceInfo(key, phase) {
  ensure(arguments.length === 2, 'DEC203_SUPERVISOR_REFUSED');
  const value = state(key);
  ensure(
    value.phase === phase && ['initialized', 'sealed'].includes(value.status),
    'DEC203_SUPERVISOR_REFUSED',
  );
  const info = fileInfo(value.files);
  return Object.freeze({
    phase,
    root: info.root,
    inputs: value.inputs,
    run: Object.freeze({ path: join(info.root, PHASES[phase].directory) }),
    output: Object.freeze({
      path: join(info.root, PHASES[phase].directory, PHASES[phase].basename),
    }),
  });
}

export function assertWorkspace(key) {
  ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
  const value = state(key);
  ensure(
    ['initialized', 'sealed'].includes(value.status),
    'DEC203_SUPERVISOR_REFUSED',
  );
  assertFiles(value.files);
  assertInputs(value.inputs);
}

export function assertSealedWorkspace(key) {
  ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
  ensure(state(key).status === 'sealed', 'DEC203_SUPERVISOR_REFUSED');
  assertWorkspace(key);
}

export function sealWorkspace(key) {
  ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
  const value = state(key);
  ensure(value.status === 'initialized', 'DEC203_SUPERVISOR_REFUSED');
  assertWorkspace(key);
  value.status = 'sealing';
  const output = sealFiles(value.files);
  value.status = 'sealed';
  return output;
}

export function closeWorkspace(key) {
  ensure(arguments.length === 1, 'DEC203_SUPERVISOR_REFUSED');
  const value = state(key);
  if (value.closeAttempted) {
    if (value.closeFailed) throw value.closeError;
    ensure(value.status === 'closed', 'DEC203_SUPERVISOR_DRAIN_UNCERTAIN');
    return;
  }
  value.closeAttempted = true;
  try {
    closeFiles(value.files);
    value.status = 'closed';
    retained.delete(value);
  } catch (error) {
    value.closeFailed = true;
    value.closeError = error;
    throw error;
  }
}
