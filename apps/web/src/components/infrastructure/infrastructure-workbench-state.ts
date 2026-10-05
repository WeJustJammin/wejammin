import type { InfrastructureNavigationQuery } from '@wejammin/ui/infrastructure/navigation';
import type { InfrastructureViewState } from '../../../../../packages/contracts/src/infrastructure-view-state.ts';
import type {
  AsyncState,
  InfrastructureRecord,
} from '@wejammin/ui/infrastructure/presentation';

import type { ServerInitialState } from './infrastructure-workbench-types';

export type {
  RefetchReason,
  ServerInitialState,
} from './infrastructure-workbench-types';
import { stepUpTargetForReturnTo } from '../step-up-required';

export const CHANNEL_NAME = 'wejammin:infrastructure-invalidation';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isInfrastructureRecord = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.summary === 'string' &&
  typeof value.version === 'string' &&
  typeof value.modifiedAt === 'string' &&
  isRecord(value.facts) &&
  Array.isArray(value.provenance);

const isApiError = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  typeof value.message === 'string' &&
  typeof value.requestId === 'string';

const isContractViewState = (
  value: ServerInitialState,
): value is InfrastructureViewState => {
  if (!isRecord(value) || typeof value.status !== 'string') return false;
  const candidate: Record<string, unknown> = value;
  switch (candidate.status) {
    case 'idle':
      return true;
    case 'loading':
      return (
        typeof candidate.startedAt === 'string' &&
        typeof candidate.preserveSafePriorContent === 'boolean'
      );
    case 'validation_error':
      return (
        (candidate.httpStatus === 400 || candidate.httpStatus === 422) &&
        isApiError(candidate.error) &&
        isRecord(candidate.retainedInput)
      );
    case 'unauthenticated':
      return typeof candidate.returnTo === 'string';
    case 'capability_gate':
      return (
        candidate.recovery === 'request_capability' &&
        typeof candidate.requiredCapability === 'string'
      );
    case 'step_up_required':
      return (
        typeof candidate.returnTo === 'string' &&
        Array.isArray(candidate.allowedMethods)
      );
    case 'not_found':
      return true;
    case 'conflict':
      return (
        typeof candidate.currentVersion === 'string' &&
        isRecord(candidate.retainedInput)
      );
    case 'rate_wait':
      return (
        typeof candidate.retryAt === 'string' &&
        isRecord(candidate.retainedInput)
      );
    case 'dependency_error':
      return (
        (candidate.httpStatus === 502 ||
          candidate.httpStatus === 503 ||
          candidate.httpStatus === 504) &&
        typeof candidate.requestId === 'string' &&
        Array.isArray(candidate.safeRetryDelaysMs)
      );
    case 'empty':
      return (
        candidate.reason === 'no_records' ||
        candidate.reason === 'filter_miss' ||
        candidate.reason === 'non_disclosure'
      );
    case 'success':
      return isInfrastructureRecord(candidate.record);
    case 'optimistic_pending':
      return (
        typeof candidate.operationId === 'string' &&
        isInfrastructureRecord(candidate.canonicalPreimage)
      );
    case 'optimistic_rollback':
      return (
        typeof candidate.operationId === 'string' &&
        isInfrastructureRecord(candidate.canonicalPreimage) &&
        isApiError(candidate.error)
      );
    case 'disabled':
      return typeof candidate.prerequisite === 'string';
    case 'degraded':
      return (
        typeof candidate.requestId === 'string' &&
        typeof candidate.scope === 'string' &&
        (candidate.lastKnownGood === null ||
          (isRecord(candidate.lastKnownGood) &&
            isInfrastructureRecord(candidate.lastKnownGood.record) &&
            typeof candidate.lastKnownGood.verifiedAt === 'string'))
      );
    default:
      return false;
  }
};

type ContractParseResult =
  | { readonly success: true; readonly data: InfrastructureViewState }
  | { readonly success: false };

interface ContractStateParser {
  readonly safeParse: (state: unknown) => ContractParseResult;
}

// Server-rendered state keeps the full Zod trust-boundary validation. The
// browser receives that already-validated projection and only needs a small
// structural discriminator; shipping Zod and the entire contract graph again
// would duplicate server-only validation in the hydration path.
const serverContractStateParser: ContractStateParser | null = import.meta.env
  .SSR
  ? (
      await import('../../../../../packages/contracts/src/infrastructure-view-state.ts')
    ).InfrastructureViewStateSchema
  : null;

type StepUpViewState = Extract<
  InfrastructureViewState,
  { status: 'step_up_required' }
>;

/** BE00/FE00 (DEC-111): 401 STEP_UP_REQUIRED routes to `/step-up?returnTo=`. */
export const stepUpRecoveryHref = (
  state: Pick<StepUpViewState, 'returnTo'>,
): string => stepUpTargetForReturnTo(state.returnTo);

export const parseContractState = (
  state: ServerInitialState,
): ContractParseResult =>
  serverContractStateParser?.safeParse(state) ??
  (isContractViewState(state)
    ? { success: true, data: state }
    : { success: false });

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const QUOTED_VERSION_PATTERN = /^"[1-9]\d{0,18}"$/u;
const MAX_POSITIVE_BIGINT = 9_223_372_036_854_775_807n;

const isQuotedVersion = (value: string): boolean =>
  QUOTED_VERSION_PATTERN.test(value) &&
  BigInt(value.slice(1, -1)) <= MAX_POSITIVE_BIGINT;

const normalizeWorkbenchQuery = (
  candidate: Readonly<Record<string, string>>,
): InfrastructureNavigationQuery | null => {
  const query: {
    -readonly [
      Key in keyof InfrastructureNavigationQuery
    ]?: InfrastructureNavigationQuery[Key];
  } = {};
  if (candidate.q !== undefined) {
    const value = candidate.q.trim();
    if (value.length < 1 || value.length > 120) return null;
    query.q = value;
  }
  if (candidate.sort !== undefined) {
    if (
      candidate.sort !== 'modified_desc' &&
      candidate.sort !== 'modified_asc' &&
      candidate.sort !== 'label_asc'
    )
      return null;
    query.sort = candidate.sort;
  }
  if (candidate.filter !== undefined) {
    if (
      candidate.filter !== 'all' &&
      candidate.filter !== 'active' &&
      candidate.filter !== 'degraded'
    )
      return null;
    query.filter = candidate.filter;
  }
  if (candidate.cursor !== undefined) {
    if (!/^[A-Za-z0-9_-]{1,256}$/u.test(candidate.cursor)) return null;
    query.cursor = candidate.cursor;
  }
  if (candidate.selected !== undefined) {
    if (!UUID_PATTERN.test(candidate.selected)) return null;
    query.selected = candidate.selected;
  }
  if (candidate.tab !== undefined) {
    if (
      candidate.tab !== 'facts' &&
      candidate.tab !== 'provenance' &&
      candidate.tab !== 'history'
    )
      return null;
    query.tab = candidate.tab;
  }
  return query;
};

export const parseWorkbenchQuery = (
  input: URL | URLSearchParams | string,
): InfrastructureNavigationQuery => {
  const params =
    typeof input === 'string'
      ? new URL(input, 'https://wejamm.in').searchParams
      : input instanceof URL
        ? input.searchParams
        : input;
  const candidate: Record<string, string> = {};
  for (const name of [
    'q',
    'sort',
    'filter',
    'cursor',
    'selected',
    'tab',
  ] as const) {
    const value = params.get(name);
    if (value !== null) candidate[name] = value;
  }
  return normalizeWorkbenchQuery(candidate) ?? {};
};

export const serializeWorkbenchQuery = (
  input: InfrastructureNavigationQuery,
): string => {
  const candidate: Record<string, string> = {};
  for (const name of [
    'q',
    'sort',
    'filter',
    'cursor',
    'selected',
    'tab',
  ] as const) {
    const value = input[name];
    if (value !== undefined) candidate[name] = value;
  }
  const query = normalizeWorkbenchQuery(candidate);
  if (query === null) throw new TypeError('Invalid infrastructure query');
  const params = new URLSearchParams();
  for (const name of [
    'q',
    'sort',
    'filter',
    'cursor',
    'selected',
    'tab',
  ] as const) {
    const value = query[name];
    if (value !== undefined) params.set(name, value);
  }
  return params.toString();
};

export const isInvalidationMessage = (
  value: unknown,
  currentResourceId?: string | null,
): value is {
  readonly kind: 'invalidate';
  readonly entityId: string;
  readonly hintedVersion?: string;
  readonly carriesCanonicalState: false;
} => {
  if (!isRecord(value)) return false;
  if (
    value.kind !== 'invalidate' ||
    typeof value.entityId !== 'string' ||
    value.carriesCanonicalState !== false
  )
    return false;
  if (
    value.hintedVersion !== undefined &&
    typeof value.hintedVersion !== 'string'
  )
    return false;
  return (
    UUID_PATTERN.test(value.entityId) &&
    (value.hintedVersion === undefined ||
      isQuotedVersion(value.hintedVersion)) &&
    (currentResourceId === undefined || currentResourceId === value.entityId)
  );
};

export const recordsForState = (
  state: ServerInitialState,
): readonly InfrastructureRecord[] => {
  const parsed = parseContractState(state);
  if (parsed.success) {
    switch (parsed.data.status) {
      case 'success':
        return [parsed.data.record];
      case 'degraded':
        return parsed.data.lastKnownGood === null
          ? []
          : [parsed.data.lastKnownGood.record];
      case 'optimistic_pending':
      case 'optimistic_rollback':
        return [parsed.data.canonicalPreimage];
      default:
        return [];
    }
  }

  const clientState = state as AsyncState<readonly InfrastructureRecord[]>;
  switch (clientState.status) {
    case 'success':
    case 'optimistic-pending':
    case 'optimistic-rollback':
      return clientState.data;
    case 'degraded':
      return clientState.data ?? [];
    default:
      return [];
  }
};

export const stateAnnouncement = (
  state: ServerInitialState,
  requestId: string,
): string => {
  const parsed = parseContractState(state);
  if (parsed.success) {
    const status = parsed.data.status;
    switch (status) {
      case 'idle':
        return 'Ready. No request is in progress.';
      case 'loading':
        return parsed.data.preserveSafePriorContent
          ? 'Refreshing current records while preserving safe content.'
          : 'Loading current records.';
      case 'validation_error':
        return 'Review the highlighted values.';
      case 'unauthenticated':
        return 'Your session is required before protected records can be shown.';
      case 'capability_gate':
        return 'This action is unavailable for the current server capability.';
      case 'step_up_required':
        return 'Verification is required before this action can continue. Continue to verify; your place is kept.';
      case 'not_found':
        return 'The requested record is not available.';
      case 'conflict':
        return `Review the current server version ${parsed.data.currentVersion} before retrying.`;
      case 'rate_wait':
        return `The server asked us to wait until ${parsed.data.retryAt}.`;
      case 'dependency_error':
        return `The dependency is unavailable. Request ID: ${requestId}. Retry is safe.`;
      case 'empty':
        return 'No records match the current view.';
      case 'success':
        return 'Current records loaded from the canonical response.';
      case 'optimistic_pending':
        return `Command pending reconciliation. Operation ID: ${parsed.data.operationId}.`;
      case 'optimistic_rollback':
        return 'The command was not accepted. The canonical record was restored.';
      case 'disabled':
        return `Action unavailable: ${parsed.data.prerequisite}.`;
      case 'degraded':
        return parsed.data.lastKnownGood === null
          ? `Canonical data is unavailable. Request ID: ${requestId}.`
          : `Showing the last verified record for ${parsed.data.scope}. Freshness: ${parsed.data.lastKnownGood.verifiedAt}. Request ID: ${requestId}.`;
    }
  }

  const clientState = state as AsyncState<readonly InfrastructureRecord[]>;
  switch (clientState.status) {
    case 'idle':
      return 'Ready. No request is in progress.';
    case 'loading':
      return clientState.preserveSafePriorContent
        ? 'Refreshing current records while preserving safe content.'
        : 'Loading current records.';
    case 'error':
      return `${clientState.error.message} Request ID: ${clientState.error.requestId}.`;
    case 'empty':
      return 'No records match the current view.';
    case 'success':
      return 'Current records loaded from the canonical response.';
    case 'optimistic-pending':
      return `Command pending reconciliation. Operation ID: ${clientState.operationId}.`;
    case 'optimistic-rollback':
      return 'The command was not accepted. The canonical record was restored.';
    case 'disabled':
      return `Action unavailable: ${clientState.reason}.`;
    case 'degraded':
      return clientState.lastVerifiedAt === null
        ? `Canonical data is unavailable. Request ID: ${requestId}.`
        : `Showing last-known-good data verified at ${clientState.lastVerifiedAt}. Request ID: ${requestId}.`;
  }
};

export const queryFromRecord = (
  query: Readonly<Record<string, string>>,
): InfrastructureNavigationQuery =>
  parseWorkbenchQuery(new URLSearchParams(Object.entries(query)));

export const toQueryRecord = (
  query: InfrastructureNavigationQuery,
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
};

export const formatFact = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unavailable';
  }
};
