import * as React from 'react';

import { stepUpHref } from '../../identity-authority/step-up-mfa/step-up-return';
import {
  useLockout,
  type Lockout,
} from '../../identity-authority/step-up-mfa/use-lockout';
import { submitMfaFactorReset } from './admin-mfa-reset-api';
import { resetFailureView } from './admin-mfa-reset-failure';
import {
  EMPTY_VALUES,
  defaultStorage,
  initialResetState,
  markInterrupted,
  newResetKey,
  type AdminMfaResetOptions,
  type ResetFocusTarget,
  type ResetState,
} from './admin-mfa-reset-state';
import {
  ADMIN_RESET_COPY,
  validateResetField,
  validateResetValues,
  type ResetField,
  type ResetFieldErrors,
} from './admin-mfa-reset-values';

export type AdminMfaResetActions = Readonly<{
  setField: (field: ResetField, value: string) => void;
  blurPerson: () => void;
  review: () => void;
  cancel: () => void;
  confirm: () => void;
  retry: () => void;
  startOver: () => void;
}>;

const assign = (href: string): void => window.location.assign(href);
const LOCATION = (): { pathname: string; search: string } => ({
  pathname: window.location.pathname,
  search: window.location.search,
});

const omitError = (
  errors: ResetFieldErrors,
  field: ResetField,
): ResetFieldErrors =>
  Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));

export const useAdminMfaReset = (
  options: AdminMfaResetOptions,
): Readonly<{
  state: ResetState;
  actions: AdminMfaResetActions;
  lockout: Lockout;
}> => {
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  const [state, setState] = React.useState(() => initialResetState(storage));
  const latest = React.useRef(state);
  latest.current = state;
  const keyRef = React.useRef<string | null>(null);
  const inFlight = React.useRef(false);
  const nonce = React.useRef(0);
  const lockout = useLockout();
  const api = options.api ?? {};
  const navigate = options.navigate ?? assign;

  const patch = React.useCallback(
    (next: Partial<ResetState>): void => setState((s) => ({ ...s, ...next })),
    [],
  );
  const focusOn = React.useCallback((target: ResetFocusTarget) => {
    nonce.current += 1;
    return { target, nonce: nonce.current };
  }, []);
  const mintKey = (): string =>
    (keyRef.current ??= (api.idempotencyKey ?? newResetKey)());

  const setField = React.useCallback(
    (field: ResetField, value: string): void => {
      keyRef.current = null;
      setState((s) => {
        const fieldErrors = omitError(s.fieldErrors, field);
        return { ...s, values: { ...s.values, [field]: value }, fieldErrors };
      });
    },
    [],
  );

  const blurPerson = React.useCallback((): void => {
    setState((s) => {
      const rest = omitError(s.fieldErrors, 'targetPersonId');
      const error =
        s.values.targetPersonId === ''
          ? null
          : validateResetField('targetPersonId', s.values);
      return {
        ...s,
        fieldErrors: error === null ? rest : { ...rest, targetPersonId: error },
      };
    });
  }, []);

  const review = (): void => {
    if (lockout.remainingSeconds !== null || latest.current.phase !== 'editing')
      return;
    const errors = validateResetValues(latest.current.values);
    if (errors.targetPersonId !== undefined || errors.reason !== undefined) {
      patch({
        fieldErrors: errors,
        showSummary: true,
        focus: focusOn(
          errors.targetPersonId === undefined ? 'reason' : 'person',
        ),
      });
      return;
    }
    mintKey();
    patch({
      phase: 'confirming',
      fieldErrors: {},
      showSummary: false,
      notice: null,
      result: null,
      announcement: '',
      focus: focusOn('confirm'),
    });
  };

  const run = async (): Promise<void> => {
    if (inFlight.current || lockout.remainingSeconds !== null) return;
    inFlight.current = true;
    const key = mintKey();
    patch({ phase: 'pending', notice: null });
    const outcome = await submitMfaFactorReset(latest.current.values, key, api);
    inFlight.current = false;
    if (outcome.ok) {
      keyRef.current = null;
      const completed = outcome.data.state === 'completed';
      patch({
        phase: 'editing',
        values: EMPTY_VALUES,
        fieldErrors: {},
        result: {
          state: outcome.data.state,
          removedFactorCount: outcome.data.removedFactorCount,
        },
        announcement: completed
          ? ADMIN_RESET_COPY.completed
          : ADMIN_RESET_COPY.reconciling,
        focus: focusOn('result'),
      });
      options.onCanonicalRefetch?.('mutation').catch(() => undefined);
      return;
    }
    const view = resetFailureView(outcome.failure);
    if (view.kind !== 'unknown' && view.kind !== 'degraded')
      keyRef.current = null;
    if (view.kind === 'step-up') {
      markInterrupted(storage);
      const here = options.currentLocation ?? LOCATION();
      patch({ phase: 'editing' });
      navigate(stepUpHref(here.pathname, here.search));
      return;
    }
    if (view.kind === 'locked' && view.retryAfterSeconds !== null)
      lockout.start(view.retryAfterSeconds);
    patch({
      phase: 'editing',
      fieldErrors: view.fieldErrors,
      showSummary: Object.keys(view.fieldErrors).length > 0,
      notice: { ...view, requestId: outcome.failure.requestId },
      focus: focusOn('notice'),
    });
  };

  const actions: AdminMfaResetActions = {
    setField,
    blurPerson,
    review,
    cancel: () => {
      if (latest.current.phase === 'confirming')
        patch({ phase: 'editing', focus: focusOn('person') });
    },
    confirm: () => void run(),
    retry: () => void run(),
    startOver: () => {
      keyRef.current = null;
      setState({ ...initialResetState(null), focus: focusOn('person') });
    },
  };
  return { state, actions, lockout };
};
