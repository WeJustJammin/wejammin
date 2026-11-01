import { Buffer } from 'node:buffer';

import type { Child } from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import { supabaseBinary } from './phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures';
import { hostBindingFixture } from './phase-02-slice-11-delivery-receiving-upgrade-host-binding-fixtures';
import {
  image,
  type smallLocal,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

type Local = Awaited<ReturnType<typeof smallLocal>>;

// Small raw unit images, not real binaries or native execution evidence.
// Installed shim execs Node in the same PID; JS spawns compiled TS/Bun.
// v2.116.0 bin.ts:25–81; reset.layers.ts:24–27; container-cli.ts:72–77.
export async function launcherFixture(
  mock: Local,
  child: Child,
  args: string[],
) {
  const { binding, executables, native, invokedScript, fs } =
    await hostBindingFixture(mock);
  const nodeProcess = {
    pid: child.pid,
    parentPid: mock.process.pid,
    startTicks: '45001',
    executable: executables.node,
    argv: ['node', invokedScript, ...args],
  };
  const bunProcess = {
    pid: 9002,
    parentPid: child.pid,
    startTicks: '45002',
    executable: executables.native,
    argv: [native, ...args],
  };
  const command = (
    pid: number,
    argv: string[],
    id: string,
    stdout: Buffer,
  ) => ({
    pid,
    parentPid: bunProcess.pid,
    startTicks: String(45000 + pid - 9000),
    executable: executables.docker,
    argv,
    resolvedContainerId: id,
    status: 0,
    stdout,
  });
  const commands = [
    command(
      9003,
      ['container', 'rm', '-f', mock.plan.target.container],
      image(0).containerId,
      Buffer.from(mock.plan.target.container + '\n'),
    ),
    command(
      9004,
      [
        'create',
        '--name',
        mock.plan.target.container,
        '--label',
        'com.supabase.cli.project=wejammin_ev',
        'postgres:17',
      ],
      image(1).containerId,
      Buffer.from(image(1).containerId + '\n'),
    ),
    // Official reset SIDE_EFFECTS.md: gateway reload, not a fabricated DB job.
    command(
      9005,
      [
        'exec',
        'supabase_kong_wejammin_ev',
        'kong',
        'reload',
        '--nginx-conf',
        '/home/kong/custom_nginx.template',
      ],
      'd'.repeat(64),
      Buffer.alloc(0),
    ),
  ];
  const processes = [nodeProcess, bunProcess, ...commands];
  const procImage = (process: typeof nodeProcess) => {
    // PATH exec preserves argv0 only for this known Node process image.
    const argv =
      process.pid === nodeProcess.pid ||
      process.argv[0] === process.executable.path
        ? process.argv
        : [process.executable.path, ...process.argv];
    return {
      status: Buffer.from(
        `Pid:\t${process.pid}\nPPid:\t${process.parentPid}\n`,
      ),
      stat: Buffer.from(
        `${process.pid} (unit-owned) S ${process.parentPid} ${Array(17).fill('0').join(' ')} ${process.startTicks} 0 0\n`,
      ),
      exe: process.executable.path,
      cmdline: Buffer.from(argv.join('\0') + '\0'),
    };
  };
  function install(process: typeof nodeProcess) {
    const raw = procImage(process);
    for (const [field, bytes] of Object.entries(raw)) {
      if (field === 'exe')
        mock.fs.put(`/proc/${process.pid}/exe`, { link: raw.exe });
      else
        mock.fs.put(`/proc/${process.pid}/${field}`, {
          bytes: bytes as Buffer,
        });
    }
  }
  const trace = {
    child: nodeProcess,
    execHistory: [
      {
        pid: child.pid,
        parentPid: mock.process.pid,
        startTicks: '45001',
        executable: executables.shell,
        argv: ['/bin/sh', supabaseBinary, ...args],
      },
      nodeProcess,
    ],
    nativeChild: bunProcess,
    processes: processes.map((process) => ({
      ...process,
      proc: procImage(process),
    })),
    daemon: { ...binding.daemon },
    commands,
    createResponse: {
      actorPid: 9004,
      status: 201,
      body: Buffer.from(
        JSON.stringify({
          Id: image(1).containerId,
          Warnings: [],
        }),
      ),
    },
    execResponse: {
      actorPid: 9005,
      containerId: 'd'.repeat(64),
      body: Buffer.from('{"Id":"unit-kong-exec"}'),
    },
  };
  const daemonWork = {
    execs: [
      {
        Id: 'unit-kong-exec',
        ContainerID: 'd'.repeat(64),
        Running: false,
        ExitCode: 0,
        Pid: 0,
      },
    ],
    jobs: [] as Array<{
      Id: string;
      Running: boolean;
      ExitCode: number | null;
    }>,
  };
  let live: typeof processes = [];
  function start() {
    live = processes.map((process) => ({ ...process }));
    for (const process of live) install(process);
  }
  function close(retainNative = false) {
    // Current /proc lifetime is separate from captured historical attribution.
    for (const process of processes) {
      for (const field of ['status', 'stat', 'exe', 'cmdline'])
        mock.fs.entries.delete(`/proc/${process.pid}/${field}`);
      mock.fs.entries.delete(`/proc/${process.pid}`);
    }
    live = retainNative ? [{ ...bunProcess, parentPid: 1 }] : [];
    for (const process of live) install(process);
  }
  async function faultArtifact(
    role: keyof typeof executables | 'launcher',
    kind: 'bytes' | 'identity',
  ) {
    const file =
      role === 'launcher' ? binding.artifacts.launcher : executables[role];
    const bytes = await mock.fs.readFile(file.path);
    mock.fs.put(
      file.path,
      {
        bytes:
          kind === 'bytes' ? Buffer.from('replacement unit artifact') : bytes,
      },
      kind === 'bytes' ? file.inode : file.inode + 10000,
    );
  }
  function faultTrace(fault: string) {
    if (fault === 'foreign parent') trace.commands[1]!.parentPid = 9999;
    if (fault === 'different daemon') trace.daemon.id = 'foreign-daemon';
    if (fault === 'foreign old ID')
      trace.commands[0]!.resolvedContainerId = 'f'.repeat(64);
    if (fault === 'foreign created ID')
      trace.commands[1]!.resolvedContainerId = 'f'.repeat(64);
    if (fault === 'response actor') trace.createResponse.actorPid = 9999;
    if (fault === 'response bytes') {
      trace.createResponse.body = Buffer.from(
        JSON.stringify({
          Id: 'f'.repeat(64),
          Warnings: [],
        }),
      );
    }
  }
  return {
    binding,
    fs,
    trace,
    daemonWork,
    start,
    close,
    faultArtifact,
    faultTrace,
    live: () => live,
  };
}
