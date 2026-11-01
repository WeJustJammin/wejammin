import { Buffer } from 'node:buffer';
import { basename, dirname, join, resolve } from 'node:path';

import { requireFact } from './delivery-receiving-upgrade-target.mjs';
import {
  readRegular,
  sha256,
} from './delivery-receiving-upgrade-local-inventory.mjs';

const sameFile = (stat, identity) =>
  stat.dev === identity.dev && stat.ino === identity.ino;

export async function createStaging(fs, plan, beforeMutation) {
  const link = join(plan.target.workdir, 'supabase/migrations');
  const original = await fs.readlink(link);
  const originalStat = await fs.lstat(link);
  requireFact(
    originalStat.isSymbolicLink() &&
      (await fs.realpath(link)) ===
        resolve(plan.repository, 'supabase/migrations'),
    'foreign original migrations link',
  );
  let installed = {
    target: original,
    dev: originalStat.dev,
    ino: originalStat.ino,
  };
  const stages = [];
  const linkDirectories = [];

  async function ownedLink() {
    const stat = await fs.lstat(link);
    requireFact(
      stat.isSymbolicLink() &&
        sameFile(stat, installed) &&
        (await fs.readlink(link)) === installed.target,
      'migrations link no longer owned',
    );
  }

  async function temporary(prefix, parent) {
    await beforeMutation();
    const path = await fs.mkdtemp(prefix);
    requireFact(
      dirname(path) === parent &&
        path.startsWith(prefix) &&
        path.length > prefix.length &&
        resolve(path) === path,
      'unsafe temporary directory',
    );
    const stat = await fs.lstat(path);
    requireFact(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'temporary directory not regular',
    );
    return { path, dev: stat.dev, ino: stat.ino };
  }

  async function verify(stage) {
    const stat = await fs.lstat(stage.path);
    requireFact(
      stat.isDirectory() && !stat.isSymbolicLink() && sameFile(stat, stage),
      'replaced staging directory',
    );
    const names = (await fs.readdir(stage.path)).sort();
    requireFact(
      names.join('\0') === stage.files.map((file) => file.name).join('\0'),
      'unexpected stage contents',
    );
    for (const file of stage.files) {
      const path = join(stage.path, file.name);
      const current = await fs.lstat(path);
      const bytes = await readRegular(fs, path);
      requireFact(
        sameFile(current, file) &&
          bytes.equals(file.bytes) &&
          sha256(bytes) === file.sha256,
        'staged migration bytes changed',
      );
    }
  }

  async function build(entries) {
    const stage = await temporary(
      `/tmp/wejammin-dec197-${plan.runId}-`,
      '/tmp',
    );
    stage.files = [];
    stages.push(stage);
    for (const entry of entries) {
      const name = basename(entry.path);
      requireFact(
        /^\d{14}_[A-Za-z0-9_]+\.sql$/.test(name),
        'unsafe staged filename',
      );
      await beforeMutation();
      await fs.writeFile(join(stage.path, name), Buffer.from(entry.bytes), {
        flag: 'wx',
        mode: 0o600,
      });
      const stat = await fs.lstat(join(stage.path, name));
      stage.files.push({
        name,
        bytes: Buffer.from(entry.bytes),
        sha256: entry.sha256,
        dev: stat.dev,
        ino: stat.ino,
      });
    }
    await verify(stage);
    return stage;
  }

  async function replace(target) {
    await beforeMutation();
    await ownedLink();
    const parent = join(plan.target.workdir, 'supabase');
    const directory = await temporary(
      join(parent, `.dec197-link-${plan.runId}-`),
      parent,
    );
    linkDirectories.push(directory);
    const next = join(directory.path, 'next');
    await beforeMutation();
    await fs.symlink(target, next);
    const prepared = await fs.lstat(next);
    requireFact(
      prepared.isSymbolicLink() && (await fs.readlink(next)) === target,
      'prepared link mismatch',
    );
    await beforeMutation();
    await ownedLink();
    await fs.rename(next, link);
    installed = { target, dev: prepared.dev, ino: prepared.ino };
    await ownedLink();
  }

  async function install(stage) {
    await verify(stage);
    await replace(stage.path);
    await verify(stage);
  }

  async function restoreLink() {
    await ownedLink();
    if (installed.target !== original) await replace(original);
    requireFact(
      (await fs.readlink(link)) === original,
      'original link not restored',
    );
  }

  async function cleanup() {
    const errors = [];
    for (const stage of stages) {
      try {
        await verify(stage);
        for (const file of stage.files) {
          await beforeMutation();
          const path = join(stage.path, file.name);
          requireFact(
            sameFile(await fs.lstat(path), file),
            'replaced owned stage file',
          );
          await fs.unlink(path);
        }
        await beforeMutation();
        requireFact(
          sameFile(await fs.lstat(stage.path), stage),
          'replaced owned stage',
        );
        await fs.rmdir(stage.path);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const directory of linkDirectories) {
      try {
        await beforeMutation();
        requireFact(
          sameFile(await fs.lstat(directory.path), directory) &&
            (await fs.readdir(directory.path)).length === 0,
          'foreign link-directory contents',
        );
        await fs.rmdir(directory.path);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'owned staging cleanup incomplete');
  }
  return { build, verify, install, restoreLink, cleanup };
}
