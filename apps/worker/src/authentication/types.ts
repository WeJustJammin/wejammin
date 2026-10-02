import type {
  AuthCallbackQuery,
  AuthorizationStart,
  EmailStartRequest,
  JobStatus,
  LoginMethodsResource,
  LogoutRequest,
  MergeCaseResource,
  OAuthStartRequest,
  PersonBootstrapResource,
  ProviderCatalog,
  SessionResource,
} from '@wejammin/contracts';

import type { WorkerBindings } from '../worker-bindings';
import type { MfaAuthenticationMethods } from './mfa-types';
import type {
  AuthenticationResult,
  AuthenticationSession,
} from './result-types';

export type {
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from './result-types';

export type AuthRateLimitInput = Readonly<{
  operationId: string;
  request: Request;
  authUserId: string | null;
  /** Acting party is server-derived and separates shared-user buckets. */
  actingPartyId?: string | null;
  identifierDigest: string | null;
  limit: number;
  windowSeconds: number;
}>;

export type AuthRateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type AuthCallbackResult = Readonly<{
  location: string;
  cookies: readonly string[];
}>;

export type AuthBootstrapResult = Readonly<{
  created: boolean;
  resource: PersonBootstrapResource;
}>;

/**
 * Inputs to account-control operations are deliberately server-owned.  The
 * route boundary never accepts an actor, person, or session identifier from
 * the browser; it passes the complete session resolved from the verified
 * access token and the exact request metadata needed for the persistence CAS.
 */
export type AuthMutationInput = Readonly<{
  session: AuthenticationSession;
  idempotencyKey: string;
  ifMatch: string;
  request: Request;
}>;

export type LoginMethodLinkInput = AuthMutationInput &
  Readonly<{ provider: string; returnTo: string }>;

export type LoginMethodUnlinkInput = AuthMutationInput &
  Readonly<{ identityId: string; reason: string }>;

export type AccountMergeCreateInput = AuthMutationInput &
  Readonly<{ returnTo: string }>;

export type AccountMergeReadInput = Readonly<{
  session: AuthenticationSession;
  mergeId: string;
  request: Request;
}>;

export type AccountMergeProofInput = AuthMutationInput &
  Readonly<{ mergeId: string; provider: string; returnTo: string }>;

export type AccountMergeConfirmInput = AuthMutationInput &
  Readonly<{
    mergeId: string;
    conflictPlanVersion: string;
    acknowledgements: readonly string[];
  }>;

export type AuthenticationDependencies = MfaAuthenticationMethods &
  Readonly<{
    loadProviderCatalog: (
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<ProviderCatalog>>;
    startEmail: (
      input: EmailStartRequest,
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<
      AuthenticationResult<
        Readonly<{
          resource: Readonly<{ accepted: true }>;
          cookies: readonly string[];
        }>
      >
    >;
    startOAuth: (
      input: OAuthStartRequest,
      session: AuthenticationSession | null,
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<
      AuthenticationResult<
        Readonly<{
          resource: AuthorizationStart;
          cookies: readonly string[];
        }>
      >
    >;
    completeCallback: (
      input: AuthCallbackQuery,
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<AuthCallbackResult>>;
    resolveSession: (
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<AuthenticationSession>>;
    readSession: (
      session: AuthenticationSession,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<SessionResource>>;
    refreshSession: (
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<
      AuthenticationResult<
        Readonly<{
          resource: SessionResource;
          cookies: readonly string[];
        }>
      >
    >;
    bootstrap: (
      session: AuthenticationSession,
      idempotencyKey: string,
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<AuthBootstrapResult>>;
    logout: (
      session: AuthenticationSession,
      input: Required<LogoutRequest>,
      idempotencyKey: string,
      request: Request,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<
      AuthenticationResult<Readonly<{ cookies: readonly string[] }>>
    >;
    /** Account-control dependencies are optional for backwards-compatible
     * test/runtime composition; production composition supplies every method.
     * A route with a missing method fails closed with DEPENDENCY_UNAVAILABLE. */
    readLoginMethods?: (
      input: Readonly<{
        session: AuthenticationSession;
        request: Request;
      }>,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<LoginMethodsResource>>;
    startLoginMethodLink?: (
      input: LoginMethodLinkInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<
      AuthenticationResult<
        Readonly<{
          resource: AuthorizationStart;
          cookies: readonly string[];
        }>
      >
    >;
    unlinkLoginMethod?: (
      input: LoginMethodUnlinkInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<LoginMethodsResource>>;
    createAccountMerge?: (
      input: AccountMergeCreateInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<MergeCaseResource>>;
    readAccountMerge?: (
      input: AccountMergeReadInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<MergeCaseResource>>;
    startAccountMergeProof?: (
      input: AccountMergeProofInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<
      AuthenticationResult<
        Readonly<{
          resource: AuthorizationStart;
          cookies: readonly string[];
        }>
      >
    >;
    confirmAccountMerge?: (
      input: AccountMergeConfirmInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<JobStatus>>;
    rateLimit: (
      input: AuthRateLimitInput,
      env: WorkerBindings,
      signal: AbortSignal,
    ) => Promise<AuthenticationResult<AuthRateLimitDecision>>;
  }>;
