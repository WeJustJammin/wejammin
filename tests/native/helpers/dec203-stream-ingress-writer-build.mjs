import assert from 'node:assert/strict';
import { constants, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileWriters } from './dec203-stream-ingress-fixture-compiler.mjs';
import {
  artifact,
  assertArtifacts,
  assertDirectory,
  directory,
  executable,
} from '../../../infra/database-upgrades/native-tracing/peer-artifacts.mjs';

export async function executableFixture(fixture) {
  if (fixture.writerExecutable) return fixture.writerExecutable;
  const run = directory(await fixture.directory('writers'), true);
  const sources = [
    'dec203-stream-writers.c',
    'dec203-stream-writers-state.h',
  ].map((name) =>
    artifact(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))),
  );
  const compiler = artifact(fixture.options.compilerPath);
  executable(compiler);
  const path = join(run.path, 'stream-writers');
  const reserved = await fs.open(path, 'wx', 0o700);
  await reserved.close();
  await fixture.remember(path);
  try {
    assertArtifacts([...sources, compiler]);
    await compileWriters({ compiler: compiler.path, output: { path }, run });
    assertDirectory(run);
    assertArtifacts([...sources, compiler]);
    const output = artifact(path);
    const handle = await fs.open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await handle.stat({ bigint: true });
      assert.equal(String(stat.dev), output.device);
      assert.equal(String(stat.ino), output.inode);
      assert.equal(Number(stat.uid), process.getuid());
      await handle.chmod(0o700);
    } finally {
      await handle.close();
    }
    const ready = artifact(path);
    assert.deepEqual(ready, { ...output, mode: 0o100700 });
    assert.equal(ready.mode, 0o100700);
    assert.ok(ready.size > 0);
    executable(ready);
    await fixture.remember(path);
    fixture.writerInputs = [...sources, compiler];
    fixture.writerExecutable = ready;
    return ready;
  } catch (error) {
    if (error.diagnostics?.drainProven === false)
      fixture.defer(() => {
        throw error;
      });
    else {
      try {
        await fixture.remember(path);
      } catch (capture) {
        if (capture.code !== 'ENOENT') error.cause ??= capture;
      }
    }
    throw error;
  }
}
