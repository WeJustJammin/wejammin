import {
  STEP_UP_ADMIN_RESET_MARKER_KEY,
  currentStepUpContext,
  isStampLive,
  stampFor,
  type StepUpStateContext,
} from '../../identity-authority/step-up-mfa/step-up-binding';
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
export const INTERRUPTED_KEY = STEP_UP_ADMIN_RESET_MARKER_KEY;

export const defaultStorage = (): DraftStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * The flag is stamped with the session scope and time like every step-up
 * detour record: another user in this tab, or the same tab after the 600 s
 * window, never sees the announcement and the flag is cleared.
 */
const consumeInterruption = (
  storage: DraftStorage | null,
  context: StepUpStateContext,
): boolean => {
  try {
    const raw = storage?.getItem(INTERRUPTED_KEY) ?? null;
    if (storage === null || raw === null) return false;
    storage.removeItem(INTERRUPTED_KEY);
    return isStampLive(JSON.parse(raw) as unknown, context);
  } catch {
    return false;
  }
};

export const markInterrupted = (
  storage: DraftStorage | null,
  context: StepUpStateContext = currentStepUpContext(),
): void => {
  try {
    storage?.setItem(INTERRUPTED_KEY, JSON.stringify(stampFor(context)));
  } catch {
    // Storage may be blocked; the note is then simply not shown on return.
  }
};

export const initialResetState = (
  storage: DraftStorage | null,
  context: StepUpStateContext = currentStepUpContext(),
): ResetState => ({
  values: EMPTY_VALUES,
  fieldErrors: {},
  showSummary: false,
  phase: 'editing',
  notice: null,
  result: null,
  announcement: consumeInterruption(storage, context)
    ? ADMIN_RESET_COPY.notSaved
    : '',
  focus: null,
});

export const newResetKey = (): string =>
  `admin-mfa-reset-${crypto.randomUUID()}`;
