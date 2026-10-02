import type { ContentSchemaRegistryCanonicalReadResult } from './content-schema-registry-canonical-read';
import { readContentSchemaRegistryCanonicalOutcome } from './content-schema-registry-canonical-read';
import {
  applyProjection,
  toDisabledProjection,
  type ContentSchemaRegistryProjectionState,
} from './content-schema-registry-canonical-state-validate';
import { captureContentSchemaRegistryFocus } from './content-schema-registry-runtime-dom-refetch-support';

/**
 * Bounded one-in-flight canonical refresh scheduler. Metadata bursts coalesce
 * into a single protected GET; a context change forces an immediate read while
 * the epoch guard discards the stale one. Loading, status and focus are applied
 * through React state, never by swapping DOM nodes.
 */

export const LOADING_DELAY_MS = 250;

/**
 * Pure platform navigation helper. Tests mock this named export directly
 * (partial module mock) rather than mutating production state.
 */
export const canonicalAuthNavigate = (target: string): void => {
  if (typeof window !== 'undefined') window.location.assign(target);
};

export type RefetchReason = 'list-read' | 'detail-read' | 'reconnect';
export type FocusLocator = ReturnType<typeof captureContentSchemaRegistryFocus>;

const reasonPriority: Record<RefetchReason, number> = {
  'list-read': 1,
  'detail-read': 2,
  reconnect: 3,
};

const mergeReason = (
  current: RefetchReason | null,
  next: RefetchReason,
): RefetchReason =>
  current === null || reasonPriority[next] > reasonPriority[current]
    ? next
    : current;

export interface SchedulerHost {
  readonly setLoading: (value: boolean) => void;
  readonly setMessage: (value: string | null) => void;
  readonly setProjection: (
    updater: (
      current: ContentSchemaRegistryProjectionState,
    ) => ContentSchemaRegistryProjectionState,
  ) => void;
  readonly setFocusLocator: (locator: FocusLocator) => void;
  /** Commit the fail-closed state, then navigate (synchronously committed). */
  readonly navigate: (target: string) => void;
}

export class CanonicalRefreshScheduler {
  private inFlight = false;
  private pendingReason: RefetchReason | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private epoch = 0;
  private url: string;

  constructor(
    private readonly host: SchedulerHost,
    initialUrl: string,
  ) {
    this.url = initialUrl;
  }

  setUrl(url: string): void {
    this.url = url;
  }

  bumpEpoch(): void {
    this.epoch += 1;
    this.inFlight = false;
  }

  request(reason: RefetchReason, immediate = false): void {
    if (this.disposed) return;
    this.pendingReason = mergeReason(this.pendingReason, reason);
    if (this.inFlight) return;
    if (this.timer !== null) {
      if (!immediate) return;
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (immediate) {
      this.start();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.start();
    }, 0);
  }

  private start(): void {
    if (this.disposed) return;
    const reason = this.pendingReason;
    if (reason === null) return;
    this.pendingReason = null;
    void this.flush(reason);
  }

  private async flush(reason: RefetchReason): Promise<void> {
    const epoch = this.epoch;
    const root =
      typeof document === 'undefined'
        ? null
        : document.querySelector<HTMLElement>(
            '[data-workbench="content-schema-registry"]',
          );
    const focusLocator =
      root === null ? null : captureContentSchemaRegistryFocus(root);
    this.inFlight = true;
    const loadingTimer = setTimeout(() => {
      // A stale or disposed read must not surface a loading state.
      if (!this.disposed && this.epoch === epoch) this.host.setLoading(true);
    }, LOADING_DELAY_MS);
    let outcome: ContentSchemaRegistryCanonicalReadResult;
    try {
      outcome = await readContentSchemaRegistryCanonicalOutcome(
        document,
        this.url,
      );
    } catch {
      clearTimeout(loadingTimer);
      // Only the current read may release in-flight ownership or drain; a
      // stale/disposed completion is inert so a newer context read stays owner.
      if (this.disposed || this.epoch !== epoch) return;
      this.inFlight = false;
      this.host.setLoading(false);
      this.host.setFocusLocator(null);
      this.host.setProjection((current) =>
        toDisabledProjection(current, 'unavailable'),
      );
      this.host.setMessage(
        'The registry is temporarily unavailable. Try again.',
      );
      this.drain();
      return;
    }
    clearTimeout(loadingTimer);
    if (this.disposed || this.epoch !== epoch) return;
    this.inFlight = false;
    this.host.setLoading(false);
    if (outcome.kind === 'disabled') {
      this.host.setFocusLocator(null);
      this.host.setProjection((current) =>
        toDisabledProjection(current, outcome.reason),
      );
      this.host.setMessage(
        reason === 'reconnect'
          ? 'Reconnected, but the registry is unavailable.'
          : 'The registry is temporarily unavailable. Try again.',
      );
    } else if (outcome.kind === 'navigate') {
      this.host.setFocusLocator(null);
      // The host commits the disabled state synchronously before navigating.
      this.host.navigate(outcome.target);
    } else {
      this.host.setFocusLocator(focusLocator);
      this.host.setProjection((current) =>
        applyProjection(current, outcome.projection),
      );
      this.host.setMessage('Current server-verified records refreshed.');
    }
    this.drain();
  }

  private drain(): void {
    if (this.disposed || this.inFlight) return;
    if (this.pendingReason !== null) this.start();
  }

  dispose(): void {
    this.disposed = true;
    this.pendingReason = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
