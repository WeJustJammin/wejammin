import assert from 'node:assert/strict';
import test from 'node:test';
import {
  outer as execOuter,
  compilerRaw as execRaw,
  compilerBracket as execCompiler,
  ownerRoot,
  ownerPath,
  ownerRaw,
  ownerBracket,
} from './dec203-bootstrap-pre-ready-pending-exec-fixtures.mjs';

export function registerPendingExecControls() {
  // Literal transition controls only; these do not observe or authorize a process.
  async function pendingExec() {
    const namespace = await import(
      new URL('./dec203-bootstrap-pre-ready-values.mjs', import.meta.url).href
    );
    assert.equal(typeof namespace.createPendingCompilerExec, 'function');
    return namespace.createPendingCompilerExec('/node', '/gcc');
  }
  function execRefused(operation) {
    assert.throws(operation, (error) => {
      assert.ok(error instanceof Error);
      assert.notEqual(error.code, 'DEC203_TEST_INCOMPLETE_SNAPSHOT');
      return true;
    });
  }
  const execMutations = [
    ['pid', 602],
    ['ppid', 502],
    ['startTime', '9002'],
    ['uid', 1001],
    ['namespace', 'pid:[702]'],
    ['group', 602],
    ['session', 602],
  ];

  test('EX01 frozen closed API starts complete', async () => {
    const state = await pendingExec();
    assert.deepEqual(Reflect.ownKeys(state).sort(), [
      'assertComplete',
      'consider',
      'resolve',
    ]);
    assert.ok(Object.isFrozen(state));
    for (const name of ['consider', 'resolve', 'assertComplete'])
      assert.equal(typeof state[name], 'function');
    assert.equal(state.assertComplete(), undefined);
  });
  test('EX02 same pending repeat remains incomplete', async () => {
    const state = await pendingExec();
    assert.equal(state.consider(execRaw, execOuter), true);
    assert.equal(state.consider(structuredClone(execRaw), execOuter), true);
    execRefused(() => state.assertComplete());
  });
  for (const pending of [true, false])
    test(`EX03 bracketed GCC repeats, pending=${pending}`, async () => {
      const state = await pendingExec();
      if (pending) state.consider(structuredClone(execRaw), execOuter);
      state.resolve(structuredClone(execCompiler));
      state.resolve(structuredClone(execCompiler));
      assert.equal(state.assertComplete(), undefined);
    });
  test('EX05 pending snapshots mutable input', async () => {
    const state = await pendingExec();
    const raw = structuredClone(execRaw);
    state.consider(raw, structuredClone(execOuter));
    raw.startTime = '9999';
    state.resolve(structuredClone(execCompiler));
    assert.equal(state.assertComplete(), undefined);
  });
  for (const [key, value] of execMutations) {
    test(`EX06 changed ${key} consider latches`, async () => {
      for (const pending of [true, false]) {
        if (!pending && ['pid', 'startTime'].includes(key)) continue;
        const state = await pendingExec();
        if (pending)
          state.consider(structuredClone(execRaw), structuredClone(execOuter));
        execRefused(() =>
          state.consider({ ...execRaw, [key]: value }, execOuter),
        );
        execRefused(() => state.resolve(structuredClone(execCompiler)));
        execRefused(() => state.assertComplete());
      }
    });
    test(`EX07 changed ${key} resolve latches`, async () => {
      const state = await pendingExec();
      state.consider(structuredClone(execRaw), structuredClone(execOuter));
      const compiler = structuredClone(execCompiler);
      if (['namespace', 'group'].includes(key)) compiler[key] = value;
      else compiler.process[key] = value;
      execRefused(() => state.resolve(compiler));
      execRefused(() => state.resolve(structuredClone(execCompiler)));
      execRefused(() => state.assertComplete());
    });
  }
  test('EX08 second qualifying candidate latches', async () => {
    const state = await pendingExec();
    state.consider(execRaw, execOuter);
    const second = { ...execRaw, pid: 602, group: 602, session: 602 };
    execRefused(() => state.consider(second, execOuter));
    execRefused(() => state.resolve(execCompiler));
  });
  test('EX09 resolved state cannot reopen', async () => {
    const state = await pendingExec();
    state.resolve(execCompiler);
    execRefused(() => state.consider(execRaw, execOuter));
    execRefused(() => state.resolve(execCompiler));
    execRefused(() => state.assertComplete());
  });
  for (const pending of [true, false])
    test(`EX10 wrong GCC path latches, pending=${pending}`, async () => {
      const state = await pendingExec();
      if (pending) state.consider(execRaw, execOuter);
      const compiler = structuredClone(execCompiler);
      compiler.process.executable.path = '/other-gcc';
      execRefused(() => state.resolve(compiler));
      execRefused(() => state.resolve(execCompiler));
    });
  test('EX11 raw GCC cannot replace bracketed resolve', async () => {
    const state = await pendingExec();
    assert.equal(
      state.consider({ ...execRaw, image: '/gcc' }, execOuter),
      false,
    );
    state.consider(execRaw, execOuter);
    execRefused(() => state.assertComplete());
  });
  test('EX12 unknown image defers without admission', async () => {
    const state = await pendingExec();
    assert.equal(
      state.consider({ ...execRaw, image: '/other' }, execOuter),
      false,
    );
    assert.equal(state.assertComplete(), undefined);
    state.consider(execRaw, execOuter);
    execRefused(() => state.assertComplete());
  });
  test('EX13 tracked image change latches', async () => {
    const state = await pendingExec();
    state.consider(execRaw, execOuter);
    execRefused(() =>
      state.consider({ ...execRaw, image: '/other' }, execOuter),
    );
    execRefused(() => state.resolve(execCompiler));
    execRefused(() => state.assertComplete());
  });
  test('EX14 unobserved pending cannot complete', async () => {
    const state = await pendingExec();
    state.consider(execRaw, execOuter);
    execRefused(() => state.assertComplete());
    execRefused(() => state.assertComplete());
  });
  test('EX15 later C cannot clear pending', async () => {
    const state = await pendingExec();
    state.consider(execRaw, execOuter);
    const laterC = {
      ...execRaw,
      pid: 701,
      image: '/owner',
      group: 501,
      session: 501,
    };
    assert.equal(state.consider(laterC, execOuter), false);
    execRefused(() => state.assertComplete());
  });
  test('EX17 changed resolved identity latches', async () => {
    const state = await pendingExec();
    state.resolve(execCompiler);
    const compiler = structuredClone(execCompiler);
    compiler.process.startTime = '9002';
    execRefused(() => state.resolve(compiler));
    execRefused(() => state.resolve(execCompiler));
    execRefused(() => state.assertComplete());
  });
  const inheritedRaw = Object.freeze({ ...execRaw, group: 401, session: 401 });
  for (const detached of [true, false])
    test(`EX18 inherited compiler, detached sample=${detached}`, async () => {
      const state = await pendingExec();
      assert.equal(state.consider.length, 2);
      assert.equal(state.resolve.length, 1);
      assert.equal(state.assertComplete.length, 0);
      assert.equal(state.consider(inheritedRaw, execOuter), true);
      if (detached) assert.equal(state.consider(execRaw, execOuter), true);
      assert.equal(
        state.consider({ ...execRaw, image: '/gcc' }, execOuter),
        false,
      );
      execRefused(() => state.assertComplete());
      state.resolve(structuredClone(execCompiler));
      assert.equal(state.assertComplete(), undefined);
    });
  for (const [label, group, session] of [
    ['regression', 401, 401],
    ['mixed-group', 601, 401],
    ['mixed-session', 401, 601],
    ['other', 402, 402],
  ])
    test(`EX19 compiler pair ${label} latches`, async () => {
      const state = await pendingExec();
      assert.equal(state.consider(inheritedRaw, execOuter), true);
      if (label === 'regression') state.consider(execRaw, execOuter);
      execRefused(() =>
        state.consider({ ...execRaw, group, session }, execOuter),
      );
      execRefused(() => state.resolve(execCompiler));
      execRefused(() => state.assertComplete());
    });
  for (const [key, value] of execMutations.slice(0, 5))
    test(`EX20 inherited compiler changed ${key} latches`, async () => {
      const state = await pendingExec();
      assert.equal(state.consider(inheritedRaw, execOuter), true);
      execRefused(() =>
        state.consider({ ...inheritedRaw, [key]: value }, execOuter),
      );
      execRefused(() => state.resolve(execCompiler));
      execRefused(() => state.assertComplete());
    });
  for (const pending of [true, false])
    for (const [group, session] of [
      [401, 401],
      [601, 401],
      [401, 601],
    ]) {
      const title = `EX21 GCC final pair ${group}/${session} refuses`;
      test(pending ? title : `${title}, pending=false`, async () => {
        const state = await pendingExec();
        if (pending)
          assert.equal(state.consider(inheritedRaw, execOuter), true);
        const compiler = structuredClone(execCompiler);
        compiler.group = group;
        compiler.process.session = session;
        execRefused(() => state.resolve(compiler));
        execRefused(() => state.resolve(execCompiler));
        execRefused(() => state.assertComplete());
      });
    }
  test('EX22 inherited compiler snapshots mutable input', async () => {
    const state = await pendingExec();
    const raw = structuredClone(inheritedRaw);
    assert.equal(state.consider(raw, execOuter), true);
    raw.startTime = '9999';
    state.resolve(structuredClone(execCompiler));
    assert.equal(state.assertComplete(), undefined);
  });
  for (const [group, session] of [
    [701, 701],
    [701, 401],
    [401, 701],
  ])
    test(`EX23 fresh owner pair ${group}/${session} latches`, async () => {
      const raw = { ...execRaw, pid: 701, startTime: '9002' };
      const valid = await pendingExec();
      valid.resolve(structuredClone(execCompiler));
      assert.equal(
        valid.consider({ ...raw, group: 401, session: 401 }, execOuter),
        true,
      );
      execRefused(() => valid.assertComplete());
      const state = await pendingExec();
      state.resolve(structuredClone(execCompiler));
      execRefused(() => state.consider({ ...raw, group, session }, execOuter));
      execRefused(() => state.resolve(execCompiler));
      execRefused(() => state.assertComplete());
    });
  for (const pending of [true, false])
    test(`EX35 owner-first refuses, pending=${pending}`, async () => {
      const api = await import(
        new URL(
          './dec203-bootstrap-pre-ready-pending-exec.mjs',
          import.meta.url,
        ).href
      );
      assert.equal(typeof api.createPendingCompilerExec, 'function');
      assert.equal(typeof api.completeOwnerPending, 'function');
      const state = api.createPendingCompilerExec('/node', '/gcc');
      if (pending) assert.equal(state.consider(inheritedRaw, execOuter), true);
      const bracket = structuredClone(ownerBracket);
      execRefused(() => {
        state.consider({ ...ownerRaw, image: ownerPath }, execOuter);
        api.completeOwnerPending(state, bracket, ownerRoot);
      });
      execRefused(() => api.completeOwnerPending(state, bracket, ownerRoot));
      execRefused(() => state.resolve(execCompiler));
      execRefused(() =>
        api.completeOwnerPending(state, ownerBracket, ownerRoot),
      );
      execRefused(() => state.assertComplete());
    });
}
