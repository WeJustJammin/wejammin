import type { MfaFailure } from './mfa-failure';
import type { MfaContext, MfaFailureView } from './mfa-failure-view';
import type { FocusRequest, MfaWizardState } from './mfa-wizard-state';

/**
 * The wizard state a failed call leaves behind: inline field errors for name
 * and code problems, a notice for everything else, and the one-time secret
 * dropped whenever the enrollment it belonged to is no longer valid.
 */
export const failurePatch = (
  view: MfaFailureView,
  failure: MfaFailure,
  context: MfaContext,
  focus: (target: 'code' | 'name') => FocusRequest,
): Partial<MfaWizardState> => {
  const dropSecret =
    context === 'verify' &&
    (view.kind === 'conflict' || view.kind === 'expired');
  const inline = view.kind === 'name' || view.kind === 'code';
  return {
    busy: false,
    notice: inline ? null : { ...view, requestId: failure.requestId, context },
    nameError: view.kind === 'name' ? view.message : null,
    codeError: view.kind === 'code' ? view.message : null,
    ...(view.clearCode ? { code: '' } : {}),
    ...(view.kind === 'sign-in' || view.kind === 'last-factor'
      ? { announcement: view.message }
      : {}),
    ...(view.kind === 'last-factor' ? { removal: null } : {}),
    ...(dropSecret ? { secret: null, step: 'idle' as const, code: '' } : {}),
    focus:
      view.kind === 'name'
        ? focus('name')
        : view.kind === 'code'
          ? focus('code')
          : null,
  };
};
