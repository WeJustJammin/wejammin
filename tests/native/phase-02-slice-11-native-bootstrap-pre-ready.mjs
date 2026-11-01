import assert from 'node:assert/strict';
import test from 'node:test';
import {
  outer as ownerOuter,
  compilerCore,
  compilerBracket as ownerCompiler,
  ownerRoot,
  ownerPath,
  ownerRaw,
  ownerBracket,
} from './helpers/dec203-bootstrap-pre-ready-pending-exec-fixtures.mjs';
import { registerPendingExecControls } from './helpers/dec203-bootstrap-pre-ready-pending-exec-controls.mjs';
import { lockPaths } from './helpers/dec203-bootstrap-pre-ready-artifacts.mjs';
import {
  builds,
  fd,
  frames,
  inventories,
  lease,
  objectKey,
  processes,
  terminal,
} from './helpers/dec203-bootstrap-pre-ready-assertions.mjs';
import { invoke } from './helpers/dec203-bootstrap-pre-ready-harness.mjs';
import './helpers/dec203-bootstrap-pre-ready-inventory-controls.mjs';

const subject = new URL(
  '../../infra/database-upgrades/native-tracing/receiving-native-launch.mjs',
  import.meta.url,
);
function compilerBoundary(result, raw, processSet) {
  for (let number = 3; number <= 10; number += 1) {
    assert.ok(
      (BigInt(`0o${fd(raw.precompile, number).flags}`) & 0o2000000n) !== 0n,
    );
  }
  const live = raw.pair.compiler;
  assert.deepEqual(
    live.process,
    processSet.actual.get('lease-compiler').process,
  );
  const protectedObjects = new Set([
    ...raw.pair.owner.fds
      .filter((entry) => [3, 4, 5, 6, 7, 8, 9, 10, 12, 13].includes(entry.fd))
      .map(objectKey),
    ...raw.pair.coordinator.fds
      .filter((entry) => [3, 4, 5, 6, 7, 8, 9, 10].includes(entry.fd))
      .map(objectKey),
  ]);
  assert.ok(live.fds.length >= 3, 'complete live GCC table, not an empty DTO');
  for (const entry of live.fds) {
    assert.ok(
      !protectedObjects.has(objectKey(entry)),
      'no protected alias at ANY GCC fd',
    );
    assert.ok(!lockPaths.includes(entry.target));
    assert.equal(entry.pidfd, null);
  }
  const records = result.records;
  const phase = (name, process) => {
    const found = records.filter(
      (value) => value.kind === 'inventory' && value.body.phase === name,
    );
    assert.ok(found.length > 0, `qualifying ${name} inventory required`);
    for (const value of found) assert.deepEqual(value.body.process, process);
    return found;
  };
  const gccInventories = phase('lease-compiler-live', live.process);
  const preInventories = phase('coordinator-precompile', processSet.i.process);
  const adopted = phase('coordinator-adopted', processSet.i.process);
  phase('owner-leased', processSet.c.process);
  const flow = frames(result);
  assert.ok(
    gccInventories.some(
      (value) =>
        BigInt(value.seq) < BigInt(flow[4].seq) &&
        preInventories.some((prior) => BigInt(prior.seq) < BigInt(value.seq)),
    ),
  );
  assert.ok(
    adopted.some(
      (value) =>
        BigInt(flow[4].seq) < BigInt(value.seq) &&
        BigInt(value.seq) < BigInt(flow[5].seq),
    ),
  );
  // The live GCC premise plus actual compiler-before-load source causality matters;
  // delivered stdout order alone is NOT proof of native I-HELLO timing/F_GETFD.
}

for (const [id, title] of [
  [
    'PR01',
    'real fixed construction and independently observed build artifacts',
  ],
  ['PR02', 'genuine four-FLOCK adoption, both lifetimes and disjoint channels'],
  [
    'PR03',
    'real live GCC complete FD inventory and inherited CLOEXEC boundary',
  ],
  [
    'PR04',
    'producer-mediated native cancellation and actual outer closure before ready',
  ],
]) {
  test(
    `${id}: ${title}`,
    { timeout: 120_000, concurrency: false },
    async (context) => {
      await import(subject.href); // Before EVERY allocation/spawn: missing API stays missing-API RED.
      const result = await invoke(context); // One fresh actual fixed O invocation per case.
      const processSet = processes(result);
      frames(result);
      builds(result, processSet);
      const raw = lease(result, processSet);
      compilerBoundary(result, raw, processSet);
      inventories(result, raw);
      terminal(result, processSet);
      context.diagnostic(
        'Native F_GETFD and inner SETTLED/FINISH are producer-mediated, not direct TEST sightings; no workflow authority.',
      );
    },
  );
}
registerPendingExecControls();

async function ownerApi() {
  const api = await import(
    new URL(
      './helpers/dec203-bootstrap-pre-ready-pending-exec.mjs',
      import.meta.url,
    ).href
  );
  assert.equal(typeof api.createPendingCompilerExec, 'function');
  assert.equal(typeof api.completeOwnerPending, 'function');
  return api;
}
function refused(operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof Error);
    assert.notEqual(error.code, 'DEC203_TEST_INCOMPLETE_SNAPSHOT');
    return true;
  });
}
function ownerPending(api) {
  const state = api.createPendingCompilerExec('/node', '/gcc');
  state.resolve(structuredClone(ownerCompiler));
  assert.equal(state.consider(structuredClone(ownerRaw), ownerOuter), true);
  refused(() => state.assertComplete());
  return state;
}
test('EX30 inherited compiler then owner completes both slots', async () => {
  const api = await ownerApi();
  const state = api.createPendingCompilerExec('/node', '/gcc');
  const outer = structuredClone(ownerOuter);
  const compiler = {
    ...compilerCore,
    group: 401,
    session: 401,
    image: '/node',
    namespace: 'pid:[701]',
  };
  assert.equal(state.consider(compiler, outer), true);
  state.resolve(structuredClone(ownerCompiler));
  outer.group = 999;
  outer.process.session = 999;
  const raw = structuredClone(ownerRaw);
  assert.equal(state.consider(raw, ownerOuter), true);
  raw.startTime = '9999';
  api.completeOwnerPending(state, structuredClone(ownerBracket), ownerRoot);
  api.completeOwnerPending(state, structuredClone(ownerBracket), ownerRoot);
  assert.equal(state.assertComplete(), undefined);
  refused(() => state.consider({ ...ownerRaw, pid: 702 }, ownerOuter));
  refused(() => api.completeOwnerPending(state, ownerBracket, ownerRoot));
  refused(() => state.assertComplete());
});
for (const changed of [false, true])
  test(`EX31 direct C bracket, changed image=${changed}`, async () => {
    const api = await ownerApi();
    const state = api.createPendingCompilerExec('/node', '/gcc');
    state.resolve(structuredClone(ownerCompiler));
    const image = changed ? '/other/owner/receiving-lease-owner' : ownerPath;
    assert.equal(state.consider({ ...ownerRaw, image }, ownerOuter), false);
    refused(() => state.assertComplete());
    if (changed) {
      refused(() => api.completeOwnerPending(state, ownerBracket, ownerRoot));
      refused(() => state.assertComplete());
    } else {
      api.completeOwnerPending(state, structuredClone(ownerBracket), ownerRoot);
      assert.equal(state.assertComplete(), undefined);
    }
  });
for (const [key, value] of [
  ['root', '/different-run'],
  ['path', '/different-run/owner/receiving-lease-owner'],
  ['cwd', '/different-run'],
  ['pid', 702],
  ['ppid', 502],
  ['startTime', '9003'],
  ['uid', 1001],
  ['namespace', 'pid:[702]'],
  ['group', 701],
  ['session', 701],
])
  test(`EX32 owner changed ${key} refuses and latches`, async () => {
    const api = await ownerApi();
    const state = ownerPending(api);
    const bracket = structuredClone(ownerBracket);
    const root = key === 'root' ? value : ownerRoot;
    if (key === 'path') bracket.process.executable.path = value;
    else if (['cwd', 'namespace', 'group'].includes(key)) bracket[key] = value;
    else if (key !== 'root') bracket.process[key] = value;
    refused(() => api.completeOwnerPending(state, bracket, root));
    refused(() => api.completeOwnerPending(state, ownerBracket, ownerRoot));
    refused(() => state.assertComplete());
  });
test('EX33 lookalike state has no owner join', async () => {
  const api = await ownerApi();
  const state = ownerPending(api);
  const foreign = Object.freeze({ ...state });
  refused(() => api.completeOwnerPending(foreign, ownerBracket, ownerRoot));
  refused(() => state.assertComplete());
  api.completeOwnerPending(state, ownerBracket, ownerRoot);
  assert.equal(state.assertComplete(), undefined);
});
for (const count of [2, 4])
  test(`EX34 owner completion arity ${count} refuses and latches`, async () => {
    const api = await ownerApi();
    const state = ownerPending(api);
    const args = [state, ownerBracket, ownerRoot];
    if (count === 2) args.pop();
    else args.push('extra');
    refused(() => Reflect.apply(api.completeOwnerPending, undefined, args));
    refused(() => api.completeOwnerPending(state, ownerBracket, ownerRoot));
    refused(() => state.assertComplete());
  });
test('EX36 resolve stays GCC-only', async () => {
  const api = await ownerApi();
  const state = ownerPending(api);
  refused(() => state.resolve(ownerBracket));
  refused(() => api.completeOwnerPending(state, ownerBracket, ownerRoot));
  refused(() => state.assertComplete());
});
test('EX37 raw C cannot replace its bracket', async () => {
  const api = await ownerApi();
  const state = ownerPending(api);
  assert.equal(
    state.consider({ ...ownerRaw, image: ownerPath }, ownerOuter),
    false,
  );
  // Absence or a terminal receipt supplies no transition in this closed API.
  refused(() => state.assertComplete());
  refused(() => state.assertComplete());
});
test('EX38 second owner candidate refuses instead of overwriting', async () => {
  const api = await ownerApi();
  const state = ownerPending(api);
  refused(() => state.consider({ ...ownerRaw, pid: 702 }, ownerOuter));
  refused(() => api.completeOwnerPending(state, ownerBracket, ownerRoot));
  refused(() => state.assertComplete());
});
