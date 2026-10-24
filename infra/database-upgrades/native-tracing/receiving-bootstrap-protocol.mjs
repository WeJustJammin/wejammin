import { constants } from 'node:os';
import {
  ERRORS,
  INPUT,
  NATIVE_FRAME_BYTES,
} from './receiving-bootstrap-profile.mjs';
import { ensure } from './receiving-bootstrap-resources.mjs';

export function protocol(condition, cause) {
  if (condition) return;
  const error = new Error('DEC203_SUPERVISOR_PROTOCOL', { cause });
  error.code = error.message;
  throw error;
}

export function anchored(before, after) {
  ensure(
    ['pid', 'startTime', 'ppid', 'uid', 'namespace'].every(
      (key) => before[key] === after[key],
    ),
  );
}

export function exactKeys(value, keys) {
  protocol(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  const own = Reflect.ownKeys(value);
  protocol(own.every((key) => typeof key === 'string'));
  protocol(JSON.stringify(own.sort()) === JSON.stringify([...keys].sort()));
}

export function validateWait(value, owner = false) {
  exactKeys(
    value,
    owner ? ['pid', 'startTime', 'exitCode', 'signal'] : ['exitCode', 'signal'],
  );
  if (owner) {
    protocol(Number.isSafeInteger(value.pid) && value.pid > 0);
    protocol(
      typeof value.startTime === 'string' &&
        /^(0|[1-9][0-9]*)$/.test(value.startTime),
    );
  }
  protocol(value.exitCode === null || Number.isSafeInteger(value.exitCode));
  protocol(
    value.signal === null ||
      (typeof value.signal === 'string' &&
        Object.hasOwn(constants.signals, value.signal)),
  );
  protocol(value.exitCode === null || value.signal === null);
}

export function validateNativeSettlement(value) {
  protocol(['work-terminal', 'uncertain'].includes(value.state));
  protocol(
    value.failure === null ||
      (value.failure instanceof Error &&
        ERRORS.includes(value.failure.code) &&
        value.failure.message === value.failure.code),
  );
}

export const cancelledOwnerTerminal = (acknowledged, terminal, wait) =>
  acknowledged &&
  terminal?.failure === 'DEC203_SUPERVISOR_CANCELLED' &&
  terminal?.exitCode === 0 &&
  terminal?.signal === null &&
  wait?.code === 0 &&
  wait.signal === null;

export function validateFrame(value, bootstrapId, direction) {
  protocol(direction === 'O_TO_C' || direction === 'C_TO_O');
  exactKeys(value, ['v', 'bootstrapId', 'seq', 'kind', 'body']);
  protocol(value.v === 1 && value.bootstrapId === bootstrapId);
  protocol(
    typeof value.bootstrapId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value.bootstrapId,
      ),
  );
  protocol(typeof value.seq === 'string' && /^[1-9][0-9]*$/.test(value.seq));
  protocol(BigInt(value.seq) <= 0xffffffffffffffffn);
  const permitted =
    direction === 'O_TO_C'
      ? ['INIT', 'START', 'CANCEL']
      : ['HELLO', 'LEASE_READY', 'ADOPTION_ACK', 'CANCEL_ACK', 'TERMINAL'];
  protocol(permitted.includes(value.kind));
  const body = value.body;
  if (value.kind === 'HELLO') {
    exactKeys(body, ['role']);
    protocol(body.role === 'owner');
  } else if (value.kind === 'CANCEL') {
    exactKeys(body, ['reason']);
    protocol(
      ['cancel', 'timeout', 'signal', 'close', 'protocol'].includes(
        body.reason,
      ),
    );
  } else if (value.kind === 'TERMINAL') {
    exactKeys(body, ['state', 'failure', 'exitCode', 'signal']);
    protocol(['drained', 'uncertain'].includes(body.state));
    protocol(body.failure === null || ERRORS.includes(body.failure));
    protocol(body.state !== 'uncertain' || body.failure !== null);
    validateWait({ exitCode: body.exitCode, signal: body.signal });
    protocol(
      body.state !== 'drained' ||
        body.exitCode !== null ||
        body.signal !== null,
    );
  } else exactKeys(body, []);
  return value;
}

function uniqueKeys(text) {
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{' || char === '[')
      stack.push(char === '{' ? new Set() : null);
    else if (char === '}' || char === ']') stack.pop();
    else if (char === '"') {
      const start = index;
      for (index += 1; index < text.length; index += 1) {
        if (text[index] === '\\') index += 1;
        else if (text[index] === '"') break;
      }
      let next = index + 1;
      while (/\s/.test(text[next] ?? '') && next < text.length) next += 1;
      if (text[next] === ':') {
        const keys = stack.at(-1);
        const key = JSON.parse(text.slice(start, index + 1));
        protocol(keys instanceof Set && !keys.has(key));
        keys.add(key);
      }
    }
  }
}

function decode(bytes, id, direction) {
  try {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const value = JSON.parse(text);
    uniqueKeys(text);
    validateFrame(value, id, direction);
    Object.freeze(value.body);
    return Object.freeze(value);
  } catch (error) {
    protocol(false, error);
  }
}

export function encodeFrame(value, id, direction) {
  validateFrame(value, id, direction);
  const payload = Buffer.from(JSON.stringify(value));
  protocol(payload.length > 0 && payload.length <= NATIVE_FRAME_BYTES);
  const wire = Buffer.alloc(payload.length + 4);
  wire.writeUInt32BE(payload.length);
  payload.copy(wire, 4);
  return wire;
}

export function createFrameDecoder(id, direction) {
  const header = Buffer.alloc(4);
  const payload = Buffer.alloc(NATIVE_FRAME_BYTES);
  let headerSize = 0;
  let payloadSize = 0;
  let length = 0;
  let seq = 0n;
  let failed = false;
  let ended = false;
  let feeding = false;
  return Object.freeze({
    *feed(bytes) {
      protocol(!failed && !ended && !feeding && Buffer.isBuffer(bytes));
      feeding = true;
      try {
        let offset = 0;
        while (offset < bytes.length) {
          if (headerSize < 4) {
            const count = Math.min(4 - headerSize, bytes.length - offset);
            bytes.copy(header, headerSize, offset, offset + count);
            headerSize += count;
            offset += count;
            if (headerSize !== 4) continue;
            length = header.readUInt32BE();
            protocol(length > 0 && length <= NATIVE_FRAME_BYTES);
          }
          const count = Math.min(length - payloadSize, bytes.length - offset);
          bytes.copy(payload, payloadSize, offset, offset + count);
          payloadSize += count;
          offset += count;
          if (payloadSize !== length) continue;
          const value = decode(payload.subarray(0, length), id, direction);
          protocol(BigInt(value.seq) === seq + 1n);
          seq += 1n;
          headerSize = 0;
          payloadSize = 0;
          length = 0;
          yield value;
        }
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        feeding = false;
      }
    },
    end() {
      protocol(!failed && !ended && !feeding);
      ended = true;
      protocol(headerSize === 0 && payloadSize === 0);
    },
    partial: () => headerSize !== 0 || payloadSize !== 0,
  });
}

export function createInputDecoder() {
  const expected = Buffer.from(INPUT);
  let offset = 0;
  let ended = false;
  let failed = false;
  return Object.freeze({
    feed(bytes) {
      protocol(!ended && !failed && Buffer.isBuffer(bytes));
      for (const byte of bytes) {
        if (offset >= expected.length || expected[offset] !== byte) {
          failed = true;
          protocol(false);
        }
        offset += 1;
      }
    },
    end() {
      protocol(!ended);
      ended = true;
      protocol(!failed && offset === expected.length);
    },
  });
}
