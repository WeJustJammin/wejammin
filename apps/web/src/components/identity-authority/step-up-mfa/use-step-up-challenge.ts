import * as React from 'react';

import {
  readMfaFactors,
  createStepUpChallenge,
  verifyStepUp,
  type MfaApiDeps,
} from './mfa-api';
import { validateOneTimeCode } from './one-time-code';
import { stepUpFailureView, type StepUpFailureView } from './step-up-failure';
import { createStepUpChannel, type StepUpChannelPort } from './step-up-channel';
import { stepUpSignInHref } from './step-up-return';
import type { StepUpFactorChoice, StepUpPhase } from './step-up-phase';
import { useLockout, type Lockout } from './use-lockout';

export type StepUpChallengeOptions = Readonly<{
  returnTo: string;
  factors: readonly StepUpFactorChoice[];
  initialPhase: StepUpPhase;
  initialFreshUntil: string | null;
  api: MfaApiDeps | undefined;
  navigate: ((href: string) => void) | undefined;
  channel: StepUpChannelPort | null | undefined;
}>;

export type StepUpUiState = Readonly<{
  phase: StepUpPhase;
  challengeId: string | null;
  factorName: string | null;
  selectedFactorId: string;
  code: string;
  fieldError: string | null;
  failure: StepUpFailureView | null;
  requestId: string | null;
  announcement: string;
  freshUntil: string | null;
  focus: 'field' | 'retry' | null;
}>;

export type StepUpActions = Readonly<{
  setCode: (value: string) => void;
  chooseFactor: (id: string) => void;
  continueWithFactor: () => void;
  submit: () => void;
  newChallenge: () => void;
}>;

const assign = (href: string): void => window.location.assign(href);

export const useStepUpChallenge = (
  options: StepUpChallengeOptions,
): Readonly<{
  state: StepUpUiState;
  actions: StepUpActions;
  lockout: Lockout;
}> => {
  const { returnTo, factors, api, initialFreshUntil } = options;
  const navigate = options.navigate ?? assign;
  const lockout = useLockout();
  const [state, setState] = React.useState<StepUpUiState>({
    phase: options.initialPhase,
    challengeId: null,
    factorName: null,
    selectedFactorId: factors[0]?.id ?? '',
    code: '',
    fieldError: null,
    failure: null,
    requestId: null,
    announcement: '',
    freshUntil: initialFreshUntil,
    focus: null,
  });
  const patch = React.useCallback(
    (next: Partial<StepUpUiState>): void =>
      setState((s) => ({ ...s, ...next })),
    [],
  );
  const verifying = React.useRef(false);
  const channelRef = React.useRef<StepUpChannelPort | null>(null);
  channelRef.current =
    options.channel === undefined ? createStepUpChannel() : options.channel;

  const applyFailure = React.useCallback(
    (view: StepUpFailureView, requestId: string | null): void => {
      if (view.signIn) navigate(stepUpSignInHref(returnTo));
      if (view.phase === 'locked' && view.retryAfterSeconds !== null)
        lockout.start(view.retryAfterSeconds);
      patch({
        phase: view.phase === 'locked' ? 'awaiting-code' : view.phase,
        failure: view,
        requestId,
        fieldError: view.fieldError,
        ...(view.clearCode ? { code: '' } : {}),
        focus:
          view.phase === 'challenge-expired'
            ? 'retry'
            : view.fieldError === null
              ? null
              : 'field',
      });
    },
    [navigate, returnTo, patch, lockout.start],
  );

  const begin = React.useCallback(
    async (factorId?: string): Promise<void> => {
      patch({
        phase: 'creating-challenge',
        failure: null,
        fieldError: null,
        code: '',
      });
      const outcome = await createStepUpChallenge(
        factorId === undefined ? {} : { factorId },
        api ?? {},
      );
      if (outcome.ok)
        patch({
          phase: 'awaiting-code',
          challengeId: outcome.data.challengeId,
          factorName: outcome.data.friendlyName,
          focus: 'field',
        });
      else
        applyFailure(
          stepUpFailureView(outcome.failure),
          outcome.failure.requestId,
        );
    },
    [api, applyFailure, patch],
  );

  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current || options.initialPhase !== 'creating-challenge')
      return;
    started.current = true;
    void begin();
  }, [begin, options.initialPhase]);

  React.useEffect(
    () =>
      channelRef.current?.subscribe(() => {
        void readMfaFactors(api ?? {}).then((outcome) => {
          if (outcome.ok && outcome.data.stepUp.fresh)
            patch({ freshUntil: outcome.data.stepUp.freshUntil });
        });
      }),
    [api, patch],
  );

  const submit = React.useCallback((): void => {
    if (
      verifying.current ||
      state.phase !== 'awaiting-code' ||
      lockout.remainingSeconds !== null ||
      state.challengeId === null
    )
      return;
    const checked = validateOneTimeCode(state.code);
    if (!checked.ok) {
      patch({ fieldError: checked.message, focus: 'field' });
      return;
    }
    verifying.current = true;
    patch({ phase: 'verifying', fieldError: null, failure: null });
    void verifyStepUp(
      { challengeId: state.challengeId, code: checked.code },
      api ?? {},
    ).then((outcome) => {
      verifying.current = false;
      if (outcome.ok) {
        patch({
          phase: 'verified',
          announcement: 'Verified. Returning to your page.',
          code: '',
        });
        channelRef.current?.post();
        navigate(returnTo);
      } else
        applyFailure(
          stepUpFailureView(outcome.failure),
          outcome.failure.requestId,
        );
    });
  }, [
    api,
    applyFailure,
    lockout.remainingSeconds,
    navigate,
    patch,
    returnTo,
    state.challengeId,
    state.code,
    state.phase,
  ]);

  React.useEffect(() => {
    if (lockout.announcement !== '')
      patch({ announcement: lockout.announcement });
  }, [lockout.announcement, patch]);

  const actions: StepUpActions = {
    setCode: (value) => patch({ code: value, fieldError: null }),
    chooseFactor: (id) => patch({ selectedFactorId: id }),
    continueWithFactor: () => void begin(state.selectedFactorId),
    submit,
    newChallenge: () =>
      void begin(
        factors.length > 1 && state.selectedFactorId !== ''
          ? state.selectedFactorId
          : undefined,
      ),
  };
  return { state, actions, lockout };
};
