import type { StepUpState } from '../components/identity-authority/step-up-mfa/step-up-phase';
import {
  resolvePlatformConfigurationPage,
  type PlatformConfigurationPageResult,
} from './platform-configuration-context';
import { readMfaFactorsForPage, type MfaFactorsRead } from './step-up-mfa-read';

export const ADMIN_MFA_RESET_CAPABILITY = 'admin.identity.mfa_reset';
/** FE05: the reset is the `tab=mfa-reset` tab of the admin workbench, not a route. */
export const ADMIN_MFA_RESET_ROUTE =
  '/app/platform-configuration-admin?tab=mfa-reset';

/**
 * FE05: the reset is a section of the admin workbench shown only to an actor
 * whose server capability snapshot names `admin.identity.mfa_reset` exactly.
 * The snapshot is the server's projection; a role label, a URL parameter or a
 * substring never selects the entry.
 */
export const showsAdminMfaResetEntry = (
  capabilitySnapshot: readonly string[],
): boolean => capabilitySnapshot.includes(ADMIN_MFA_RESET_CAPABILITY);

export type AdminMfaResetVariant = 'adminStepUp' | 'disabledPrerequisite';

export type AdminMfaResetPageResolution =
  | Readonly<{
      kind: 'ready';
      variant: AdminMfaResetVariant;
      stepUp: StepUpState;
      requestId: string;
    }>
  | Readonly<{ kind: 'unauthenticated'; location: string }>
  | Readonly<{ kind: 'not_found' }>
  | Readonly<{ kind: 'degraded'; requestId: string }>;

export type AdminMfaResetPageDeps = Readonly<{
  resolveConfiguration: typeof resolvePlatformConfigurationPage;
  readMfa: (
    request: Request,
    binding: unknown,
    requestId: string,
  ) => Promise<MfaFactorsRead>;
}>;

const defaultDeps: AdminMfaResetPageDeps = {
  resolveConfiguration: resolvePlatformConfigurationPage,
  readMfa: readMfaFactorsForPage,
};

const signIn = (): AdminMfaResetPageResolution => ({
  kind: 'unauthenticated',
  location: `/auth/sign-in?returnTo=${encodeURIComponent(ADMIN_MFA_RESET_ROUTE)}`,
});

const configurationOutcome = (
  result: PlatformConfigurationPageResult,
  requestId: string,
): AdminMfaResetPageResolution | null => {
  if (result.kind === 'unauthenticated') return signIn();
  if (result.kind !== 'ready') return { kind: 'not_found' };
  if (result.page.state === 'degraded') return { kind: 'degraded', requestId };
  // Every actor without the named capability gets the same 404, so the route
  // never confirms that the reset operation exists.
  return result.page.state === 'ready' &&
    result.page.capabilitySnapshot.includes(ADMIN_MFA_RESET_CAPABILITY)
    ? null
    : { kind: 'not_found' };
};

/**
 * FE05 `tab=mfa-reset` projection: capability comes only from the server's
 * capability snapshot, and step-up freshness from AUTH-API-16 is display-only
 * because the Worker re-checks both on the command.
 */
export const resolveAdminMfaResetPage = async (
  input: Readonly<{
    request: Request;
    binding: unknown;
    requestId: string;
    localApiOrigin?: string;
  }>,
  deps: AdminMfaResetPageDeps = defaultDeps,
): Promise<AdminMfaResetPageResolution> => {
  const configuration = await deps.resolveConfiguration({
    request: input.request,
    binding: input.binding,
    ...(input.localApiOrigin === undefined
      ? {}
      : { localApiOrigin: input.localApiOrigin }),
    key: null,
    requestId: input.requestId,
    surface: 'index',
    // The keyless index read returns an empty snapshot unless the dedicated,
    // acting-party-bound capability projection is requested.
    projectCapabilities: true,
  });
  const refused = configurationOutcome(configuration, input.requestId);
  if (refused !== null) return refused;
  const read = await deps.readMfa(
    input.request,
    input.binding,
    input.requestId,
  );
  if (read.kind === 'unauthenticated') return signIn();
  const stepUp: StepUpState =
    read.kind === 'ok'
      ? read.resource.stepUp
      : { fresh: false, freshUntil: null };
  return {
    kind: 'ready',
    variant: stepUp.fresh ? 'adminStepUp' : 'disabledPrerequisite',
    stepUp,
    requestId: input.requestId,
  };
};

/**
 * The workbench entry for `tab=mfa-reset`: resolves the projection only when the
 * tab was requested (any other tab reads nothing and returns null).
 */
export const resolveAdminMfaResetTab = async (
  input: Readonly<{
    requested: boolean;
    request: Request;
    binding: unknown;
    requestId: string;
    localApiOrigin?: string;
  }>,
): Promise<AdminMfaResetPageResolution | null> => {
  const { requested, ...page } = input;
  return requested ? resolveAdminMfaResetPage(page) : null;
};
