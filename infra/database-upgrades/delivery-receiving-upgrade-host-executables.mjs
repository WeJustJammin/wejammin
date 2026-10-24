import { dirname, isAbsolute, join } from 'node:path';

import {
  exactKeys,
  hashText,
  isRecord,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import { SUPABASE } from './delivery-receiving-upgrade-local-target.mjs';
import {
  readRegular,
  sha256,
} from './delivery-receiving-upgrade-local-inventory.mjs';
import { sameValue } from './delivery-receiving-upgrade-host-request.mjs';
import {
  assertIngress,
  verifyIngress,
} from './delivery-receiving-upgrade-host-ingress.mjs';

const modules = dirname(dirname(SUPABASE));
const script = join(
  modules,
  '.pnpm/supabase@2.116.0/node_modules/supabase/dist/supabase.js',
);
const native = join(
  modules,
  '.pnpm/@supabase+cli-linux-x64@2.116.0/node_modules/@supabase/cli-linux-x64/bin/supabase',
);
const invoked = `${modules}/.bin/../supabase/dist/supabase.js`;

function artifact(value, launcher = false) {
  requireFact(
    exactKeys(value, [
      'path',
      'sha256',
      'dev',
      'inode',
      'mode',
      ...(launcher ? ['invokedPath'] : []),
    ]) &&
      typeof value.path === 'string' &&
      isAbsolute(value.path) &&
      !/[\0\r\n]/.test(value.path) &&
      hashText(value.sha256) &&
      Number.isSafeInteger(value.dev) &&
      value.dev >= 0 &&
      Number.isSafeInteger(value.inode) &&
      value.inode > 0 &&
      Number.isSafeInteger(value.mode) &&
      value.mode >= 0 &&
      value.mode <= 0xffffffff &&
      (value.mode & 0o170000) === 0o100000,
    'invalid bound artifact',
  );
}

export function assertBinding(binding) {
  requireFact(
    exactKeys(binding, [
      'daemon',
      'executables',
      'artifacts',
      'package',
      'environment',
      'derivedEnvironment',
      'dotenv',
      'ingress',
    ]),
    'independent native binding shape',
  );
  requireFact(
    exactKeys(binding.daemon, ['id', 'endpoint']) &&
      typeof binding.daemon.id === 'string' &&
      binding.daemon.id.length > 0 &&
      binding.daemon.endpoint === 'unix:///run/docker.sock',
    'sealed local daemon required',
  );
  requireFact(
    exactKeys(binding.executables, [
      'supabase',
      'shell',
      'node',
      'native',
      'docker',
    ]) && exactKeys(binding.artifacts, ['launcher']),
    'bound launcher chain required',
  );
  for (const value of Object.values(binding.executables)) artifact(value);
  artifact(binding.artifacts.launcher, true);
  requireFact(
    binding.executables.supabase.path === SUPABASE &&
      binding.executables.native.path === native &&
      binding.artifacts.launcher.path === script &&
      binding.artifacts.launcher.invokedPath === invoked &&
      sameValue(binding.package, {
        name: '@supabase/cli-linux-x64',
        version: '2.116.0',
        engine: 'compiled-ts-bun',
      }),
    'foreign CLI launcher/package',
  );
  assertIngress(binding.ingress);
  requireFact(
    exactKeys(binding.environment, ['PATH', 'DOCKER_HOST']) &&
      typeof binding.environment.PATH === 'string' &&
      binding.environment.PATH.split(':').every(
        (path) => isAbsolute(path) && !/[\0\r\n]/.test(path),
      ) &&
      binding.environment.DOCKER_HOST === binding.ingress.endpoint,
    'sanitized explicit launcher environment required',
  );
  requireFact(
    sameValue(binding.derivedEnvironment, {
      NODE_PATH: `${modules}/.pnpm/supabase@2.116.0/node_modules/supabase/node_modules:${modules}/.pnpm/supabase@2.116.0/node_modules:${modules}/.pnpm/node_modules`,
    }) &&
      Array.isArray(binding.dotenv) &&
      binding.dotenv.length === 0,
    'unapproved derived environment or dotenv',
  );
}

export function assertObservedBinding(raw, binding) {
  requireFact(isRecord(raw), 'missing independent boundary');
  for (const key of Object.keys(binding)) {
    requireFact(sameValue(raw[key], binding[key]), `changed native ${key}`);
  }
}

async function verifyFile(fs, expected, executable) {
  const before = await fs.lstat(expected.path);
  const bytes = await readRegular(fs, expected.path);
  const after = await fs.lstat(expected.path);
  requireFact(
    before.dev === expected.dev &&
      before.ino === expected.inode &&
      after.dev === expected.dev &&
      after.ino === expected.inode &&
      before.mode === after.mode &&
      before.mode === expected.mode &&
      after.mode === expected.mode &&
      (!executable || (after.mode & 0o111) !== 0) &&
      sha256(bytes) === expected.sha256,
    'changed executable/artifact bytes, inode or mode',
  );
}

async function resolvedCommand(fs, environment, command, expected) {
  for (const directory of environment.PATH.split(':')) {
    const path = join(directory, command);
    let stat;
    try {
      stat = await fs.stat(path);
    } catch (error) {
      if (error?.code === 'ENOENT' || /^ENOENT /.test(error?.message ?? ''))
        continue;
      throw error;
    }
    if (!stat.isFile() || (stat.mode & 0o111) === 0) continue;
    requireFact(
      (await fs.realpath(path)) === expected.path,
      `foreign PATH ${command}`,
    );
    return;
  }
  requireFact(false, `missing PATH ${command}`);
}

export async function verifyExecutables(fs, binding) {
  assertBinding(binding);
  await verifyIngress(fs, binding.ingress);
  for (const expected of Object.values(binding.executables))
    await verifyFile(fs, expected, true);
  await verifyFile(fs, binding.artifacts.launcher, false);
  requireFact(
    (await fs.realpath('/bin/sh')) === binding.executables.shell.path &&
      (await fs.realpath(binding.artifacts.launcher.invokedPath)) === script,
    'changed shell or package launcher link',
  );
  let sibling;
  try {
    sibling = await fs.stat(join(dirname(SUPABASE), 'node'));
  } catch (error) {
    if (error?.code !== 'ENOENT' && !/^ENOENT /.test(error?.message ?? ''))
      throw error;
  }
  requireFact(
    !sibling || (sibling.mode & 0o111) === 0,
    'unexpected shim-local Node override',
  );
  await resolvedCommand(
    fs,
    binding.environment,
    'node',
    binding.executables.node,
  );
  await resolvedCommand(
    fs,
    binding.environment,
    'docker',
    binding.executables.docker,
  );
  await verifyIngress(fs, binding.ingress);
}
