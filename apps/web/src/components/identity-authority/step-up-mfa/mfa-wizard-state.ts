import type { MfaApiDeps, RemovalReason } from './mfa-api';
import type { MfaFailureView, MfaContext } from './mfa-failure-view';
import type { StepUpChannelPort } from './step-up-channel';
import type { MfaFactorSummary, StepUpState } from './step-up-phase';

export type WizardStep = 'idle' | 'name' | 'scan' | 'done';

/** Held in island memory only; never serialized, stored or placed in a URL. */
export type EnrollmentSecret = Readonly<{
  factorId: string;
  otpauthUri: string;
  manualEntryKey: string;
  version: string;
}>;

export type MfaNotice = MfaFailureView &
  Readonly<{ requestId: string | null; context: MfaContext }>;

export type RemovalState = Readonly<{
  factorId: string;
  reason: RemovalReason;
  idempotencyKey: string;
}>;

export type FocusRequest = Readonly<{
  target: 'code' | 'heading' | 'name' | 'notice';
  token: number;
}>;

export type MfaWizardState = Readonly<{
  factors: readonly MfaFactorSummary[];
  version: string;
  step: WizardStep;
  name: string;
  nameError: string | null;
  secret: EnrollmentSecret | null;
  code: string;
  codeError: string | null;
  notice: MfaNotice | null;
  announcement: string;
  removal: RemovalState | null;
  busy: boolean;
  doneFreshUntil: string | null;
  focus: FocusRequest | null;
}>;

export type MfaWizardOptions = Readonly<{
  returnTo: string | null;
  factors: readonly MfaFactorSummary[];
  stepUp: StepUpState;
  expectedVersion: string;
  api: MfaApiDeps | undefined;
  navigate: ((href: string) => void) | undefined;
  reload: (() => void) | undefined;
  channel: StepUpChannelPort | null | undefined;
  currentLocation: Readonly<{ pathname: string; search: string }> | undefined;
}>;

export const initialWizardState = (
  options: MfaWizardOptions,
): MfaWizardState => ({
  factors: options.factors,
  version: options.expectedVersion,
  step: 'idle',
  name: '',
  nameError: null,
  secret: null,
  code: '',
  codeError: null,
  notice: null,
  announcement: '',
  removal: null,
  busy: false,
  doneFreshUntil: null,
  focus: null,
});

export const newRemovalKey = (): string => `mfa-${crypto.randomUUID()}`;
