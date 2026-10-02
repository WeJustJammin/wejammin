import type { GrantCommandResult } from './cms-capability-grant-client';
import { capabilityLabel } from './cms-capability-grant-labels';
import {
  violationFieldErrors,
  type CmsCapabilityGrantTermBounds,
  type GrantFieldErrors,
} from './cms-capability-grant-validation';

export type GrantCommandKind = 'grant' | 'renew' | 'revoke';

export type GrantFailureAction =
  'none' | 'step-up' | 'sign-in' | 'filter-capability' | 'retry';

export type GrantCommandState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | {
      readonly status: 'success';
      readonly heading: string;
      readonly announcement: string;
    }
  | {
      readonly status: 'failure';
      readonly outcome: GrantCommandResult['outcome'];
      readonly message: string;
      readonly fieldErrors: GrantFieldErrors;
      readonly requestId: string | null;
      readonly retryAfterSeconds: number | null;
      readonly action: GrantFailureAction;
      /** The canonical list is refetched before any retry (never a guess). */
      readonly refetch: boolean;
    };

export const COMMAND_COPY = {
  stepUp: 'Verify your identity to change CMS access.',
  noVerificationMethod: 'No verification method is available.',
  owner: 'Only the organization owner can manage CMS access.',
  personMissing:
    'That person could not be found as a member of your organization.',
  grantMissing: 'This grant is no longer available.',
  alreadyHeld:
    'This person already holds this capability. Renew the existing grant instead.',
  changed: 'This grant changed. Review the current term and try again.',
  validation: 'Check the highlighted fields.',
  rateLimited: 'Too many requests. Try again shortly.',
  unconfirmed:
    'The result of this change is not confirmed yet. Checking the current grants before you retry.',
  signIn: 'Sign in again to change CMS access.',
  entriesNotSaved: 'Your entries were not saved.',
  saved: 'The capability grant was saved.',
} as const;

const SUCCESS_HEADINGS: Readonly<Record<GrantCommandKind, string>> = {
  grant: 'Capability granted',
  renew: 'Grant renewed',
  revoke: 'Grant revoked',
};

const successState = (
  kind: GrantCommandKind,
  result: GrantCommandResult,
): GrantCommandState => {
  const resource = result.resource;
  const label = resource === null ? null : capabilityLabel(resource.capability);
  const announcement =
    resource === null || label === null
      ? COMMAND_COPY.saved
      : kind === 'revoke'
        ? `Revoked ${label}.`
        : `${kind === 'grant' ? 'Granted' : 'Renewed'} ${label} until ${resource.validThrough} (UTC).`;
  return { status: 'success', heading: SUCCESS_HEADINGS[kind], announcement };
};

const failure = (
  result: GrantCommandResult,
  message: string,
  extra: {
    readonly action?: GrantFailureAction;
    readonly fieldErrors?: GrantFieldErrors;
    readonly refetch?: boolean;
  } = {},
): GrantCommandState => ({
  status: 'failure',
  outcome: result.outcome,
  message,
  fieldErrors: extra.fieldErrors ?? {},
  requestId: result.requestId,
  retryAfterSeconds: result.retryAfterSeconds,
  action: extra.action ?? 'none',
  refetch: extra.refetch ?? false,
});

/** Map one verified command result onto the FE03 state table. */
export const stateForResult = (
  kind: GrantCommandKind,
  result: GrantCommandResult,
  bounds: CmsCapabilityGrantTermBounds,
): GrantCommandState => {
  switch (result.outcome) {
    case 'success':
      return successState(kind, result);
    case 'step-up-required':
      return failure(result, COMMAND_COPY.stepUp, { action: 'step-up' });
    case 'step-up-unavailable':
      return failure(result, COMMAND_COPY.noVerificationMethod);
    case 'step-up-malformed':
      return failure(result, COMMAND_COPY.unconfirmed, {
        action: 'retry',
        refetch: true,
      });
    case 'unauthenticated':
      return failure(result, COMMAND_COPY.signIn, { action: 'sign-in' });
    case 'forbidden':
      return failure(result, COMMAND_COPY.owner);
    case 'not-found':
      return kind === 'grant'
        ? failure(result, COMMAND_COPY.personMissing)
        : failure(result, COMMAND_COPY.grantMissing, { refetch: true });
    case 'conflict':
      return kind === 'grant'
        ? failure(result, COMMAND_COPY.alreadyHeld, {
            action: 'filter-capability',
          })
        : failure(result, COMMAND_COPY.changed, { refetch: true });
    case 'validation':
      return failure(result, COMMAND_COPY.validation, {
        fieldErrors: violationFieldErrors(result.violations, bounds),
      });
    case 'rate-limited':
      return failure(result, COMMAND_COPY.rateLimited);
    case 'degraded':
      return failure(result, COMMAND_COPY.unconfirmed, {
        action: 'retry',
        refetch: true,
      });
  }
};
