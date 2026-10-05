import type {
  MfaFactorsResource,
  StepUpChallenge,
  StepUpResult,
  TotpEnrollmentStart,
} from '@wejammin/contracts';

import type { WorkerBindings } from '../worker-bindings';
import type {
  AuthenticationResult,
  AuthenticationSession,
} from './result-types';

/**
 * DEC-111 server-side ports. The browser never sees a provider token,
 * provider factor id or provider challenge id: those values live only in the
 * records and calls below, which are Worker-only.
 */
export type MfaFactorRow = MfaFactorsResource['factors'][number];

/** Local registry snapshot (no provider call) plus the MFA CAS version. */
export type MfaRegistrySnapshot = Readonly<{
  factors: readonly MfaFactorRow[];
  version: string;
}>;

type Caller = Readonly<{ authUserId: string; request: Request }>;

/**
 * The first-party session the aal2 proof rotates to. The settle RPCs carry it
 * so the database commits settlement AND rotation in one transaction: a
 * failed rotation rolls the settlement back, so the challenge or factor stays
 * recoverable and the caller never holds aal1 cookies beside a consumed proof.
 */
export type SessionRotationTarget = Readonly<{
  sessionId: string;
  issuedAt: string;
}>;

/** Protected registry and challenge state, one method per BE01a transaction. */
export type MfaPersistencePort = Readonly<{
  readFactors: (
    input: Caller,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaRegistrySnapshot>>;
  /** Transaction A: CAS, expire the pending row, bump the version. */
  beginEnrollment: (
    input: Caller & Readonly<{ friendlyName: string; expectedVersion: string }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{ supersededProviderFactorId: string | null; version: string }>
    >
  >;
  /** Transaction B: insert the pending row after provider enrollment. */
  finishEnrollment: (
    input: Caller &
      Readonly<{
        providerFactorId: string;
        friendlyName: string;
        expectedVersion: string;
        sessionId: string;
      }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{ factorId: string; expiresAt: string; version: string }>
    >
  >;
  prepareEnrollmentVerify: (
    input: Caller & Readonly<{ factorId: string; expectedVersion: string }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<Readonly<{ providerFactorId: string }>>>;
  /**
   * Charges one enrollment-verification failure to the account-wide budget
   * shared with the step-up verification (BE01a: ten failures in 15 minutes
   * lock both endpoints for 15 minutes). The lock itself is enforced by the
   * verify-prepare transactions, before any provider call.
   */
  recordVerificationFailure: (
    input: Caller & Readonly<{ outcome: 'ambiguous' | 'incorrect' }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<null>>;
  settleEnrollmentVerify: (
    input: Caller &
      Readonly<{
        factorId: string;
        expectedVersion: string;
        sessionId: string;
        rotation: SessionRotationTarget;
      }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaRegistrySnapshot>>;
  markFactorReconciling: (
    input: Caller & Readonly<{ factorId: string }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<null>>;
  beginRemoval: (
    input: Caller &
      Readonly<{
        factorId: string;
        reason: 'factor_compromise' | 'user_request';
        expectedVersion: string;
        idempotencyKey: string;
        sessionId: string;
      }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{
        providerFactorId: string;
        replay: MfaRegistrySnapshot | null;
      }>
    >
  >;
  finishRemoval: (
    input: Caller &
      Readonly<{
        factorId: string;
        reason: 'factor_compromise' | 'user_request';
        idempotencyKey: string;
        sessionId: string;
      }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaRegistrySnapshot>>;
  beginChallenge: (
    input: Caller &
      Readonly<{ sessionId: string; method: 'totp'; factorId: string | null }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{
        factorId: string;
        providerFactorId: string;
        friendlyName: string;
      }>
    >
  >;
  finishChallenge: (
    input: Caller &
      Readonly<{
        sessionId: string;
        factorId: string;
        providerChallengeId: string;
        expiresAt: string;
      }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<Readonly<{ challengeId: string; expiresAt: string }>>
  >;
  prepareChallengeVerify: (
    input: Caller & Readonly<{ sessionId: string; challengeId: string }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{
        factorId: string;
        providerFactorId: string;
        providerChallengeId: string;
        expiresAt: string;
      }>
    >
  >;
  /** `incorrect` keeps the challenge pending; `ambiguous` moves it to failed. */
  recordChallengeFailure: (
    input: Caller &
      Readonly<{
        sessionId: string;
        challengeId: string;
        outcome: 'ambiguous' | 'incorrect';
      }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<null>>;
  settleChallengeVerify: (
    input: Caller &
      Readonly<{
        sessionId: string;
        challengeId: string;
        rotation: SessionRotationTarget;
      }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<null>>;
}>;

/** Supabase Auth MFA adapter; every call carries the caller's own token. */
export type MfaProviderPort = Readonly<{
  enroll: (
    input: Readonly<{ request: Request; friendlyName: string }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{
        providerFactorId: string;
        otpauthUri: string;
        manualEntryKey: string;
      }>
    >
  >;
  /** Removing an already absent provider factor is a success. */
  unenroll: (
    input: Readonly<{ request: Request; providerFactorId: string }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<null>>;
  challenge: (
    input: Readonly<{ request: Request; providerFactorId: string }>,
    signal: AbortSignal,
  ) => Promise<
    AuthenticationResult<
      Readonly<{ providerChallengeId: string; expiresAt: string }>
    >
  >;
  /** Returns the raw provider session payload; never expose it. */
  verify: (
    input: Readonly<{
      request: Request;
      providerFactorId: string;
      providerChallengeId: string;
      code: string;
    }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<unknown>>;
}>;

/**
 * A verified aal2 session with its replacement cookies already sealed. Nothing
 * here has a remote effect: the rotation is committed by the settle RPC
 * (`rotation`), and nothing can fail between that commit and the response.
 */
export type ValidatedRotation = Readonly<{
  stepUpAt: string;
  freshUntil: string;
  rotation: SessionRotationTarget;
  cookies: readonly string[];
}>;

/**
 * Validates a provider aal2 session against the initiating session and seals
 * the replacement cookies. It has no persistent effect; the database commits
 * the index-row rotation inside the settle transaction.
 */
export type SessionRotationPort = Readonly<{
  validate: (
    input: Readonly<{
      session: AuthenticationSession;
      request: Request;
      payload: unknown;
    }>,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<ValidatedRotation>>;
}>;

export type MfaServiceDependencies = Readonly<{
  persistence: MfaPersistencePort;
  provider: MfaProviderPort;
  rotation: SessionRotationPort;
  now: () => number;
}>;

type MutationBase = Readonly<{
  session: AuthenticationSession;
  request: Request;
}>;

export type MfaCookieResult<T> = Readonly<{
  resource: T;
  cookies: readonly string[];
}>;

/** Optional methods on `AuthenticationDependencies`; absent => 503. */
export type MfaAuthenticationMethods = Readonly<{
  readMfaFactors?: (
    input: MutationBase,
    env: WorkerBindings,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaFactorsResource>>;
  startTotpEnrollment?: (
    input: MutationBase & Readonly<{ friendlyName: string; ifMatch: string }>,
    env: WorkerBindings,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<TotpEnrollmentStart>>;
  verifyTotpEnrollment?: (
    input: MutationBase &
      Readonly<{ factorId: string; code: string; ifMatch: string }>,
    env: WorkerBindings,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaCookieResult<MfaFactorsResource>>>;
  removeMfaFactor?: (
    input: MutationBase &
      Readonly<{
        factorId: string;
        reason: 'factor_compromise' | 'user_request';
        ifMatch: string;
        idempotencyKey: string;
      }>,
    env: WorkerBindings,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaFactorsResource>>;
  createStepUpChallenge?: (
    input: MutationBase & Readonly<{ method: 'totp'; factorId: string | null }>,
    env: WorkerBindings,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<StepUpChallenge>>;
  verifyStepUpChallenge?: (
    input: MutationBase & Readonly<{ challengeId: string; code: string }>,
    env: WorkerBindings,
    signal: AbortSignal,
  ) => Promise<AuthenticationResult<MfaCookieResult<StepUpResult>>>;
}>;
