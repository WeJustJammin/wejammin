import { Buffer } from 'node:buffer';

import {
  Child,
  type MemoryFs,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import type { harness } from './phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures';
import { image } from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

type Trace = Awaited<ReturnType<typeof harness>>['trace'];
type ProcessImage = Trace['processes'][number];

// Raw unit DTO copying only. Never call a production validator/transition builder.
export function copy<T>(value: T): T {
  if (Buffer.isBuffer(value)) return Buffer.from(value) as unknown as T;
  if (Array.isArray(value)) return value.map(copy) as unknown as T;
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, copy(item)]),
    ) as T;
  return value;
}

export function physical(index: number) {
  if (index < 3) return image(index);
  return {
    ...image(0),
    containerId: String(index - 2).repeat(64),
    clusterId: String(7697194000000000000n + BigInt(index)),
  };
}

function procImage(process: Omit<ProcessImage, 'proc'>, nodePid: number) {
  const argv =
    process.pid === nodePid || process.argv[0] === process.executable.path
      ? process.argv
      : [process.executable.path, ...process.argv];
  return {
    status: Buffer.from(`Pid:\t${process.pid}\nPPid:\t${process.parentPid}\n`),
    stat: Buffer.from(
      `${process.pid} (unit-cycle) S ${process.parentPid} ${Array(17).fill('0').join(' ')} ${process.startTicks} 0 0\n`,
    ),
    exe: process.executable.path,
    cmdline: Buffer.from(argv.join('\0') + '\0'),
  };
}

export function operation(
  template: Trace,
  fs: MemoryFs,
  index: number,
  hostPid: number,
  status = 0,
  signal: string | null = null,
) {
  const before = physical(index - 1);
  const after = physical(index);
  const child = new Child();
  child.pid = 9100 + index * 10 + 1;
  const trace = copy(template);
  const processes = [trace.child, trace.nativeChild, ...trace.commands];
  processes.forEach((process, offset) => {
    process.pid = child.pid + offset;
    process.parentPid =
      offset === 0 ? hostPid : offset === 1 ? child.pid : child.pid + 1;
    process.startTicks = String(50000 + index * 10 + offset);
  });
  Object.assign(trace.execHistory[0]!, {
    pid: child.pid,
    parentPid: hostPid,
    startTicks: trace.child.startTicks,
  });
  trace.execHistory[1] = copy(trace.child);
  trace.commands[0]!.resolvedContainerId = before.containerId;
  trace.commands[1]!.resolvedContainerId = after.containerId;
  trace.commands[1]!.stdout = Buffer.from(after.containerId + '\n');
  trace.createResponse = {
    actorPid: trace.commands[1]!.pid,
    status: 201,
    body: Buffer.from(JSON.stringify({ Id: after.containerId, Warnings: [] })),
  };
  const execId = `unit-cycle-exec-${index}`;
  trace.execResponse = {
    actorPid: trace.commands[2]!.pid,
    containerId: trace.commands[2]!.resolvedContainerId,
    body: Buffer.from(JSON.stringify({ Id: execId })),
  };
  trace.processes = processes.map((process) => ({
    ...copy(process),
    proc: procImage(process, child.pid),
  }));
  let live: ProcessImage[] = [];
  function start() {
    live = copy(trace.processes);
    for (const process of live) {
      const base = `/proc/${process.pid}`;
      fs.put(`${base}/status`, { bytes: process.proc.status });
      fs.put(`${base}/stat`, { bytes: process.proc.stat });
      fs.put(`${base}/exe`, { link: process.proc.exe });
      fs.put(`${base}/cmdline`, { bytes: process.proc.cmdline });
    }
  }
  function retire() {
    for (const process of live) {
      for (const field of ['status', 'stat', 'exe', 'cmdline'])
        fs.entries.delete(`/proc/${process.pid}/${field}`);
      fs.entries.delete(`/proc/${process.pid}`);
    }
    live = [];
  }
  return {
    child,
    trace,
    before,
    after,
    status,
    signal,
    start,
    retire,
    live: () => copy(live),
    daemon: {
      execs: [
        {
          Id: execId,
          ContainerID: trace.execResponse.containerId,
          Running: false,
          ExitCode: 0,
          Pid: 0,
        },
      ],
      jobs: [],
    },
  };
}

export type Operation = ReturnType<typeof operation>;
