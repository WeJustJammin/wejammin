import * as React from 'react';

const FRESHNESS_WINDOW_MS = 10 * 60 * 1000;

export interface ContentSchemaRegistryStepUpDisclosureProps {
  /** Server-derived absolute expiry of the verified step-up window. */
  readonly freshUntil?: string | undefined;
  /**
   * Invoked after commit when a previously-fresh window becomes invalid (timer
   * or focus/visibility re-evaluation). Lets the parent reset acknowledgement
   * without a second timer or any serialized authority.
   */
  readonly onExpired?: (() => void) | undefined;
}

const parseFreshUntil = (value: string | undefined): number | null => {
  if (value === undefined || value.length === 0 || value.trim() !== value)
    return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString() === value ? parsed : null;
};

const isFresh = (freshUntil: number, now: number): boolean =>
  freshUntil > now && freshUntil - now <= FRESHNESS_WINDOW_MS;

const formatExpiry = (freshUntil: number): string => {
  const at = new Date(freshUntil);
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
};

/**
 * Presentation-only step-up disclosure. The state is derived from the
 * server-issued absolute expiry, re-evaluated on a bounded timer and whenever
 * the tab regains focus or visibility, so a stale window can never render as
 * an indefinite "Verified". Commit authority remains the server POST.
 */
export function ContentSchemaRegistryStepUpDisclosure({
  freshUntil,
  onExpired,
}: ContentSchemaRegistryStepUpDisclosureProps): React.ReactElement {
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const refresh = (): void => setNow(Date.now());
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const parsed = parseFreshUntil(freshUntil);
  const fresh = parsed !== null && isFresh(parsed, now);
  const previousFreshRef = React.useRef(fresh);
  React.useEffect(() => {
    if (previousFreshRef.current && !fresh) onExpired?.();
    previousFreshRef.current = fresh;
  }, [fresh, onExpired]);
  if (!fresh) return <span>Step-up required before commit</span>;
  return <span>{`Verified until ${formatExpiry(parsed)}`}</span>;
}

export default ContentSchemaRegistryStepUpDisclosure;
