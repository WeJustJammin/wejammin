export type ProviderCode =
  'email' | 'google' | 'apple' | 'facebook' | 'soundcloud';

export type LoginMethod = Readonly<{
  id: string;
  provider: ProviderCode;
  label: string;
  verifiedAt: string;
  lastUsedAt: string | null;
  removable: boolean;
}>;

export type LoginMethodsResource = Readonly<{
  methods: readonly LoginMethod[];
  recoveryBaselinePresent: boolean;
  version: string;
}>;

export type MergeState =
  | 'awaiting_duplicate_proof'
  | 'analyzing'
  | 'awaiting_confirmation'
  | 'queued'
  | 'running'
  | 'completed'
  | 'manual_review'
  | 'expired';

export type MergeCase = Readonly<{
  mergeId: string;
  state: MergeState;
  expiresAt: string;
  conflictPlanVersion: string | null;
  jobId: string | null;
  version: string;
}>;

export type JobStatus = Readonly<{
  id: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
}>;

export type UiError = Readonly<{
  code: string;
  requestId: string;
  retryAfterSeconds: number | null;
}>;

export type PendingAction =
  | 'refresh'
  | `link:${ProviderCode}`
  | 'unlink'
  | 'merge-create'
  | `merge-proof:${ProviderCode}`
  | 'merge-confirm';

export type UnlinkReason = 'user_request' | 'provider_compromise';

export type SchemaLike<T> = Readonly<{
  safeParse: (
    value: unknown,
  ) => Readonly<{ success: true; data: T }> | Readonly<{ success: false }>;
}>;

export interface LoginMethodManagerProps {
  readonly initial: LoginMethodsResource;
  readonly initialEtag: string | null;
  readonly initialMerge: MergeCase | null;
  readonly initialMergeEtag: string | null;
  readonly requestId: string;
  readonly returnTo: string;
}

export interface AccountSecurityState {
  readonly resource: LoginMethodsResource;
  readonly etag: string;
  readonly mergeCase: MergeCase | null;
  readonly mergeEtag: string | null;
  readonly pending: PendingAction | null;
  readonly error: UiError | null;
  readonly announcement: string;
  readonly unlinkTarget: LoginMethod | null;
  readonly unlinkReason: UnlinkReason;
  readonly unlinkAcknowledged: boolean;
  readonly mergeProvider: ProviderCode;
  readonly mergeAcknowledged: boolean;
  readonly conflictPlanVersion: string;
  readonly acknowledgements: string;
  readonly job: JobStatus | null;
}

export interface AccountSecurityActions {
  readonly refresh: () => Promise<void>;
  readonly linkProvider: (provider: ProviderCode) => Promise<void>;
  readonly chooseUnlink: (method: LoginMethod) => void;
  readonly setUnlinkReason: (reason: UnlinkReason) => void;
  readonly setUnlinkAcknowledged: (value: boolean) => void;
  readonly cancelUnlink: () => void;
  readonly confirmUnlink: () => Promise<void>;
  readonly createMerge: () => Promise<void>;
  readonly setMergeProvider: (provider: ProviderCode) => void;
  readonly proveDuplicate: () => Promise<void>;
  readonly setConflictPlanVersion: (value: string) => void;
  readonly setAcknowledgements: (value: string) => void;
  readonly setMergeAcknowledged: (value: boolean) => void;
  readonly confirmMerge: () => Promise<void>;
  readonly resetExpiredMerge: () => void;
}

export interface AccountSecurityController {
  readonly state: AccountSecurityState;
  readonly actions: AccountSecurityActions;
}

export const PROVIDER_LABELS: Readonly<Record<ProviderCode, string>> = {
  email: 'Email',
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
  soundcloud: 'SoundCloud',
};

export const PROVIDERS: readonly ProviderCode[] = [
  'email',
  'google',
  'apple',
  'facebook',
  'soundcloud',
];

export const formatDate = (value: string | null): string => {
  if (value === null) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};

export const safeEtag = (etag: string | null, version: string): string =>
  etag !== null && /^"[1-9][0-9]{0,18}"$/u.test(etag) ? etag : `"${version}"`;

export const errorCopy = (error: UiError): string => {
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return 'Your session expired. Sign in again to manage account security.';
    case 'STEP_UP_REQUIRED':
      return 'Recent verification is required before this security change. Continue to verify; your place is kept.';
    case 'FORBIDDEN':
      return 'Your current access does not allow this security change.';
    case 'NOT_FOUND':
      return 'That security record is no longer available.';
    case 'final_login_method':
      return 'Keep another verified login or recovery method before removing this one.';
    case 'merge_plan_stale':
    case 'VERSION_MISMATCH':
      return 'The security record changed. Review the current record and try again.';
    case 'merge_conflicts_unresolved':
      return 'Every conflict must be reviewed and acknowledged by its owning domain.';
    case 'same_account':
      return 'The proof must belong to a different account.';
    case 'login_identity_conflict':
      return 'That login method is already connected to an account.';
    case 'RATE_LIMITED':
      return 'Too many security changes were requested. Wait before trying again.';
    case 'VALIDATION_FAILED':
    case 'INVALID_REQUEST':
      return 'Check the highlighted security fields and try again.';
    case 'DEPENDENCY_UNAVAILABLE':
    case 'HTTP_502':
    case 'HTTP_503':
    case 'HTTP_504':
      return 'Security settings are temporarily unavailable. Try again shortly.';
    default:
      return 'We could not complete that security change. Try again or contact support with the request ID.';
  }
};

export const mergeStateCopy = (state: MergeState): string => {
  switch (state) {
    case 'awaiting_duplicate_proof':
      return 'Waiting for proof from the other account.';
    case 'analyzing':
      return 'The server is analyzing the verified accounts.';
    case 'awaiting_confirmation':
      return 'Review the server conflict plan before confirming the merge.';
    case 'queued':
      return 'The merge is queued for the server job runner.';
    case 'running':
      return 'The merge is running. Keep this page open or return with its status link.';
    case 'completed':
      return 'The merge completed and the server preserved its audit trail.';
    case 'manual_review':
      return 'The merge paused for manual review. Do not resend the confirmation.';
    case 'expired':
      return 'This merge case expired. Start a new case if you still need help.';
  }
};
