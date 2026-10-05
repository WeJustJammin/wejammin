import {
  invalidError,
  routeError,
  type UploadCompletionBodyResult,
  type UploadCompletionRouteError,
} from './upload-intent-completion-types';

export const parseContentLength = (
  request: Request,
  maxBodyBytes: number,
): UploadCompletionRouteError | null => {
  const value = request.headers.get('content-length');
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return invalidError();
  const length = Number(value);
  if (!Number.isSafeInteger(length)) return invalidError();
  if (length > maxBodyBytes) {
    return routeError(
      'PAYLOAD_TOO_LARGE',
      413,
      'The upload completion request is too large.',
      { maxBytes: maxBodyBytes },
    );
  }
  return null;
};

export const readJsonBody = async (
  request: Request,
  maxBodyBytes: number,
  signal: AbortSignal,
): Promise<UploadCompletionBodyResult> => {
  const lengthError = parseContentLength(request, maxBodyBytes);
  if (lengthError !== null) return { error: lengthError, kind: 'error' };
  if (request.body === null) return { error: invalidError(), kind: 'error' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error('request deadline exceeded');
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return {
          error: routeError(
            'PAYLOAD_TOO_LARGE',
            413,
            'The upload completion request is too large.',
            { maxBytes: maxBodyBytes },
          ),
          kind: 'error',
        };
      }
      chunks.push(next.value);
    }
  } catch (error) {
    if (signal.aborted) throw error;
    return { error: invalidError(), kind: 'error' };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    return { error: invalidError(), kind: 'error' };
  }
  try {
    return { kind: 'body', value: JSON.parse(text) as unknown };
  } catch {
    return { error: invalidError(), kind: 'error' };
  }
};

export const DEADLINE = Symbol('upload-completion-deadline');

export type DeadlineRecovery = () => Promise<void> | void;

type DeadlineState = {
  timedOut: boolean;
  timeoutRecovery: DeadlineRecovery | undefined;
  timeoutRecoveryPromise: Promise<void>;
};

const RECOVERY_DEADLINE_MS = 1_000;
const deadlineStates = new WeakMap<AbortSignal, DeadlineState>();

/** Registers the durable recovery that must run if the command times out. */
export const registerDeadlineRecovery = (
  signal: AbortSignal,
  recovery: DeadlineRecovery,
): void => {
  const state = deadlineStates.get(signal);
  if (state === undefined) return;
  state.timeoutRecovery = recovery;
};

const runBoundedRecovery = (
  recovery: DeadlineRecovery | undefined,
): Promise<void> => {
  const operation = Promise.resolve()
    .then(() => recovery?.())
    .then(
      () => undefined,
      () => undefined,
    );
  let resolveTimeout!: () => void;
  const timeout = new Promise<void>((resolve) => {
    resolveTimeout = resolve;
  });
  const timer = setTimeout(() => resolveTimeout(), RECOVERY_DEADLINE_MS);
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
};

export const runWithDeadline = async <T>(
  operation: (
    signal: AbortSignal,
    registerRecovery: (recovery: DeadlineRecovery) => void,
  ) => Promise<T>,
  deadlineMs: number,
): Promise<T | typeof DEADLINE> => {
  const controller = new AbortController();
  const state: DeadlineState = {
    timedOut: false,
    timeoutRecovery: undefined,
    timeoutRecoveryPromise: Promise.resolve(),
  };
  deadlineStates.set(controller.signal, state);
  let resolveDeadline!: (value: typeof DEADLINE) => void;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {
    resolveDeadline = resolve;
  });
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
    state.timeoutRecoveryPromise = runBoundedRecovery(state.timeoutRecovery);
    void state.timeoutRecoveryPromise.then(() => resolveDeadline(DEADLINE));
  }, deadlineMs);
  const operationResult = Promise.resolve()
    .then(() =>
      operation(controller.signal, (recovery) =>
        registerDeadlineRecovery(controller.signal, recovery),
      ),
    )
    .then(
      (value) => {
        if (!state.timedOut) return value;
        return state.timeoutRecoveryPromise.then(() => {
          throw new Error('upload completion deadline exceeded');
        });
      },
      (error: unknown) => {
        if (!state.timedOut) throw error;
        return state.timeoutRecoveryPromise.then(() => {
          throw new Error('upload completion deadline exceeded');
        });
      },
    );
  try {
    return await Promise.race([operationResult, deadline]);
  } finally {
    clearTimeout(timer);
    deadlineStates.delete(controller.signal);
  }
};
