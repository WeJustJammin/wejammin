import assert from 'node:assert/strict';
import { constants, promises as fs } from 'node:fs';
import { basename, dirname } from 'node:path';
import { artifact, sha256 } from './dec203-peer-metadata.mjs';

const suffix = Buffer.from('\n/* owned DEC203 source drift */\n');
// A failed restore/close must not lose the actual FileHandle or its evidence.
const uncertainDrifts = new Set();

function ownedStat(stat, expected, size) {
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  for (const [actual, recorded] of [
    ['dev', 'device'],
    ['ino', 'inode'],
    ['mode', 'mode'],
    ['uid', 'uid'],
  ]) {
    assert.equal(stat[actual], BigInt(expected[recorded]));
  }
  assert.equal(stat.size, BigInt(size));
}

async function snapshot(handle, path, expected, size) {
  assert.ok(Number.isSafeInteger(size) && size >= expected.size);
  ownedStat(await handle.stat({ bigint: true }), expected, size);
  ownedStat(await fs.lstat(path, { bigint: true }), expected, size);
  assert.equal(await fs.realpath(path), path);
  const bytes = Buffer.alloc(size);
  const read = await handle.read(bytes, 0, bytes.length, 0);
  assert.equal(read.bytesRead, bytes.length, 'complete held output read');
  ownedStat(await handle.stat({ bigint: true }), expected, size);
  ownedStat(await fs.lstat(path, { bigint: true }), expected, size);
  assert.equal(await fs.realpath(path), path);
  return bytes;
}

function outputRecord(fixture, path) {
  assert.equal(basename(path), 'peer-lifetime.node');
  assert.ok(fixture.directories.has(dirname(path)), 'owned output directory');
  const records = fixture.readers
    .map((reader) => reader.metadata.output)
    .filter((record) => record.path === path);
  assert.equal(records.length, 1, 'exact actual reader output');
  const expected = records[0];
  assert.equal(expected.uid, process.getuid());
  assert.ok(Number.isSafeInteger(expected.size) && expected.size > 0);
  assert.equal(
    fixture.files.get(path),
    `${expected.device}:${expected.inode}:${expected.uid}`,
    'captured fixture ownership',
  );
  return expected;
}

function aggregate(errors, message) {
  return new AggregateError(errors, message, { cause: errors[0] });
}

export async function driftLoadedOutput(fixture, path, check) {
  const state = { fixture, path, handle: null, expected: null, errors: [] };
  let original;
  let appendAttempted = false;
  let restored = false;
  let closed = false;
  try {
    state.expected = outputRecord(fixture, path);
    const expected = state.expected;
    assert.deepEqual(await artifact(path), expected);
    state.handle = await fs.open(
      path,
      constants.O_RDWR | constants.O_NOFOLLOW | constants.O_APPEND,
    );
    original = await snapshot(state.handle, path, expected, expected.size);
    state.original = original;
    assert.equal(sha256(original), expected.sha256);
    assert.deepEqual(await artifact(path), expected);
    // O_APPEND puts ONLY this known suffix at kernel EOF, never in the prefix.
    appendAttempted = true;
    await state.handle.writeFile(suffix);
    const changed = await snapshot(
      state.handle,
      path,
      expected,
      expected.size + suffix.length,
    );
    assert.deepEqual(changed.subarray(0, expected.size), original);
    assert.deepEqual(changed.subarray(expected.size), suffix);
    await check();
  } catch (error) {
    state.errors.push(error);
  } finally {
    if (state.handle && appendAttempted) {
      try {
        const expected = state.expected;
        const current = await state.handle.stat({ bigint: true });
        assert.ok(current.size >= BigInt(expected.size));
        assert.ok(current.size <= BigInt(expected.size + suffix.length));
        const bytes = await snapshot(
          state.handle,
          path,
          expected,
          Number(current.size),
        );
        assert.deepEqual(bytes.subarray(0, expected.size), original);
        const tail = bytes.subarray(expected.size);
        assert.deepEqual(tail, suffix.subarray(0, tail.length));
        // The verified original image is the absolute truncation floor.
        if (tail.length) await state.handle.truncate(expected.size);
        const after = await snapshot(
          state.handle,
          path,
          expected,
          expected.size,
        );
        assert.deepEqual(after, original);
        assert.equal(sha256(after), expected.sha256);
        assert.deepEqual(await artifact(path), expected);
        restored = true;
      } catch (error) {
        state.errors.push(error);
      }
    }
    if (state.handle) {
      try {
        await state.handle.close();
        closed = true;
      } catch (error) {
        state.errors.push(error);
      }
    }
  }
  if (!restored || !closed) {
    const retained = aggregate(state.errors, 'loaded output evidence retained');
    state.retained = retained;
    uncertainDrifts.add(state);
    fixture.defer(() => {
      throw retained;
    });
  }
  if (state.errors.length === 1) throw state.errors[0];
  if (state.errors.length) {
    throw aggregate(
      state.errors,
      'loaded output drift/check/restoration failed',
    );
  }
}
