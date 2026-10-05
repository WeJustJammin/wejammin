import {
  initialStepUpPhase,
  type MfaFactorSummary,
  type StepUpPhase,
  type StepUpState,
} from '../components/identity-authority/step-up-mfa/step-up-phase';
import {
  resolveStepUpReturnTo,
  stepUpSignInHref,
} from '../components/identity-authority/step-up-mfa/step-up-return';
import { readMfaFactorsForPage } from './step-up-mfa-read';

export type StepUpPageProps = Readonly<{
  returnTo: string;
  /** Verified factors only. */
  factors: readonly MfaFactorSummary[];
  allowedMethods: readonly 'totp'[];
  stepUp: StepUpState;
  initialPhase: StepUpPhase;
  requestId: string;
}>;

export type StepUpPageResolution =
  | Readonly<{ kind: 'ready'; page: StepUpPageProps }>
  | Readonly<{ kind: 'unauthenticated'; location: string }>
  | Readonly<{
      kind: 'degraded';
      reason: 'no-method' | 'unavailable';
      requestId: string;
      returnTo: string;
    }>;

/** FE01 `/step-up`: AUTH-API-16 rendered on the server, returnTo validated here. */
export const resolveStepUpPage = async (input: {
  request: Request;
  binding: unknown;
  returnToParam: string | null;
  requestId: string;
}): Promise<StepUpPageResolution> => {
  const returnTo = resolveStepUpReturnTo(input.returnToParam);
  const read = await readMfaFactorsForPage(
    input.request,
    input.binding,
    input.requestId,
  );
  if (read.kind === 'unauthenticated')
    return { kind: 'unauthenticated', location: stepUpSignInHref(returnTo) };
  if (read.kind === 'unavailable')
    return {
      kind: 'degraded',
      reason: 'unavailable',
      requestId: input.requestId,
      returnTo,
    };
  const { resource } = read;
  const allowsTotp = resource.allowedMethods.includes('totp');
  if (!allowsTotp)
    return {
      kind: 'degraded',
      reason: 'no-method',
      requestId: input.requestId,
      returnTo,
    };
  const factors = resource.factors.filter(
    (factor) => factor.state === 'verified',
  );
  return {
    kind: 'ready',
    page: {
      returnTo,
      factors,
      allowedMethods: ['totp'],
      stepUp: resource.stepUp,
      initialPhase: initialStepUpPhase(factors),
      requestId: input.requestId,
    },
  };
};
