/**
 * Shapes shared by the per-family claim-gate fixture modules.
 *
 * A fixture is the VALID request for one manifest entry: every member the
 * function checks before it resolves the caller is present and well formed, so
 * the first thing that can refuse the request is the identity gate itself.
 * The harness (claim-gate-check.ts) adds the caller's context and compares each
 * outcome exactly; a fixture states only what the function does for a real
 * caller once the gate has passed.
 */

/** `<status>:<message>`; a success is `200:` (PostgREST sends no error message). */
export type Outcome = string;

/**
 * A fixed request, or one built per call when the function persists something
 * for a real caller and a repeat would answer differently (a fresh id each time).
 */
export type RequestBuilder =
  Readonly<Record<string, unknown>> | (() => Readonly<Record<string, unknown>>);

export const requestOf = (
  builder: RequestBuilder,
): Readonly<Record<string, unknown>> =>
  typeof builder === 'function' ? builder() : builder;

export type GateFixture = Readonly<{
  /**
   * `p_request` members without `context`, or the named arguments of a
   * typed-argument function. The harness supplies `context` where the family
   * takes one.
   */
  request: RequestBuilder;
  /**
   * The exact outcome for a real caller (a real auth user with no person, for
   * `attacker` callers): the next domain step after the gate, never the gate's
   * own UNAUTHENTICATED.
   */
  real: Outcome;
  /** Differs from `real` only where the service-role path answers differently. */
  svcReal?: Outcome;
}>;

export type FixtureTable = Readonly<Record<string, GateFixture>>;

/** Version-4 UUIDs: the shared validators accept versions 1-8, the identity gate only 1-5. */
export const id = (n: number): string =>
  `0195b6f0-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const IDEMPOTENCY_KEY = 'api-gate-idempotency-key-0001';
export const HEX64 = 'a'.repeat(64);
export const FUTURE = '2030-01-01T00:00:00.000Z';
export const NOW = '2026-10-04T00:00:00.000Z';
