/**
 * DEC-111 MFA provider circuit (BE01a "MFA provider seams"): five failures in
 * 60 seconds open it for 60 seconds. The user-facing Supabase Auth MFA adapter
 * and the operator-only admin adapter (CFG-05B-06) share one breaker per
 * Worker provider transport, so an unhealthy provider is refused by both.
 */
export const MFA_BREAKER_THRESHOLD = 5;
export const MFA_BREAKER_WINDOW_MS = 60_000;

export type MfaProviderBreaker = Readonly<{
  /** True while the circuit is open at `nowMs`. */
  isOpen: (nowMs: number) => boolean;
  recordFailure: (nowMs: number) => void;
}>;

const createBreaker = (): MfaProviderBreaker => {
  let failures: number[] = [];
  let openUntil = 0;
  return {
    isOpen: (nowMs) => nowMs < openUntil,
    recordFailure: (nowMs) => {
      failures = [...failures, nowMs].filter(
        (at) => nowMs - at < MFA_BREAKER_WINDOW_MS,
      );
      if (failures.length >= MFA_BREAKER_THRESHOLD) {
        openUntil = nowMs + MFA_BREAKER_WINDOW_MS;
        failures = [];
      }
    },
  };
};

const breakers = new WeakMap<object, MfaProviderBreaker>();

/**
 * One breaker per provider transport. Both adapters of a Worker composition
 * receive the same `fetch`, so keying on it shares the circuit between them
 * and keeps independently constructed transports (tests) isolated.
 */
export const mfaProviderBreakerFor = (
  transport: object,
): MfaProviderBreaker => {
  const existing = breakers.get(transport);
  if (existing !== undefined) return existing;
  const created = createBreaker();
  breakers.set(transport, created);
  return created;
};

const circuitOpenErrors = new WeakSet<object>();

/**
 * Tags the error returned because the circuit was open, so telemetry can
 * count circuit-open refusals without widening the public error details.
 */
export const markMfaCircuitOpen = <T extends object>(error: T): T => {
  circuitOpenErrors.add(error);
  return error;
};

export const isMfaCircuitOpenError = (error: object): boolean =>
  circuitOpenErrors.has(error);
