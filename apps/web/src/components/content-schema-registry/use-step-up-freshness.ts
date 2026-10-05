import * as React from 'react';

const FRESHNESS_WINDOW_MS = 10 * 60 * 1000;
const REFRESH_INTERVAL_MS = 30_000;

/** Strict ISO-8601 instant (`Date#toISOString` shape) or null. */
export const parseStepUpFreshUntil = (
  value: string | undefined,
): number | null => {
  if (value === undefined || value.length === 0 || value.trim() !== value)
    return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString() === value ? parsed : null;
};

/** A window is fresh only while in the future and within the policy bound. */
export const isStepUpFresh = (freshUntil: number, now: number): boolean =>
  freshUntil > now && freshUntil - now <= FRESHNESS_WINDOW_MS;

export const formatStepUpExpiry = (freshUntil: number): string => {
  const at = new Date(freshUntil);
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
};

/**
 * Presentation-only freshness of a server-issued absolute step-up expiry,
 * re-evaluated on a bounded timer and whenever the tab regains focus or
 * visibility, so a stale window can never render as an indefinite "Verified".
 * Commit authority remains the server POST.
 */
export const useStepUpFreshness = (
  freshUntil: string | undefined,
): { readonly fresh: boolean; readonly expiresAt: number | null } => {
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const refresh = (): void => setNow(Date.now());
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const parsed = parseStepUpFreshUntil(freshUntil);
  return {
    fresh: parsed !== null && isStepUpFresh(parsed, now),
    expiresAt: parsed,
  };
};
