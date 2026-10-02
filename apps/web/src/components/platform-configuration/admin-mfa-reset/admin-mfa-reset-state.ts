import type { DraftStorage } from '../../identity-authority/step-up-mfa/step-up-draft';
import type { MfaApiDeps } from '../../identity-authority/step-up-mfa/mfa-api';
import type { ResetFailureView } from './admin-mfa-reset-failure';
import {
  ADMIN_RESET_COPY,
  type ResetFieldErrors,
  type ResetValues,
} from './admin-mfa-reset-values';

export type ResetPhase = 'confirming' | 'editing' | 'pending';
export type ResetFocusTarget =
  'confirm' | 'notice' | 'person' | 'reason' | 'result';

export type ResetResult = Readonly<{
  state: 'completed' | 'reconciling';
  removedFactorCount: number;
}>;

export type ResetNotice = ResetFailureView &
  Readonly<{ requestId: string | null }>;

export type ResetState = Readonly<{
  values: ResetValues;
  fieldErrors: ResetFieldErrors;
  showSummary: boolean;
  phase: ResetPhase;
  notice: ResetNotice | null;
  result: ResetResult | null;
  announcement: string;
  focus: Readonly<{ target: ResetFocusTarget; nonce: number }> | null;
}>;

export type AdminMfaResetOptions = Readonly<{
  api?: MfaApiDeps | undefined;
  navigate?: ((href: string) => void) | undefined;
  currentLocation?: Readonly<{ pathname: string; search: string }> | undefined;
  /** Session-scoped storage for the single "entries were not saved" marker. */
  storage?: DraftStorage | null | undefined;
  onCanonicalRefetch?: ((reason: 'mutation') => Promise<void>) | undefined;
}>;

export const EMPTY_VALUES: ResetValues = { targetPersonId: '', reason: '' };

/**
 * The only thing kept across the step-up round trip is this flag. The person
 * ID and reason are never written anywhere.
 */
export const INTERRUPTED_KEY = 'wj-admin-mfa-reset-interrupted';

export const defaultStorage = (): DraftStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

const consumeInterruption = (storage: DraftStorage | null): boolean => {
  try {
    if (storage?.getItem(INTERRUPTED_KEY) !== '1') return false;
    storage.removeItem(INTERRUPTED_KEY);
    return true;
  } catch {
    return false;
  }
};

export const markInterrupted = (storage: DraftStorage | null): void => {
  try {
    storage?.setItem(INTERRUPTED_KEY, '1');
  } catch {
    // Storage may be blocked; the note is then simply not shown on return.
  }
};

export const initialResetState = (
  storage: DraftStorage | null,
): ResetState => ({
  values: EMPTY_VALUES,
  fieldErrors: {},
  showSummary: false,
  phase: 'editing',
  notice: null,
  result: null,
  announcement: consumeInterruption(storage) ? ADMIN_RESET_COPY.notSaved : '',
  focus: null,
});

export const newResetKey = (): string =>
  `admin-mfa-reset-${crypto.randomUUID()}`;
