import type {
  Cfg05b06MfaFactorResetRequest,
  RequestContext,
} from '@wejammin/contracts';

import type { WorkerBindings, WorkerDependencies } from '../index';
import type {
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';

export type PlatformConfigurationOperationId =
  | 'CFG-05A-01'
  | 'CFG-05A-02'
  | 'CFG-05A-03'
  | 'CFG-05A-04'
  | 'CFG-05B-01'
  | 'CFG-05B-04'
  | 'CFG-05B-05'
  | 'CFG-05B-06'
  | 'CFG-05B-07';

export type AdminOperationId = 'CFG-05B-01' | 'CFG-05B-04' | 'CFG-05B-05';

/**
 * Only boundary-validated values cross the worker/data port.  Actor and
 * acting-party identity are populated from the verified session or service
 * principal; callers never supply them as body fields.
 */
export type ConfigurationPortInput = Readonly<{
  operationId: PlatformConfigurationOperationId;
  request: Request;
  body?: Readonly<Record<string, unknown>>;
  path?: Readonly<Record<string, string>>;
  query?: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
  ifMatch?: string;
  session?: AuthenticationSession;
  servicePrincipalId?: string;
  serviceConsumerKey?: string;
}>;

export type ConfigurationPort = (
  input: ConfigurationPortInput,
  env: WorkerBindings,
  signal: AbortSignal,
) => Promise<AuthenticationResult<unknown>>;

/** Server-owned input for the admin workspace boundary. */
export type AdminWorkspacePortInput = Readonly<{
  operationId: AdminOperationId;
  request: Request;
  query?: Readonly<Record<string, unknown>>;
  body?: Readonly<Record<string, unknown>>;
  session: AuthenticationSession;
  requestContext: RequestContext;
  idempotencyKey?: string;
  ifMatch?: string;
}>;

export type AdminWorkspacePort = (
  input: AdminWorkspacePortInput,
  env: WorkerBindings,
  signal: AbortSignal,
) => Promise<AuthenticationResult<unknown>>;

/**
 * CFG-05B-06 (DEC-111 recovery). Only the single boundary-validated target
 * and reason cross the port; operator, organization and every factor
 * identifier are derived server-side from the verified session and the
 * database.
 */
export type AdminMfaFactorResetPortInput = Readonly<{
  request: Request;
  body: Cfg05b06MfaFactorResetRequest;
  session: AuthenticationSession;
  requestContext: RequestContext;
  idempotencyKey: string;
}>;

export type AdminMfaFactorResetPort = (
  input: AdminMfaFactorResetPortInput,
  env: WorkerBindings,
  signal: AbortSignal,
) => Promise<AuthenticationResult<unknown>>;

export type AdminWorkspaceDependencies = Readonly<{
  readInbox: AdminWorkspacePort;
  capabilityAction: AdminWorkspacePort;
  auditDiagnostic: AdminWorkspacePort;
  /** Optional recovery port; absent compositions fail closed with 503. */
  resetMfaFactors?: AdminMfaFactorResetPort;
}>;

/**
 * Identity returned by a verifier that has authenticated the inbound
 * release credential.  The route never promotes a header value to this
 * identity; it is populated only by the injected resolver.
 */
export type ConfigurationReleasePrincipal = Readonly<{
  principalId: string;
}>;

export type ConfigurationServiceConsumer = Readonly<{
  principalId: string;
  consumerKey: string;
}>;

export type ConfigurationReleasePrincipalResolver = (
  request: Request,
  env: WorkerBindings,
  signal: AbortSignal,
) => Promise<AuthenticationResult<ConfigurationReleasePrincipal>>;

export type ConfigurationServiceConsumerResolver = (
  request: Request,
  env: WorkerBindings,
  signal: AbortSignal,
) => Promise<AuthenticationResult<ConfigurationServiceConsumer>>;

/**
 * Reads the effective admin capability keys for a verified session.  This is
 * a server-only authority port: callers receive the verified session and the
 * original request, while browser-supplied role/capability headers remain
 * outside the input surface.
 */
export type ConfigurationCapabilityKeyReader = (
  session: AuthenticationSession,
  request: Request,
  env: WorkerBindings,
  signal: AbortSignal,
) => Promise<ReadonlyArray<string>>;

export type PlatformConfigurationDependencies = Readonly<{
  registerDefinition: ConfigurationPort;
  resolveEffectiveValue: ConfigurationPort;
  proposeChange: ConfigurationPort;
  changeAction: ConfigurationPort;
  /** Optional S08 admin ports; legacy S07 compositions fail closed. */
  readInbox?: AdminWorkspacePort;
  capabilityAction?: AdminWorkspacePort;
  auditDiagnostic?: AdminWorkspacePort;
  resetMfaFactors?: AdminMfaFactorResetPort;
  /** Required at runtime for service-consumer requests; optional in the
   * structural type so legacy test compositions fail closed instead of
   * gaining authority from headers. */
  resolveServiceConsumer?: ConfigurationServiceConsumerResolver;
  /** Required at runtime for release-registration requests; optional in the
   * structural type so legacy compositions fail closed. */
  resolveReleasePrincipal?: ConfigurationReleasePrincipalResolver;
  /** Server-owned context authority; never populated from browser headers. */
  resolveRequestContext?: WorkerDependencies['resolveRequestContext'];
  /** Server-owned capability authority used by the production context seam. */
  readCapabilityKeys?: ConfigurationCapabilityKeyReader;
}>;

/** Type intersection used until the root worker composition adds the field. */
export type ConfigurationWorkerDependencies = WorkerDependencies &
  Readonly<{
    platformConfiguration?: PlatformConfigurationDependencies;
  }>;

export type ConfigurationOutcome =
  | Readonly<{ ok: true; value: unknown; status: 200 | 201 | 202 }>
  | AuthenticationError;

export type ConfigurationRateLimit = AuthRateLimitDecision;
