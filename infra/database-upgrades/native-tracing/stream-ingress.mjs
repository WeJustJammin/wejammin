import { buildStream } from './stream-ingress-build.mjs';
import {
  attemptAccept,
  attemptReceive,
  createStreamFacade,
} from './stream-ingress-facades.mjs';
import {
  closeOwner,
  markUnprovedConstruction,
  settleDemand,
} from './stream-ingress-ownership.mjs';

// One module-local demand-driven timer, never an alternate native socket reader.
const acceptors = new Set();
const receivers = new Set();
let timer;
let running = false;

function stopIdleTimer() {
  if (acceptors.size === 0 && receivers.size === 0 && timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
}

function stop(owner) {
  acceptors.delete(owner);
  for (const stream of owner.streams) receivers.delete(stream);
  stopIdleTimer();
}

function eligible(stream) {
  return (
    !stream.closed &&
    !stream.owner.closed &&
    stream.pending !== undefined &&
    stream.segments.size < 4 &&
    stream.owner.segmentCount < 32
  );
}

function wake(owner, changed) {
  if (changed?.kind === 'stream' && !eligible(changed))
    receivers.delete(changed);
  if (owner.closed) {
    stop(owner);
    return;
  }
  if (owner.pending && owner.streams.size < 16) acceptors.add(owner);
  else acceptors.delete(owner);
  for (const stream of owner.streams) {
    if (eligible(stream)) receivers.add(stream);
    else receivers.delete(stream);
  }
  stopIdleTimer();
  if (!running && timer === undefined && (acceptors.size || receivers.size)) {
    timer = setTimeout(turn, 10);
  }
}

function next(queue) {
  const entry = queue.values().next().value;
  queue.delete(entry);
  return entry;
}

function acceptTurn() {
  const count = Math.min(8, acceptors.size);
  for (let index = 0; index < count && acceptors.size; index++) {
    const owner = next(acceptors);
    if (!owner.closed && owner.pending && owner.streams.size < 16) {
      try {
        const result = attemptAccept(owner);
        if (result !== undefined) settleDemand(owner, false, result);
      } catch (cause) {
        settleDemand(owner, true, cause);
      }
    }
    wake(owner);
  }
}

function receiveTurn() {
  const count = Math.min(8, receivers.size);
  for (let index = 0; index < count && receivers.size; index++) {
    const stream = next(receivers);
    if (eligible(stream)) {
      try {
        const result = attemptReceive(stream);
        if (result !== undefined) settleDemand(stream, false, result);
      } catch (cause) {
        settleDemand(stream, true, cause);
      }
    }
    wake(stream.owner, stream);
  }
}

function turn() {
  timer = undefined;
  running = true;
  try {
    acceptTurn();
    receiveTurn();
  } finally {
    running = false;
    if (acceptors.size || receivers.size) timer = setTimeout(turn, 10);
  }
}

export async function buildNativeStreamIngress(options) {
  const build = await buildStream(options);
  let owner;
  try {
    owner = createStreamFacade(build);
    owner.wake = (changed) => wake(owner, changed);
    owner.stop = () => stop(owner);
    return owner.facade;
  } catch (cause) {
    const closing = owner
      ? closeOwner(owner, cause)
      : build.state.constructionCleanup;
    if (closing) {
      try {
        await closing;
      } catch (secondary) {
        build.state.failures.push(secondary);
        if (build.state.cleanupFailed) markUnprovedConstruction(build, cause);
      }
    }
    throw cause;
  }
}
