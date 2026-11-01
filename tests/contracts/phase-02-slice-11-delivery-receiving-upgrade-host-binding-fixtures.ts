import { Buffer } from 'node:buffer';
import { getuid } from 'node:process';

import { supabaseBinary } from './phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures';
import {
  hash,
  type smallLocal,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

type Local = Awaited<ReturnType<typeof smallLocal>>;
const modules =
  '/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules';
const script = `${modules}/.pnpm/supabase@2.116.0/node_modules/supabase/dist/supabase.js`;
const native = `${modules}/.pnpm/@supabase+cli-linux-x64@2.116.0/node_modules/@supabase/cli-linux-x64/bin/supabase`;
const invokedScript = `${modules}/.bin/../supabase/dist/supabase.js`;
const elf = (label: string) =>
  Buffer.concat([Buffer.from([127, 69, 76, 70]), Buffer.from(label)]);

function ingressFilesystem(fs: Local['fs'], uid: number) {
  // Independent raw unit facts, never generated from the mutable binding DTO.
  const raw = new Map([
    [
      '/unit/dec203-host-private-01',
      {
        device: 9007199254740993n,
        inode: 9007199254740997n,
        mode: 0o040700,
        kind: 'directory',
      },
    ],
    [
      '/unit/dec203-host-private-01/docker.sock',
      {
        device: 9007199254740993n,
        inode: 9007199254741009n,
        mode: 0o140600,
        kind: 'socket',
      },
    ],
  ]);
  function observe(path: string, bigint = false) {
    const value = raw.get(path)!;
    return {
      dev: bigint ? value.device : Number(value.device),
      ino: bigint ? value.inode : Number(value.inode),
      mode: bigint ? BigInt(value.mode) : value.mode,
      uid: bigint ? BigInt(uid) : uid,
      isDirectory: () => value.kind === 'directory',
      isSocket: () => value.kind === 'socket',
      isFile: () => false,
      isSymbolicLink: () => false,
    };
  }
  function readFile(path: string): Promise<Buffer>;
  function readFile(path: string, encoding: string): Promise<string>;
  function readFile(path: string, encoding?: string) {
    return encoding === undefined
      ? fs.readFile(path)
      : fs.readFile(path, encoding);
  }
  function rawStat(
    method: 'lstat' | 'stat',
    path: string,
    options?: { bigint?: boolean },
  ) {
    const current: (
      this: Local['fs'],
      path: string,
      options?: { bigint?: boolean },
    ) => ReturnType<Local['fs']['lstat']> = fs[method];
    return current.call(fs, path, options);
  }
  // Dynamic delegation preserves later artifact faults and original staging state.
  return {
    readFile,
    lstat: async (path: string, options?: { bigint?: boolean }) =>
      raw.has(path)
        ? observe(path, options?.bigint)
        : rawStat('lstat', path, options),
    stat: async (path: string, options?: { bigint?: boolean }) =>
      raw.has(path)
        ? observe(path, options?.bigint)
        : rawStat('stat', path, options),
    realpath: async (path: string) =>
      raw.has(path) ? path : fs.realpath(path),
    readdir: (path: string) => fs.readdir(path),
    readlink: (path: string) => fs.readlink(path),
    mkdtemp: (prefix: string) => fs.mkdtemp(prefix),
    mkdir: (path: string) => fs.mkdir(path),
    writeFile: (path: string, bytes: Buffer | string) =>
      fs.writeFile(path, bytes),
    copyFile: (from: string, to: string) => fs.copyFile(from, to),
    symlink: (link: string, path: string) => fs.symlink(link, path),
    rename: (from: string, to: string) => fs.rename(from, to),
    unlink: (path: string) => fs.unlink(path),
    rmdir: (path: string) => fs.rmdir(path),
  };
}

// Raw fixture setup only: no production validator, process or native filesystem.
export async function hostBindingFixture(mock: Local) {
  const files = {
    supabase: {
      path: supabaseBinary,
      bytes: Buffer.from('#!/bin/sh\n# unit image of attested pnpm shim\n'),
    },
    shell: { path: '/unit/trusted/sh', bytes: elf('unit-shell') },
    node: { path: '/unit/trusted/node', bytes: elf('unit-node-22.23.1') },
    native: { path: native, bytes: elf('unit-compiled-ts-bun-2.116.0') },
    docker: { path: '/unit/trusted/docker', bytes: elf('unit-docker') },
  };
  for (const file of Object.values(files))
    mock.fs.put(file.path, { bytes: file.bytes });
  mock.fs.put('/bin/sh', { link: files.shell.path });
  const js = Buffer.from('// unit image of attested JS package launcher\n');
  mock.fs.put(script, { bytes: js });
  mock.fs.put(`${modules}/supabase/dist/supabase.js`, { link: script });
  const lstat = mock.fs.lstat.bind(mock.fs);
  const executablePaths = new Set(
    Object.values(files).map((file) => file.path),
  );
  mock.fs.lstat = async (path: string) => ({
    ...(await lstat(path)),
    mode: executablePaths.has(path) ? 0o100755 : 0o100600,
  });
  const describe = async (file: { path: string; bytes: Buffer }) => {
    const stat = await mock.fs.lstat(file.path);
    return {
      path: file.path,
      sha256: hash(file.bytes),
      dev: stat.dev,
      inode: stat.ino,
      mode: stat.mode,
    };
  };
  const executables = {
    supabase: await describe(files.supabase),
    shell: await describe(files.shell),
    node: await describe(files.node),
    native: await describe(files.native),
    docker: await describe(files.docker),
  };
  const uid = getuid!();
  const ingress = {
    parent: {
      path: '/unit/dec203-host-private-01',
      device: '9007199254740993',
      inode: '9007199254740997',
      mode: 0o040700,
      uid,
    },
    socket: {
      path: '/unit/dec203-host-private-01/docker.sock',
      device: '9007199254740993',
      inode: '9007199254741009',
      mode: 0o140600,
      uid,
    },
    endpoint: 'unix:///unit/dec203-host-private-01/docker.sock',
    upstreamEndpoint: 'unix:///run/docker.sock',
  };
  const binding = {
    daemon: { id: 'unit-daemon-1', endpoint: 'unix:///run/docker.sock' },
    executables,
    artifacts: {
      launcher: {
        ...(await describe({ path: script, bytes: js })),
        invokedPath: invokedScript,
      },
    },
    package: {
      name: '@supabase/cli-linux-x64',
      version: '2.116.0',
      engine: 'compiled-ts-bun',
    },
    environment: {
      PATH: '/unit/trusted:/usr/bin:/bin',
      DOCKER_HOST: 'unix:///unit/dec203-host-private-01/docker.sock',
    },
    // Derived by the attested shim, never accepted from ambient input.
    derivedEnvironment: {
      NODE_PATH: `${modules}/.pnpm/supabase@2.116.0/node_modules/supabase/node_modules:${modules}/.pnpm/supabase@2.116.0/node_modules:${modules}/.pnpm/node_modules`,
    },
    dotenv: [] as string[],
    ingress,
  };
  return {
    binding,
    executables,
    native,
    invokedScript,
    fs: ingressFilesystem(mock.fs, uid),
  };
}
