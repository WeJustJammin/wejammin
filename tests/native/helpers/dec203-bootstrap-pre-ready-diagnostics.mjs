import assert from 'node:assert/strict';
import {
  artifact,
  decimal,
  failure,
  keys,
  member,
  natural,
  positive,
  processRecord,
  sequence,
  wait,
} from './dec203-bootstrap-pre-ready-values.mjs';
export {
  artifact,
  keys,
  processRecord,
} from './dec203-bootstrap-pre-ready-values.mjs';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function descriptors(values) {
  assert.ok(Array.isArray(values) && values.length <= 64);
  let prior = -1;
  for (const value of values) {
    keys(value, [
      'fd',
      'target',
      'device',
      'inode',
      'mode',
      'uid',
      'gid',
      'flags',
      'pos',
      'pidfd',
    ]);
    natural(value.fd);
    assert.ok(value.fd > prior);
    prior = value.fd;
    assert.equal(typeof value.target, 'string');
    assert.ok(
      Buffer.byteLength(value.target) <= 512 && !/[\0\r\n]/.test(value.target),
    );
    decimal(value.device);
    decimal(value.inode, true);
    for (const key of ['mode', 'uid', 'gid']) natural(value[key]);
    assert.match(value.flags, /^0(?:[1-7][0-7]*)?$/);
    decimal(value.pos);
    if (value.pidfd !== null) {
      keys(value.pidfd, ['pid', 'nspid']);
      assert.ok(Number.isSafeInteger(value.pidfd.pid) && value.pidfd.pid >= -1);
      assert.ok(
        Array.isArray(value.pidfd.nspid) && value.pidfd.nspid.length <= 16,
      );
      value.pidfd.nspid.forEach(positive);
    }
  }
}

function locks(values) {
  assert.ok(Array.isArray(values) && values.length <= 4);
  let prior = 2;
  for (const value of values) {
    keys(value, ['fd', 'ownerPid', 'mode', 'device', 'inode', 'start', 'end']);
    assert.ok(Number.isInteger(value.fd) && value.fd > prior && value.fd <= 6);
    prior = value.fd;
    positive(value.ownerPid);
    member(value.mode, ['READ', 'WRITE']);
    decimal(value.device);
    decimal(value.inode, true);
    assert.equal(value.start, '0');
    assert.equal(value.end, 'EOF');
  }
}

function envelope(value) {
  keys(value, ['v', 'bootstrapId', 'seq', 'kind', 'body']);
  assert.equal(value.v, 1);
  assert.match(value.bootstrapId, uuid);
  sequence(value.seq);
}

function nativeFrame(body, id, sequences) {
  keys(body, ['direction', 'frame']);
  member(body.direction, ['O_TO_C', 'C_TO_O']);
  const frame = body.frame;
  envelope(frame);
  assert.equal(frame.bootstrapId, id);
  assert.ok(Buffer.byteLength(JSON.stringify(frame)) <= 4096);
  const next = (sequences.get(body.direction) ?? 0n) + 1n;
  assert.equal(BigInt(frame.seq), next);
  sequences.set(body.direction, next);
  const direction = ['INIT', 'START', 'CANCEL'].includes(frame.kind)
    ? 'O_TO_C'
    : 'C_TO_O';
  assert.equal(body.direction, direction);
  if (frame.kind === 'HELLO') {
    keys(frame.body, ['role']);
    assert.equal(frame.body.role, 'owner');
  } else if (frame.kind === 'CANCEL') {
    keys(frame.body, ['reason']);
    member(frame.body.reason, [
      'cancel',
      'timeout',
      'signal',
      'close',
      'protocol',
    ]);
  } else if (frame.kind === 'TERMINAL') {
    keys(frame.body, ['state', 'failure', 'exitCode', 'signal']);
    member(frame.body.state, ['drained', 'uncertain']);
    failure(frame.body.failure);
    wait({ exitCode: frame.body.exitCode, signal: frame.body.signal });
    if (frame.body.state === 'uncertain')
      assert.notEqual(frame.body.failure, null);
  } else {
    member(frame.kind, [
      'INIT',
      'LEASE_READY',
      'START',
      'ADOPTION_ACK',
      'CANCEL_ACK',
    ]);
    keys(frame.body, []);
  }
}

function recordBody(record, sequences) {
  const body = record.body;
  if (record.kind === 'artifact') {
    keys(body, ['phase', 'role', 'artifact']);
    member(body.phase, ['owner', 'lease']);
    member(body.role, [
      'node',
      'compiler',
      'source',
      'support',
      'header',
      'output',
    ]);
    artifact(body.artifact);
  } else if (record.kind === 'process') {
    keys(body, ['role', 'process']);
    member(body.role, [
      'owner-compiler',
      'owner',
      'coordinator',
      'lease-compiler',
    ]);
    processRecord(body.process);
  } else if (record.kind === 'inventory') {
    keys(body, ['phase', 'process', 'fds', 'locks']);
    member(body.phase, [
      'owner-leased',
      'coordinator-precompile',
      'lease-compiler-live',
      'coordinator-adopted',
    ]);
    processRecord(body.process);
    descriptors(body.fds);
    locks(body.locks);
  } else if (record.kind === 'compiler-terminal') {
    keys(body, [
      'phase',
      'process',
      'exitCode',
      'signal',
      'stdout',
      'stderr',
      'session',
    ]);
    assert.equal(body.phase, 'owner');
    processRecord(body.process);
    wait({ exitCode: body.exitCode, signal: body.signal });
    member(body.stdout, ['eof', 'error', 'pending']);
    member(body.stderr, ['eof', 'error', 'pending']);
    member(body.session, ['absent', 'present', 'unavailable']);
  } else if (record.kind === 'frame') {
    nativeFrame(body, record.bootstrapId, sequences);
  } else {
    assert.equal(record.kind, 'local-terminal');
    keys(body, ['state', 'failureCode', 'ownerWait', 'input', 'channels']);
    member(body.state, ['closed', 'uncertain']);
    failure(body.failureCode);
    if (body.state === 'uncertain') assert.notEqual(body.failureCode, null);
    if (body.ownerWait !== null) {
      keys(body.ownerWait, ['pid', 'startTime', 'exitCode', 'signal']);
      positive(body.ownerWait.pid);
      decimal(body.ownerWait.startTime, true);
      wait({
        exitCode: body.ownerWait.exitCode,
        signal: body.ownerWait.signal,
      });
    }
    member(body.input, ['eof', 'error', 'pending']);
    keys(body.channels, [
      'ownerInput',
      'ownerStdout',
      'ownerStderr',
      'commands',
      'events',
    ]);
    for (const name of ['ownerInput', 'commands'])
      member(body.channels[name], ['finished', 'error', 'pending']);
    for (const name of ['ownerStdout', 'ownerStderr', 'events'])
      member(body.channels[name], ['eof', 'error', 'pending']);
  }
}

export class Diagnostics {
  constructor() {
    this.pending = Buffer.alloc(0);
    this.bytes = 0;
    this.records = [];
    this.sequences = new Map();
  }

  push(bytes) {
    assert.ok(Buffer.isBuffer(bytes));
    this.bytes += bytes.length;
    assert.ok(this.bytes <= 1_048_576);
    this.pending = Buffer.concat([this.pending, bytes]);
    const added = [];
    for (;;) {
      const boundary = this.pending.indexOf(10);
      if (boundary < 0) break;
      assert.ok(boundary + 1 <= 65_536 && this.records.length < 256);
      const line = new TextDecoder('utf-8', { fatal: true }).decode(
        this.pending.subarray(0, boundary),
      );
      this.pending = this.pending.subarray(boundary + 1);
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        throw new Error('invalid diagnostic JSON');
      }
      envelope(record);
      assert.equal(BigInt(record.seq), BigInt(this.records.length + 1));
      if (this.records.length)
        assert.equal(record.bootstrapId, this.records[0].bootstrapId);
      recordBody(record, this.sequences);
      this.records.push(record);
      added.push(record);
    }
    assert.ok(this.pending.length < 65_536);
    return added;
  }

  end() {
    assert.equal(
      this.pending.length,
      0,
      'actual complete final diagnostic record required',
    );
    assert.ok(this.records.length > 0);
    return this.records;
  }
}
