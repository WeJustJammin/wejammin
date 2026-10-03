import { stepUpHref } from './identity-authority/step-up-mfa/step-up-return';

/**
 * FE00 error-per-class (DEC-111), the one shared reading of a 401
 * `STEP_UP_REQUIRED` for every web transport and error mapper: it is step-up
 * navigation to `/step-up?returnTo=<current relative path>`, never a 403
 * capability gate and never a sign-in or re-authentication prompt. A plain 401
 * `UNAUTHENTICATED` keeps its own reauthentication handling.
 */

export const STEP_UP_REQUIRED_CODE = 'STEP_UP_REQUIRED';

/** A parsed error body names the step-up shortfall code. */
export const isStepUpRequiredBody = (payload: unknown): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  (payload as { readonly code?: unknown }).code === STEP_UP_REQUIRED_CODE;

/** True when the response is a 401 whose JSON body carries the step-up code. */
export const isStepUpRequiredResponse = async (
  response: Response,
): Promise<boolean> => {
  if (response.status !== 401) return false;
  try {
    return isStepUpRequiredBody(await response.clone().json());
  } catch {
    return false;
  }
};

export type RelativeLocation = Readonly<{ pathname: string; search: string }>;

/** The `/step-up?returnTo=` target for the page the person is on. */
export const stepUpTargetForLocation = (location: RelativeLocation): string =>
  stepUpHref(location.pathname, location.search);

/** Open the step-up page for the current browser location. */
export const navigateToStepUp = (): string => {
  const target = stepUpTargetForLocation(globalThis.location);
  globalThis.location.assign(target);
  return target;
};
