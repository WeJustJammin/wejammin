import { Buffer } from 'node:buffer';

import {
  exactKeys,
  hashText,
  isRecord,
  positivePid,
  requireFact,
} from './delivery-receiving-upgrade-target.mjs';
import {
  sameValue,
  snapshot,
} from './delivery-receiving-upgrade-host-request.mjs';

function argv(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && !item.includes('\0'))
  );
}

function processIdentity(value, executable, parent) {
  requireFact(
    isRecord(value) &&
      positivePid(value.pid) &&
      value.parentPid === parent &&
      typeof value.startTicks === 'string' &&
      /^[1-9][0-9]*$/.test(value.startTicks) &&
      sameValue(value.executable, executable) &&
      argv(value.argv),
    'unattributed process image',
  );
}

function rawProcess(value, nodePid) {
  const raw = value.proc;
  requireFact(
    exactKeys(raw, ['status', 'stat', 'exe', 'cmdline']) &&
      ['status', 'stat', 'cmdline'].every((key) => Buffer.isBuffer(raw[key])) &&
      raw.exe === value.executable.path,
    'missing captured raw process facts',
  );
  const status = raw.status.toString('utf8');
  const stat = raw.stat.toString('utf8');
  const match = /^(\d+) \(.*\) (.*)\s*$/.exec(stat.trim());
  const fields = match?.[2].trim().split(/\s+/);
  requireFact(
    Number(/^Pid:\s*(\d+)$/m.exec(status)?.[1]) === value.pid &&
      Number(/^PPid:\s*(\d+)$/m.exec(status)?.[1]) === value.parentPid &&
      Number(match?.[1]) === value.pid &&
      Number(fields?.[1]) === value.parentPid &&
      fields?.[19] === value.startTicks,
    'captured PID/ancestry/start-time mismatch',
  );
  const expected =
    value.pid === nodePid || value.argv[0] === value.executable.path
      ? value.argv
      : [value.executable.path, ...value.argv];
  requireFact(
    raw.cmdline.equals(Buffer.from(expected.join('\0') + '\0')),
    'captured raw argv mismatch',
  );
}

function responseBody(value) {
  requireFact(Buffer.isBuffer(value), 'raw daemon response bytes required');
  return JSON.parse(value.toString('utf8'));
}

function resetCommands(trace, request, binding, nativePid) {
  requireFact(
    Array.isArray(trace.commands) && trace.commands.length === 3,
    'complete controlled reset command trace required',
  );
  const [removed, created, gateway] = trace.commands;
  for (const command of trace.commands) {
    processIdentity(command, binding.executables.docker, nativePid);
    requireFact(
      command.status === 0 && Buffer.isBuffer(command.stdout),
      'Docker subprocess failed or lacked raw output',
    );
  }
  requireFact(
    sameValue(removed.argv, [
      'container',
      'rm',
      '-f',
      request.target.container,
    ]) &&
      removed.resolvedContainerId === request.priorIdentity.containerId &&
      removed.stdout.equals(Buffer.from(request.target.container + '\n')),
    'foreign removal operation',
  );
  const arguments_ = created.argv;
  requireFact(
    arguments_[0] === 'create' &&
      arguments_.filter((value) => value === '--name').length === 1 &&
      arguments_.filter((value) => value === '--label').length === 1 &&
      arguments_[arguments_.indexOf('--name') + 1] ===
        request.target.container &&
      arguments_[arguments_.indexOf('--label') + 1] ===
        `com.supabase.cli.project=${request.target.projectId}` &&
      !arguments_.some((value) =>
        /^(?:-H|--(?:context|host)(?:=|$))/.test(value),
      ) &&
      hashText(created.resolvedContainerId) &&
      created.resolvedContainerId !== request.priorIdentity.containerId &&
      created.stdout.equals(Buffer.from(created.resolvedContainerId + '\n')),
    'foreign creation operation',
  );
  requireFact(
    sameValue(gateway.argv, [
      'exec',
      `supabase_kong_${request.target.projectId}`,
      'kong',
      'reload',
      '--nginx-conf',
      '/home/kong/custom_nginx.template',
    ]) && hashText(gateway.resolvedContainerId),
    'foreign gateway operation',
  );
  const response = trace.createResponse;
  const body = responseBody(response?.body);
  requireFact(
    exactKeys(response, ['actorPid', 'status', 'body']) &&
      response.actorPid === created.pid &&
      response.status === 201 &&
      exactKeys(body, ['Id', 'Warnings']) &&
      body.Id === created.resolvedContainerId &&
      Array.isArray(body.Warnings) &&
      body.Warnings.every((warning) => typeof warning === 'string'),
    'creation response not attributable to owned actor',
  );
  const execution = trace.execResponse;
  const execBody = responseBody(execution?.body);
  requireFact(
    exactKeys(execution, ['actorPid', 'containerId', 'body']) &&
      execution.actorPid === gateway.pid &&
      execution.containerId === gateway.resolvedContainerId &&
      exactKeys(execBody, ['Id']) &&
      typeof execBody.Id === 'string' &&
      execBody.Id.length > 0,
    'gateway exec response not attributable to owned actor',
  );
  return {
    createdId: created.resolvedContainerId,
    execs: [{ Id: execBody.Id, ContainerID: execution.containerId }],
  };
}

// Historical capture and current lifetime are deliberately different observations.
export function validateTrace(trace, deps, request, child) {
  requireFact(
    exactKeys(trace, [
      'child',
      'execHistory',
      'nativeChild',
      'processes',
      'daemon',
      'commands',
      'createResponse',
      'execResponse',
    ]) && sameValue(trace.daemon, deps.binding.daemon),
    'foreign or incomplete causal trace',
  );
  const binding = deps.binding;
  const node = trace.child;
  processIdentity(node, binding.executables.node, deps.process.pid);
  requireFact(
    node.pid === child.pid &&
      sameValue(node.argv, [
        'node',
        binding.artifacts.launcher.invokedPath,
        ...request.command.args,
      ]),
    'actual Node launcher/request mismatch',
  );
  requireFact(
    Array.isArray(trace.execHistory) && trace.execHistory.length === 2,
    'shell-to-Node exec history missing',
  );
  const [shell, recordedNode] = trace.execHistory;
  processIdentity(shell, binding.executables.shell, deps.process.pid);
  requireFact(
    shell.pid === node.pid &&
      shell.startTicks === node.startTicks &&
      sameValue(shell.argv, [
        '/bin/sh',
        request.command.command,
        ...request.command.args,
      ]) &&
      sameValue(recordedNode, node),
    'foreign shell-to-Node chain',
  );
  const native = trace.nativeChild;
  processIdentity(native, binding.executables.native, node.pid);
  requireFact(
    sameValue(native.argv, [
      binding.executables.native.path,
      ...request.command.args,
    ]),
    'compiled launcher argv mismatch',
  );
  const attribution = resetCommands(trace, request, binding, native.pid);
  const expected = [node, native, ...trace.commands];
  requireFact(
    Array.isArray(trace.processes) &&
      trace.processes.length === expected.length,
    'historical process capture incomplete',
  );
  const seen = new Set();
  expected.forEach((process, index) => {
    const captured = trace.processes[index];
    requireFact(
      !seen.has(process.pid) && isRecord(captured),
      'duplicate historical process',
    );
    seen.add(process.pid);
    for (const key of [
      'pid',
      'parentPid',
      'startTicks',
      'executable',
      'argv',
    ]) {
      requireFact(
        sameValue(captured[key], process[key]),
        'process/command capture mismatch',
      );
    }
    rawProcess(captured, node.pid);
  });
  return snapshot({ ...attribution, processes: trace.processes });
}
