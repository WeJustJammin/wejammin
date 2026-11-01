import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifact } from './dec203-peer-metadata.mjs';

export async function connectedUnixDatagram(fixture) {
  const directory = await fixture.directory('datagram-addon');
  const source = fileURLToPath(
    new URL('../fixtures/dec203-peer-sockets.c', import.meta.url),
  );
  const output = await fixture.file(
    'datagram-addon/dec203-peer-sockets.node',
    '',
  );
  const headerNames = [
    'js_native_api.h',
    'js_native_api_types.h',
    'node_api.h',
    'node_api_types.h',
  ];
  const inputs = [
    source,
    fixture.options.compilerPath,
    ...headerNames.map((name) => join(fixture.options.includeDirectory, name)),
  ];
  const before = await Promise.all(inputs.map(artifact));
  const child = spawn(
    fixture.options.compilerPath,
    [
      '-shared',
      '-fPIC',
      '-DNAPI_VERSION=8',
      '-D_GNU_SOURCE',
      '-I',
      fixture.options.includeDirectory,
      source,
      '-o',
      output,
    ],
    {
      cwd: directory,
      env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const failures = [];
  let exited = false;
  child.stdout.on('error', (error) => failures.push(error));
  child.stderr.on('error', (error) => failures.push(error));
  child.stdout.resume();
  child.stderr.resume();
  const closed = new Promise((resolve) => {
    child.on('error', (error) => failures.push(error));
    child.once('close', (code, signal) => {
      exited = true;
      resolve({ code, signal });
    });
  });
  const timer = setTimeout(() => {
    failures.push(new Error('owned datagram-fixture compiler deadline'));
    if (!exited) child.kill('SIGKILL');
  }, 30_000);
  fixture.defer(async () => {
    if (!exited) child.kill('SIGKILL');
    const result = await closed;
    assert.deepEqual(result, { code: 0, signal: null });
    assert.deepEqual(failures, []);
  });
  const errors = [];
  let result;
  try {
    result = await closed;
    assert.deepEqual(
      result,
      { code: 0, signal: null },
      'actual fixture compiler close',
    );
    assert.deepEqual(failures, []);
  } catch (error) {
    errors.push(error);
  } finally {
    clearTimeout(timer);
  }
  try {
    await fixture.remember(output);
  } catch (error) {
    if (error?.code !== 'ENOENT') errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      'fixture compiler and artifact capture failed',
    );
  }
  assert.deepEqual(await Promise.all(inputs.map(artifact)), before);
  const compiled = await artifact(output);
  assert.equal(compiled.uid, process.getuid());
  assert.ok(compiled.size > 0);
  const addon = createRequire(import.meta.url)(output);
  const pair = addon.createDatagramPair();
  fixture.defer(() => pair.close());
  assert.ok(Object.isFrozen(pair));
  assert.deepEqual(Object.keys(pair).sort(), ['close', 'fd']);
  assert.ok(Number.isInteger(pair.fd) && pair.fd >= 0);
  assert.equal(typeof pair.close, 'function');
  return pair;
}
