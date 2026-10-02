import type { MfaFactorSummary, StepUpState } from '../components/identity-authority/step-up-mfa/step-up-phase';
import {
  MFA_SETTINGS_ROUTE,
  resolveStepUpReturnTo,
} from '../components/identity-authority/step-up-mfa/step-up-return';
import { readMfaFactorsForPage } from './step-up-mfa-read';

export type MfaSettingsPageProps = Readonly<{
  returnTo: string | null;
  factors: readonly MfaFactorSummary[];
  allowedMethods: readonly 'totp'[];
  stepUp: StepUpState;
  expectedVersion: string;
  requestId: string;
}>;

export type MfaSettingsPageResolution =
  | Readonly<{ kind: 'ready'; page: MfaSettingsPageProps }>
  | Readonly<{ kind: 'unauthenticated'; location: string }>
  | Readonly<{ kind: 'degraded'; requestId: string }>;

/** Present and safe returns are kept; anything else means "no return target". */
const returnTarget = (param: string | null): string | null => {
  if (param === null) return null;
  const resolved = resolveStepUpReturnTo(param);
  return resolved === param ? param : null;
};

/** FE01 `/settings/security/mfa`: AUTH-API-16 rendered on the server. */
export const resolveMfaSettingsPage = async (input: {
  request: Request;
  binding: unknown;
  returnToParam: string | null;
  requestId: string;
}): Promise<MfaSettingsPageResolution> => {
  const read = await readMfaFactorsForPage(
    input.request,
    input.binding,
    input.requestId,
  );
  if (read.kind === 'unauthenticated')
    return {
      kind: 'unauthenticated',
      location: `/auth/sign-in?returnTo=${encodeURIComponent(MFA_SETTINGS_ROUTE)}`,
    };
  if (read.kind === 'unavailable')
    return { kind: 'degraded', requestId: input.requestId };
  const { resource, etagVersion } = read;
  return {
    kind: 'ready',
    page: {
      returnTo: returnTarget(input.returnToParam),
      factors: resource.factors,
      allowedMethods: resource.allowedMethods.includes('totp') ? ['totp'] : [],
      stepUp: resource.stepUp,
      expectedVersion: etagVersion ?? resource.version,
      requestId: input.requestId,
    },
  };
};
