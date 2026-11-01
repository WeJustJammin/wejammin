import assert from 'node:assert/strict';
import { readdirSync, readlinkSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  fileIdentity,
  gcc,
  headers,
  lockPaths,
  native,
  node,
  sourceNames,
} from './dec203-bootstrap-pre-ready-artifacts.mjs';
import {
  assertCompilerAbsent,
  assertSessionAbsent,
  children,
  childClassificationMessage,
  facts,
  processInfo,
  text,
} from './dec203-bootstrap-pre-ready-processes.mjs';
import { createPendingCompilerExec } from './dec203-bootstrap-pre-ready-values.mjs';
import { captureSealedLeaseOutput } from './dec203-bootstrap-pre-ready-lease-output.mjs';
import { completeOwnerPending } from './dec203-bootstrap-pre-ready-pending-exec.mjs';
export {
  assertAbsent,
  assertSessionAbsent,
} from './dec203-bootstrap-pre-ready-processes.mjs';

function incomplete() {
  const error = new Error('incomplete live FD snapshot');
  error.code = 'DEC203_TEST_INCOMPLETE_SNAPSHOT';
  throw error;
}

function fdTable(pid) {
  const names = () =>
    readdirSync(`/proc/${pid}/fd`)
      .map((name) => {
        assert.match(name, /^(0|[1-9][0-9]*)$/);
        return Number(name);
      })
      .sort((a, b) => a - b);
  const before = names();
  assert.ok(before.length <= 64);
  const global = text('/proc/locks', 1_048_576)
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^\d+: /, ''),
    );
  const locks = [];
  const fds = before.map((fd) => {
    const path = `/proc/${pid}/fd/${fd}`;
    const target = readlinkSync(path);
    assert.ok(Buffer.byteLength(target) <= 512 && !/[\0\r\n]/.test(target));
    const stat = statSync(path, { bigint: true });
    const info = text(`/proc/${pid}/fdinfo/${fd}`);
    const flags = /^flags:\s*([0-7]+)$/m.exec(info)?.[1];
    const pos = /^pos:\s*(0|[1-9][0-9]*)$/m.exec(info)?.[1];
    if (!flags || pos === undefined) incomplete();
    if (BigInt(/^ino:\s*(\d+)$/m.exec(info)?.[1] ?? '-1') !== stat.ino)
      incomplete();
    const rawPid = /^Pid:\s*(-?\d+)$/m.exec(info)?.[1];
    const pidfd =
      rawPid === undefined
        ? null
        : {
            pid: Number(rawPid),
            nspid: (/^NSpid:\s*(.*)$/m.exec(info)?.[1] ?? '')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map(Number),
          };
    const lock = /^lock:\s*(.+)$/m.exec(info)?.[1]?.trim().replace(/\s+/g, ' ');
    if (lock) {
      const match =
        /^(\d+): FLOCK ADVISORY (READ|WRITE) (\d+) ([0-9a-f]+):([0-9a-f]+):(\d+) 0 EOF$/i.exec(
          lock,
        );
      assert.ok(match && fd >= 3 && fd <= 6);
      const dev = stat.dev;
      if (
        BigInt(`0x${match[4]}`) !==
        (((dev >> 8n) & 0xfffn) | ((dev >> 32n) & 0xfffff000n))
      )
        incomplete();
      if (
        BigInt(`0x${match[5]}`) !==
        ((dev & 0xffn) | ((dev >> 12n) & 0xffffff00n))
      )
        incomplete();
      if (
        BigInt(match[6]) !== stat.ino ||
        !global.includes(lock.replace(/^\d+: /, ''))
      )
        incomplete();
      locks.push({
        fd,
        ownerPid: Number(match[3]),
        mode: match[2],
        device: String(dev),
        inode: String(stat.ino),
        start: '0',
        end: 'EOF',
      });
    }
    if (fileIdentity(statSync(path, { bigint: true })) !== fileIdentity(stat))
      incomplete();
    if (readlinkSync(path) !== target) incomplete();
    return {
      fd,
      target,
      device: String(stat.dev),
      inode: String(stat.ino),
      mode: Number(stat.mode),
      uid: Number(stat.uid),
      gid: Number(stat.gid),
      flags:
        BigInt(`0o${flags}`).toString(8) === '0'
          ? '0'
          : `0${BigInt(`0o${flags}`).toString(8)}`,
      pos,
      pidfd,
    };
  });
  const after = names();
  if (
    after.length !== before.length ||
    after.some((value, index) => value !== before[index])
  )
    incomplete();
  return { fds, locks };
}

function inventory(info, artifacts) {
  const before = facts(info.process.pid);
  const expected = {
    pid: info.process.pid,
    ppid: info.process.ppid,
    group: info.group,
    session: info.process.session,
    startTime: info.process.startTime,
    uid: info.process.uid,
    image: info.process.executable.path,
    namespace: info.namespace,
  };
  if (Object.keys(expected).some((key) => before[key] !== expected[key]))
    incomplete();
  const root = artifacts.root;
  const value = { ...info, ...fdTable(info.process.pid) };
  const after = facts(info.process.pid);
  if (Object.keys(before).some((key) => after[key] !== before[key]))
    incomplete();
  for (const entry of value.fds) {
    const { target } = entry;
    assert.ok(
      target === '/dev/null' ||
        target === root ||
        target.startsWith(`${root}/`) ||
        [
          node,
          gcc,
          ...headers,
          ...lockPaths,
          ...sourceNames.map((name) => join(native, name)),
        ].includes(target) ||
        artifacts.allowsProcLocks(target, entry) ||
        /^pipe:\[[0-9]+\]$|^socket:\[[0-9]+\]$|^anon_inode:\[?(?:eventpoll|eventfd|pidfd|signalfd|timerfd|io_uring)\]?$/.test(
          target,
        ),
      'closed diagnostic target',
    );
  }
  return value;
}

export function observer(outer, artifacts) {
  const seen = { processes: new Map(), inventories: new Map(), races: 0 };
  const pendingCompiler = createPendingCompilerExec(node, gcc);
  const save = (role, info) => {
    const prior = seen.processes.get(role);
    if (prior)
      assert.deepEqual(
        info.process,
        prior.process,
        'one original role instance',
      );
    else seen.processes.set(role, info);
  };
  return {
    seen,
    assertComplete: pendingCompiler.assertComplete,
    sample() {
      try {
        const o = processInfo(outer.pid, artifacts);
        assert.equal(o.process.ppid, process.pid);
        save('outer', o);
        for (const pid of children(outer.pid)) {
          const raw = facts(pid);
          const compiler = seen.processes.get('owner-compiler');
          if (
            compiler &&
            (raw.pid !== compiler.process.pid ||
              raw.startTime !== compiler.process.startTime)
          )
            assertCompilerAbsent(compiler);
          if (pendingCompiler.consider(raw, o)) continue;
          if (raw.image === gcc) {
            const compiler = processInfo(pid, artifacts);
            pendingCompiler.resolve(compiler);
            save('owner-compiler', compiler);
            continue;
          }
          assert.ok(
            raw.image.endsWith('/owner/receiving-lease-owner'),
            childClassificationMessage(raw, o),
          );
          artifacts.bindRoot(dirname(dirname(raw.image)));
          const c = processInfo(pid, artifacts);
          assert.equal(c.process.ppid, outer.pid);
          assertCompilerAbsent(seen.processes.get('owner-compiler'));
          completeOwnerPending(pendingCompiler, c, artifacts.root);
          save('owner', c);
          const cChildren = children(pid);
          const ownerFDs = inventory(c, artifacts);
          if (
            ownerFDs.locks.length === 4 &&
            cChildren.length === 0 &&
            children(pid).length === 0
          ) {
            seen.inventories.set('owner-leased', ownerFDs);
          }
          assert.ok(cChildren.length <= 1, 'single coordinator fork');
          for (const inner of cChildren) {
            const i = processInfo(inner, artifacts);
            assert.equal(i.process.ppid, pid);
            assert.equal(i.process.executable.path, node);
            save('coordinator', i);
            const iChildren = children(inner);
            const iFDs = inventory(i, artifacts);
            if (
              !seen.processes.has('lease-compiler') &&
              iChildren.length === 0 &&
              children(inner).length === 0 &&
              Array.from({ length: 8 }, (_, index) => index + 3).every((fd) => {
                const entry = iFDs.fds.find((value) => value.fd === fd);
                return (
                  entry && (BigInt(`0o${entry.flags}`) & 0o2000000n) !== 0n
                );
              })
            )
              seen.inventories.set('coordinator-precompile', iFDs);
            assert.ok(iChildren.length <= 1, 'single fixed lease compiler');
            for (const compilerPid of iChildren) {
              const compiler = processInfo(compilerPid, artifacts);
              assert.equal(compiler.process.executable.path, gcc);
              assert.equal(compiler.process.ppid, inner);
              save('lease-compiler', compiler);
              const complete = inventory(compiler, artifacts);
              assert.deepEqual(facts(inner).startTime, i.process.startTime);
              assert.deepEqual(facts(pid).startTime, c.process.startTime);
              seen.inventories.set('lease-compiler-live', complete);
              seen.compilerPair = {
                owner: ownerFDs,
                coordinator: iFDs,
                compiler: complete,
              };
            }
            if (
              seen.processes.has('lease-compiler') &&
              iChildren.length === 0
            ) {
              assertSessionAbsent(
                seen.processes.get('lease-compiler').process.session,
              );
              const sealed = captureSealedLeaseOutput(
                artifacts,
                iFDs,
                Boolean(seen.afterCompiler),
              );
              if (sealed) seen.afterCompiler = iFDs;
            }
          }
        }
      } catch (error) {
        if (
          !['ENOENT', 'ESRCH', 'DEC203_TEST_INCOMPLETE_SNAPSHOT'].includes(
            error.code,
          )
        )
          throw error;
        seen.races += 1;
      }
    },
  };
}
