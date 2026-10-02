import { AuthReturnTargetSchema } from '@wejammin/contracts';

export const STEP_UP_ROUTE = '/step-up';
export const MFA_SETTINGS_ROUTE = '/settings/security/mfa';

const FALLBACK_RETURN_TO = '/app';
const MAX_RETURN_TO_LENGTH = 512;

const pathOf = (value: string): string => value.split(/[?#]/u, 1)[0] ?? '';

const isStepUpOrAuthPath = (path: string): boolean =>
  path === STEP_UP_ROUTE ||
  path.startsWith(`${STEP_UP_ROUTE}/`) ||
  path === '/auth' ||
  path.startsWith('/auth/');

/**
 * FE01 `/step-up`: `returnTo` is a relative first-party path (1-512
 * characters, code-owned route families, no ambiguous encoding) that is not
 * `/step-up` or under `/auth/`; anything else becomes `/app`.
 */
export const resolveStepUpReturnTo = (
  raw: string | null | undefined,
): string => {
  if (typeof raw !== 'string') return FALLBACK_RETURN_TO;
  if (!AuthReturnTargetSchema.safeParse(raw).success) return FALLBACK_RETURN_TO;
  return isStepUpOrAuthPath(pathOf(raw)) ? FALLBACK_RETURN_TO : raw;
};

/**
 * The `returnTo` a protected form sends when it is interrupted: its current
 * path plus query, the path alone when that combined value is not usable
 * (for example longer than 512 characters), and `/app` when even the path is
 * not usable.
 */
export const computeStepUpReturnTo = (path: string, search = ''): string => {
  const combined = `${path}${search}`;
  const resolved = resolveStepUpReturnTo(combined);
  if (resolved === combined) return combined;
  return resolveStepUpReturnTo(path);
};

/** The browser target for a 401 `STEP_UP_REQUIRED`. */
export const stepUpHref = (path: string, search = ''): string =>
  `${STEP_UP_ROUTE}?returnTo=${encodeURIComponent(computeStepUpReturnTo(path, search))}`;

/** The first-authenticator enrollment page, optionally returning afterwards. */
export const mfaSettingsHref = (returnTo: string | null): string =>
  returnTo === null
    ? MFA_SETTINGS_ROUTE
    : `${MFA_SETTINGS_ROUTE}?returnTo=${encodeURIComponent(resolveStepUpReturnTo(returnTo))}`;

/**
 * Sign-in redirect that carries `/step-up?returnTo=...`; when that combined
 * value exceeds 512 characters only `/step-up` is carried.
 */
export const stepUpSignInHref = (returnTo: string): string => {
  const nested = `${STEP_UP_ROUTE}?returnTo=${encodeURIComponent(resolveStepUpReturnTo(returnTo))}`;
  const carried =
    nested.length > MAX_RETURN_TO_LENGTH ? STEP_UP_ROUTE : nested;
  return `/auth/sign-in?returnTo=${encodeURIComponent(carried)}`;
};
