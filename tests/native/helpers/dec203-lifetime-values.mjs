import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifact, headers } from './dec203-lifetime-harness.mjs';
import { compileFixture } from './dec203-lifetime-fixture-compiler.mjs';

export async function lifetimeValues(fixture) {
  const directory = await fixture.directory('native-values');
  const source = fileURLToPath(
    new URL('../fixtures/dec203-lifetime-values.c', import.meta.url),
  );
  const output = await fixture.file(
    'native-values/dec203-lifetime-values.node',
    '',
  );
  const inputs = [
    source,
    fixture.options.compilerPath,
    ...headers.map((file) => join(fixture.options.includeDirectory, file)),
  ];
  const before = await Promise.all(inputs.map(artifact));
  let drained = false;
  fixture.defer(() =>
    assert.ok(drained, 'TEST compiler drain not proved; retain evidence'),
  );
  try {
    const diagnostics = await compileFixture({
      compiler: fixture.options.compilerPath,
      includeDirectory: fixture.options.includeDirectory,
      output: { path: output },
      run: { path: directory },
    });
    assert.equal(diagnostics.drainProven, true);
    assert.equal(diagnostics.timedOut, false);
    assert.equal(diagnostics.exitCode, 0);
    assert.equal(diagnostics.exitSignal, null);
    drained = true;
  } catch (error) {
    drained = error.diagnostics?.drainProven === true;
    if (drained) {
      try {
        await fixture.remember(output);
      } catch (capture) {
        throw new AggregateError(
          [error, capture],
          'TEST compiler and capture failure',
          { cause: capture },
        );
      }
    }
    throw error;
  }
  await fixture.remember(output);
  assert.deepEqual(await Promise.all(inputs.map(artifact)), before);
  const record = await artifact(output);
  assert.equal(record.uid, process.getuid());
  assert.ok(record.size > 0);
  const addon = createRequire(import.meta.url)(output);
  assert.deepEqual(Object.getOwnPropertyNames(addon).sort(), [
    'createDatagramPair',
    'createForeign',
  ]);
  return { addon, path: output };
}
