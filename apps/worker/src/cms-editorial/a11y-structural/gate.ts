import { CMS_A11Y_CHECKER_TIMEOUT_MS } from '@wejammin/contracts';

import {
  runAccessibilityChecker,
  type AccessibilityCheckerRun,
} from './checker';
import {
  defaultGateSleep,
  openGateBudget,
  type GateSleep,
} from './gate-budget';
import {
  AccessibilityCheckerInputSchema,
  type AccessibilityCheckerInput,
} from './input-schema';

/*
 * The in-process `quality_gate_evaluate` call (BE05c "Gate use", DEC-134): the
 * Worker-resident accessibility preflight provider. One wall-clock budget
 * (100 to 2,000 ms, default 2,000) covers the idempotent input load, input
 * validation and evaluation. A gate call always runs the current checker fresh,
 * persists nothing (persistence is Slice 16) and never throws for an
 * operational failure: it returns a typed `failed` run, which the BE03b
 * command maps to an `unavailable` result (`checker_failed`, DEC-150).
 */

/** BE05c: the idempotent input load is retried once, after this pause, inside the deadline. */
export const ACCESSIBILITY_GATE_RETRY_DELAY_MS = 250;
/** BE05c timeoutMs range: 100 to 2,000 (the contract constant is the upper bound and the default). */
export const ACCESSIBILITY_GATE_TIMEOUT_MIN_MS = 100;

export type AccessibilityGateFailureCode =
  'CHECKER_TIMEOUT' | 'CHECKER_DEPENDENCY_UNAVAILABLE' | 'TARGET_UNREADABLE';

export type AccessibilityLoadResult =
  | Readonly<{ ok: true; input: unknown }>
  | Readonly<{
      ok: false;
      retryable: boolean;
      reason: 'dependency_unavailable' | 'target_unreadable';
    }>;

export type AccessibilityGateArgs = Readonly<{
  /** The read-only, idempotent input load; it should stop when the signal aborts. */
  load: (signal: AbortSignal) => Promise<AccessibilityLoadResult>;
  timeoutMs?: number;
  /** Milliseconds since the epoch; defaults to Date.now. */
  now?: () => number;
  sleep?: GateSleep;
  /** A parent signal; aborting it abandons the gate (reported as CHECKER_TIMEOUT). */
  signal?: AbortSignal;
}>;

type Timing = Readonly<{ durationMs: number; evaluatedAt: string }>;

export type AccessibilityGateCompleted = Readonly<{
  state: 'healthy' | 'blocked';
  result: AccessibilityCheckerRun;
  input: AccessibilityCheckerInput;
}> &
  Timing;

export type AccessibilityGateFailed = Readonly<{
  state: 'failed';
  failureCode: AccessibilityGateFailureCode;
}> &
  Timing;

export type AccessibilityGateRun =
  AccessibilityGateCompleted | AccessibilityGateFailed;

type GateOutcome =
  | Readonly<{ kind: 'failed'; code: AccessibilityGateFailureCode }>
  | Readonly<{
      kind: 'completed';
      run: AccessibilityCheckerRun;
      input: AccessibilityCheckerInput;
    }>;

const failure = (code: AccessibilityGateFailureCode): GateOutcome => ({
  kind: 'failed',
  code,
});
const TIMEOUT = failure('CHECKER_TIMEOUT');
const UNAVAILABLE: AccessibilityLoadResult = {
  ok: false,
  retryable: false,
  reason: 'dependency_unavailable',
};

export const evaluateAccessibilityGate = async (
  args: AccessibilityGateArgs,
): Promise<AccessibilityGateRun> => {
  const timeoutMs = args.timeoutMs ?? CMS_A11Y_CHECKER_TIMEOUT_MS;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < ACCESSIBILITY_GATE_TIMEOUT_MIN_MS ||
    timeoutMs > CMS_A11Y_CHECKER_TIMEOUT_MS
  )
    throw new RangeError(
      `timeoutMs must be an integer from ${ACCESSIBILITY_GATE_TIMEOUT_MIN_MS} to ${CMS_A11Y_CHECKER_TIMEOUT_MS}`,
    );
  const now = args.now ?? Date.now;
  const sleep = args.sleep ?? defaultGateSleep;
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  const budget = openGateBudget(timeoutMs, args.signal);
  const { signal } = budget;

  const attemptLoad = async (): Promise<AccessibilityLoadResult> => {
    // An aborted budget never starts another load; the gate reports the timeout.
    if (signal.aborted) return UNAVAILABLE;
    try {
      return await args.load(signal);
    } catch {
      return UNAVAILABLE;
    }
  };

  const loadWithRetry = async (): Promise<AccessibilityLoadResult> => {
    const first = await attemptLoad();
    if (first.ok || !first.retryable) return first;
    if (now() + ACCESSIBILITY_GATE_RETRY_DELAY_MS >= deadline) return first;
    try {
      await sleep(ACCESSIBILITY_GATE_RETRY_DELAY_MS, signal);
    } catch {
      return UNAVAILABLE;
    }
    return attemptLoad();
  };

  const evaluate = async (): Promise<GateOutcome> => {
    const loaded = await loadWithRetry();
    if (!loaded.ok)
      return failure(
        loaded.reason === 'target_unreadable'
          ? 'TARGET_UNREADABLE'
          : 'CHECKER_DEPENDENCY_UNAVAILABLE',
      );
    const parsed = AccessibilityCheckerInputSchema.safeParse(loaded.input);
    if (!parsed.success) return failure('TARGET_UNREADABLE');
    const run = await runAccessibilityChecker(parsed.data, {
      shouldStop: () => signal.aborted || now() >= deadline,
    });
    return run.state === 'stopped'
      ? TIMEOUT
      : { kind: 'completed', run, input: parsed.data };
  };

  try {
    const settled = await Promise.race([
      evaluate(),
      budget.expired.then((): GateOutcome => TIMEOUT),
    ]);
    const finishedAt = now();
    const outcome =
      signal.aborted || finishedAt >= deadline ? TIMEOUT : settled;
    const timing: Timing = {
      durationMs: Math.max(0, finishedAt - startedAt),
      evaluatedAt: new Date(finishedAt).toISOString(),
    };
    return outcome.kind === 'failed'
      ? { state: 'failed', failureCode: outcome.code, ...timing }
      : {
          state: outcome.run.state,
          result: outcome.run,
          input: outcome.input,
          ...timing,
        };
  } finally {
    budget.close();
  }
};
