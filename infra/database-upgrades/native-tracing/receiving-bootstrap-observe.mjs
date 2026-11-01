import { readlinkSync } from 'node:fs';
import { join } from 'node:path';
import * as artifacts from './receiving-bootstrap-artifacts.mjs';
import {
  captureProcess,
  children,
  facts,
  fdSnapshot,
} from './receiving-bootstrap-processes.mjs';
import {
  COMPILER,
  COORDINATOR,
  LEASE_FLAGS,
  LOCK_PATHS,
  NODE,
  PHASES,
  UID,
} from './receiving-bootstrap-profile.mjs';

export const observationRace = (error) =>
  ['ENOENT', 'ESRCH'].includes(error?.code) ||
  error?.incompleteSnapshot === true;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => `${value.device}:${value.inode}`;
const fd = (value, number) => value.fds.find((entry) => entry.fd === number);

function changed() {
  const error = artifacts.failure('DEC203_SUPERVISOR_HISTORY_GAP');
  error.incompleteSnapshot = true;
  throw error;
}

function retrySnapshot(action) {
  try {
    return action();
  } catch (error) {
    if (!observationRace(error)) throw error;
    return false;
  }
}

export { assertPrecompile } from './receiving-bootstrap-build.mjs';

function lease(owner, inner, pendingStartup = false) {
  artifacts.ensure(owner.locks.length === 4 && inner.locks.length === 4);
  let cloexec = true;
  for (let number = 3; number <= 10; number += 1) {
    const parent = fd(owner, number);
    const child = fd(inner, number);
    artifacts.ensure(parent !== undefined && child !== undefined);
    if ((BigInt(`0o${child.flags}`) & 0o2000000n) === 0n) cloexec = false;
    if (number === 8 || number === 9) continue;
    artifacts.ensure(object(parent) === object(child));
  }
  for (let number = 3; number <= 6; number += 1) {
    const held = fd(owner, number);
    const lock = owner.locks.find((value) => value.fd === number);
    const inherited = inner.locks.find((value) => value.fd === number);
    const current = artifacts.named(LOCK_PATHS[number - 3]);
    artifacts.ensure(
      held.target === LOCK_PATHS[number - 3] &&
        held.mode === 0o100644 &&
        held.uid === UID &&
        held.gid === UID,
    );
    artifacts.ensure(
      String(current.dev) === held.device && String(current.ino) === held.inode,
    );
    artifacts.ensure(
      current.mode === 0o100644n &&
        current.uid === BigInt(UID) &&
        current.gid === BigInt(UID),
    );
    artifacts.ensure(
      lock?.ownerPid === owner.process.pid &&
        lock.mode === (number === 4 ? 'READ' : 'WRITE'),
    );
    artifacts.ensure(equal(lock, inherited));
  }
  artifacts.ensure(fd(inner, 7).pidfd?.pid === owner.process.pid);
  artifacts.ensure(fd(inner, 10).pidfd?.pid === owner.process.ppid);
  artifacts.ensure(fd(owner, 12) !== undefined && fd(owner, 13) !== undefined);
  artifacts.ensure(
    object(fd(owner, 13)) === object(fd(inner, 8)) &&
      object(fd(owner, 12)) === object(fd(inner, 9)),
  );
  for (const [snapshot, number, mode] of [
    [owner, 12, 0n],
    [owner, 13, 1n],
    [inner, 8, 0n],
    [inner, 9, 1n],
  ]) {
    const entry = fd(snapshot, number);
    artifacts.ensure(
      (entry.mode & 0o170000) === 0o010000 &&
        (BigInt(`0o${entry.flags}`) & 3n) === mode,
    );
  }
  const outer = [object(fd(owner, 8)), object(fd(owner, 9))];
  artifacts.ensure(
    new Set([...outer, object(fd(owner, 12)), object(fd(owner, 13))]).size ===
      4,
  );
  artifacts.ensure(inner.fds.every((entry) => !outer.includes(object(entry))));
  for (const [snapshot, protectedNumbers] of [
    [owner, [3, 4, 5, 6, 7, 8, 9, 10, 12, 13]],
    [inner, [3, 4, 5, 6, 7, 8, 9, 10]],
  ]) {
    for (const number of protectedNumbers) {
      const entry = fd(snapshot, number);
      artifacts.ensure(
        entry !== undefined &&
          snapshot.fds.filter((value) => object(value) === object(entry))
            .length === 1,
      );
    }
  }
  if (!cloexec && pendingStartup) changed();
  artifacts.ensure(cloexec);
}

export function createOwnerObserver(child, info, output, bootstrapId) {
  const inputs = Object.freeze([...info.inputs, output]);
  const seen = new Map();
  const phases = new Map();
  const pending = [];
  let coordinatorQualified = false;
  const namespace = readlinkSync('/proc/self/ns/pid');
  const publish = (role, value) => {
    const prior = seen.get(role);
    if (prior !== undefined)
      artifacts.ensure(equal(prior.process, value.process));
    else {
      seen.set(role, value);
      pending.push({ kind: 'process', body: { role, process: value.process } });
    }
  };
  const save = (phase, value) => {
    if (!phases.has(phase)) {
      phases.set(phase, value);
      pending.push({ kind: 'inventory', body: { phase, ...value } });
    }
  };
  const owner = () => {
    const value = captureProcess(child.pid, info.root, inputs);
    artifacts.ensure(
      value.process.ppid === process.pid &&
        value.namespace === namespace &&
        value.cwd === info.root,
    );
    artifacts.ensure(equal(value.argv, [output.path, bootstrapId]));
    publish('owner', value);
    return value;
  };
  const inner = (pid, parent) => {
    const value = captureProcess(pid, info.root, inputs);
    artifacts.ensure(
      value.process.ppid === parent.process.pid &&
        value.namespace === namespace &&
        value.cwd === info.root,
    );
    if (
      value.process.executable.path === parent.process.executable.path &&
      equal(value.argv, parent.argv)
    )
      changed();
    artifacts.ensure(
      value.process.executable.path === NODE &&
        equal(value.argv, [NODE, '--', COORDINATOR, bootstrapId]),
    );
    publish('coordinator', value);
    return value;
  };
  return Object.freeze({
    sample() {
      return retrySnapshot(() => {
        const c = owner();
        const descendants = children(c.process.pid);
        const cFDs = fdSnapshot(c, info.root);
        if (!equal(descendants, children(c.process.pid))) changed();
        artifacts.ensure(descendants.length <= 1);
        if (
          cFDs.locks.length === 4 &&
          descendants.length === 0 &&
          children(c.process.pid).length === 0
        )
          save('owner-leased', cFDs);
        for (const pid of descendants) {
          const i = inner(pid, c);
          const iFDs = fdSnapshot(i, info.root);
          const compilers = children(pid);
          artifacts.ensure(compilers.length <= 1);
          lease(cFDs, iFDs, !coordinatorQualified && compilers.length === 0);
          coordinatorQualified = true;
          if (
            !seen.has('lease-compiler') &&
            compilers.length === 0 &&
            children(pid).length === 0
          )
            save('coordinator-precompile', iFDs);
          for (const compilerPid of compilers) {
            const compiler = captureProcess(compilerPid, info.root, inputs);
            artifacts.ensure(
              compiler.process.ppid === pid && compiler.namespace === namespace,
            );
            const compilerDirectory = join(info.root, PHASES.lease.directory);
            if (
              compiler.process.executable.path === i.process.executable.path &&
              equal(compiler.argv, i.argv) &&
              [info.root, compilerDirectory].includes(compiler.cwd)
            )
              changed();
            artifacts.ensure(
              compiler.process.executable.path === COMPILER &&
                compiler.process.ppid === pid,
            );
            artifacts.ensure(
              compiler.group === compilerPid &&
                compiler.process.session === compilerPid &&
                compiler.namespace === namespace &&
                compiler.cwd === compilerDirectory,
            );
            artifacts.ensure(
              equal(compiler.argv, [
                COMPILER,
                ...LEASE_FLAGS,
                PHASES.lease.source,
                '-o',
                join(info.root, 'lease/receiving-lease.node'),
              ]),
            );
            const complete = fdSnapshot(compiler, info.root);
            const protectedObjects = new Set(
              [
                ...cFDs.fds.filter((value) =>
                  [3, 4, 5, 6, 7, 8, 9, 10, 12, 13].includes(value.fd),
                ),
                ...iFDs.fds.filter((value) => value.fd >= 3 && value.fd <= 10),
              ].map(object),
            );
            artifacts.ensure(
              complete.fds.every(
                (value) =>
                  !protectedObjects.has(object(value)) &&
                  !LOCK_PATHS.includes(value.target) &&
                  value.pidfd === null,
              ),
            );
            artifacts.ensure(
              facts(pid).startTime === i.process.startTime &&
                facts(c.process.pid).startTime === c.process.startTime,
            );
            publish('lease-compiler', compiler);
            save('lease-compiler-live', complete);
          }
        }
        return true;
      });
    },
    postAdoption() {
      return retrySnapshot(() => {
        artifacts.ensure(
          phases.has('owner-leased') &&
            phases.has('coordinator-precompile') &&
            phases.has('lease-compiler-live'),
        );
        const c = owner();
        const ids = children(c.process.pid);
        artifacts.ensure(ids.length === 1);
        const i = inner(ids[0], c);
        const cFDs = fdSnapshot(c, info.root);
        const iFDs = fdSnapshot(i, info.root);
        lease(cFDs, iFDs);
        artifacts.ensure(children(i.process.pid).length === 0);
        save('coordinator-adopted', iFDs);
        return true;
      });
    },
    take() {
      return pending.splice(0);
    },
    phase: (name) => phases.get(name),
    process: (name) => seen.get(name),
  });
}
