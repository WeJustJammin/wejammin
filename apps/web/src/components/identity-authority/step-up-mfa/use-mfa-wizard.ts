import * as React from 'react';

import {
  readMfaFactors,
  removeFactor,
  startTotpEnrollment,
  verifyEnrollment,
  type RemovalReason,
} from './mfa-api';
import type { MfaFailure } from './mfa-failure';
import { MFA_COPY, mfaFailureView, type MfaContext } from './mfa-failure-view';
import { failurePatch } from './mfa-wizard-failure-patch';
import {
  initialWizardState,
  newRemovalKey,
  type MfaWizardOptions,
  type MfaWizardState,
} from './mfa-wizard-state';
import { validateOneTimeCode } from './one-time-code';
import { createStepUpChannel } from './step-up-channel';
import { stepUpHref } from './step-up-return';
import { useLockout, type Lockout } from './use-lockout';

const assign = (href: string): void => window.location.assign(href);
const NAME_PATTERN = /^[^\p{Cc}]{1,80}$/u;

export type MfaWizardActions = Readonly<{
  openName: (prefill?: string) => void;
  closeName: () => void;
  setName: (value: string) => void;
  submitName: () => void;
  setCode: (value: string) => void;
  submitCode: () => void;
  copyKey: () => void;
  cancelPending: (factorId: string) => void;
  refresh: () => void;
  openRemoval: (factorId: string) => void;
  closeRemoval: () => void;
  setRemovalReason: (reason: RemovalReason) => void;
  confirmRemoval: () => void;
  retry: () => void;
  reload: () => void;
  dismissDone: () => void;
}>;

export const useMfaWizard = (
  options: MfaWizardOptions,
): Readonly<{
  state: MfaWizardState;
  actions: MfaWizardActions;
  lockout: Lockout;
}> => {
  const [state, setState] = React.useState(() => initialWizardState(options));
  const latest = React.useRef(state);
  latest.current = state;
  const lockout = useLockout();
  const api = options.api ?? {};
  const navigate = options.navigate ?? assign;
  const channel = React.useMemo(
    () =>
      options.channel === undefined ? createStepUpChannel() : options.channel,
    [options.channel],
  );
  const patch = React.useCallback(
    (next: Partial<MfaWizardState>): void =>
      setState((s) => ({ ...s, ...next })),
    [],
  );
  const focus = (target: 'code' | 'heading' | 'name' | 'notice') => ({
    target,
    token: Date.now() + Math.random(),
  });

  const refresh = React.useCallback(async (): Promise<void> => {
    const outcome = await readMfaFactors(api);
    if (outcome.ok)
      patch({ factors: outcome.data.factors, version: outcome.data.version });
  }, [api, patch]);

  // A factor changed in another tab: read the canonical factor list again. The
  // signal carries nothing, and a one-time secret shown here is left alone.
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;
  React.useEffect(
    () => channel?.subscribe(() => void refreshRef.current()),
    [channel],
  );

  const fail = (failure: MfaFailure, context: MfaContext): void => {
    const view = mfaFailureView(failure, context);
    if (view.kind === 'step-up') {
      const where = options.currentLocation ?? window.location;
      patch({ busy: false });
      navigate(stepUpHref(where.pathname, where.search));
      return;
    }
    if (view.kind === 'locked' && view.retryAfterSeconds !== null)
      lockout.start(view.retryAfterSeconds);
    patch(failurePatch(view, failure, context, focus));
    if (view.kind === 'conflict') void refresh();
  };

  const submitName = (): void => {
    const current = latest.current;
    if (current.busy || lockout.remainingSeconds !== null) return;
    const name = current.name.trim();
    if (!NAME_PATTERN.test(name) || name.normalize('NFC') !== name) {
      patch({ nameError: MFA_COPY.nameInvalid, focus: focus('name') });
      return;
    }
    patch({ busy: true, nameError: null, notice: null });
    void startTotpEnrollment(
      { friendlyName: name, version: current.version },
      api,
    ).then((outcome) => {
      if (!outcome.ok) return fail(outcome.failure, 'start');
      const data = outcome.data;
      patch({
        busy: false,
        step: 'scan',
        code: '',
        codeError: null,
        version: data.version,
        secret: {
          factorId: data.factorId,
          otpauthUri: data.otpauthUri,
          manualEntryKey: data.manualEntryKey,
          version: data.version,
        },
        focus: focus('code'),
      });
    });
  };

  const submitCode = (): void => {
    const current = latest.current;
    if (
      current.busy ||
      current.secret === null ||
      lockout.remainingSeconds !== null
    )
      return;
    const checked = validateOneTimeCode(current.code);
    if (!checked.ok) {
      patch({ codeError: checked.message, focus: focus('code') });
      return;
    }
    patch({ busy: true, codeError: null });
    void verifyEnrollment(
      {
        factorId: current.secret.factorId,
        code: checked.code,
        version: current.secret.version,
      },
      api,
    ).then((outcome) => {
      if (!outcome.ok) return fail(outcome.failure, 'verify');
      patch({
        busy: false,
        factors: outcome.data.factors,
        version: outcome.data.version,
        secret: null,
        code: '',
        step: 'done',
        doneFreshUntil: outcome.data.stepUp.freshUntil,
        announcement: 'Authenticator added.',
      });
      channel?.post();
    });
  };

  const remove = (
    factorId: string,
    reason: RemovalReason,
    key: string,
    context: MfaContext,
    done: string,
  ): void => {
    patch({ busy: true, notice: null });
    void removeFactor(
      {
        factorId,
        reason,
        version: latest.current.version,
        idempotencyKey: key,
      },
      api,
    ).then((outcome) => {
      if (!outcome.ok) return fail(outcome.failure, context);
      patch({
        busy: false,
        factors: outcome.data.factors,
        version: outcome.data.version,
        removal: null,
        announcement: done,
        focus: focus('heading'),
      });
      channel?.post();
    });
  };

  React.useEffect(() => {
    if (lockout.announcement !== '')
      patch({ announcement: lockout.announcement });
  }, [lockout.announcement, patch]);

  React.useEffect(() => {
    const clear = (): void =>
      setState((s) =>
        s.secret === null ? s : { ...s, secret: null, code: '', step: 'idle' },
      );
    window.addEventListener('pagehide', clear);
    return () => window.removeEventListener('pagehide', clear);
  }, []);

  const actions: MfaWizardActions = {
    openName: (prefill) =>
      patch({
        step: 'name',
        name: prefill ?? latest.current.name,
        nameError: null,
        notice: null,
        secret: null,
        code: '',
        focus: focus('name'),
      }),
    closeName: () => patch({ step: 'idle', nameError: null }),
    setName: (value) => patch({ name: value, nameError: null }),
    submitName,
    setCode: (value) => patch({ code: value, codeError: null }),
    submitCode,
    copyKey: () => {
      const key = latest.current.secret?.manualEntryKey;
      if (key === undefined || navigator.clipboard === undefined)
        return patch({
          announcement:
            'Copy is not available. Select the key and copy it manually.',
        });
      void navigator.clipboard.writeText(key).then(
        () => patch({ announcement: 'Key copied' }),
        () =>
          patch({
            announcement:
              'Copy is not available. Select the key and copy it manually.',
          }),
      );
    },
    cancelPending: (factorId) => {
      if (latest.current.busy) return;
      patch({ secret: null, step: 'idle', code: '' });
      remove(
        factorId,
        'user_request',
        newRemovalKey(),
        'cancel',
        'Setup cancelled.',
      );
    },
    refresh: () => void refresh(),
    openRemoval: (factorId) =>
      patch({
        removal: {
          factorId,
          reason: 'user_request',
          idempotencyKey: newRemovalKey(),
        },
        notice: null,
      }),
    closeRemoval: () => patch({ removal: null }),
    setRemovalReason: (reason) =>
      setState((s) =>
        s.removal === null ? s : { ...s, removal: { ...s.removal, reason } },
      ),
    confirmRemoval: () => {
      const { removal, busy } = latest.current;
      if (removal === null || busy) return;
      remove(
        removal.factorId,
        removal.reason,
        removal.idempotencyKey,
        'remove',
        'Authenticator removed',
      );
    },
    retry: () => {
      const context = latest.current.notice?.context;
      if (context === 'start' || context === 'verify') {
        if (latest.current.name.trim() === '') return actions.openName();
        patch({ step: 'name', secret: null, code: '' });
        submitName();
      } else void refresh();
    },
    reload: options.reload ?? (() => window.location.reload()),
    dismissDone: () => patch({ step: 'idle', focus: focus('heading') }),
  };
  return { state, actions, lockout };
};
