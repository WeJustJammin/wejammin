import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type { ContentSchemaRegistryWorkbenchProjection } from './content-schema-registry-canonical-state-validate';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryReviewState,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';

/** When each slot's data was last verified by a canonical read (ISO instant). */
export interface ContentSchemaRegistryVerifiedAt {
  readonly list: string;
  readonly detail: string;
  readonly review: string;
}

/** React-ownable projection state (the fields the Island may re-render). */
export interface ContentSchemaRegistryProjectionState {
  readonly access: ContentSchemaRegistryAccess;
  readonly variant: ContentSchemaRegistryVariant;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly initialReview: ContentSchemaRegistryReviewState | null;
  readonly verifiedAt: ContentSchemaRegistryVerifiedAt;
  readonly actingContextLabel?: string;
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
}

const nowIso = (): string => new Date().toISOString();

export const initialProjectionState = (
  props: {
    readonly access: ContentSchemaRegistryAccess;
    readonly variant: ContentSchemaRegistryVariant;
    readonly initialList: ContentSchemaRegistryListState;
    readonly initialDetail: ContentSchemaRegistryDetailState | null;
    readonly initialReview?:
      ContentSchemaRegistryReviewState | null | undefined;
    readonly actingContextLabel?: string;
    readonly stepUpState?: ContentSchemaRegistryStepUpState;
    readonly stepUpFreshUntil?: string;
  },
  now: () => string = nowIso,
): ContentSchemaRegistryProjectionState => {
  const hydratedAt = now();
  return {
    access: props.access,
    variant: props.variant,
    initialList: props.initialList,
    initialDetail: props.initialDetail,
    initialReview: props.initialReview ?? null,
    verifiedAt: {
      list: hydratedAt,
      detail: hydratedAt,
      review: hydratedAt,
    },
    ...(props.actingContextLabel === undefined
      ? {}
      : { actingContextLabel: props.actingContextLabel }),
    ...(props.stepUpState === undefined
      ? {}
      : { stepUpState: props.stepUpState }),
    ...(props.stepUpFreshUntil === undefined
      ? {}
      : { stepUpFreshUntil: props.stepUpFreshUntil }),
  };
};

type Slot<Data> =
  | { readonly status: 'success'; readonly data: Data }
  | {
      readonly status: 'degraded';
      readonly data: Data | null;
      readonly lastVerifiedAt: string | null;
    }
  | { readonly status: string };

/**
 * FE03 `degraded`: a read that is unavailable keeps the last verified data and
 * names when it was verified. The server cannot supply either (it is stateless
 * and answers `data: null`), so the browser keeps what its own canonical reads
 * last verified. A slot that was never verified with data stays empty.
 */
const keepLastVerified = <State extends Slot<unknown> | null>(
  current: State,
  next: State,
  verifiedAt: string,
): State => {
  if (next === null || next.status !== 'degraded') return next;
  const degraded = next as Extract<Slot<unknown>, { status: 'degraded' }>;
  if (degraded.data !== null || current === null) return next;
  if (current.status === 'success')
    return {
      ...next,
      data: (current as { readonly data: unknown }).data,
      lastVerifiedAt: verifiedAt,
    };
  if (current.status === 'degraded') {
    const held = current as Extract<Slot<unknown>, { status: 'degraded' }>;
    if (held.data !== null)
      return {
        ...next,
        data: held.data,
        lastVerifiedAt: held.lastVerifiedAt ?? verifiedAt,
      };
  }
  return next;
};

const keptData = (state: Slot<unknown> | null, next: Slot<unknown> | null) =>
  next !== null &&
  next.status === 'degraded' &&
  (state as { readonly data?: unknown } | null)?.data !== null &&
  (state as { readonly data?: unknown } | null)?.data !== undefined;

export const applyProjection = (
  current: ContentSchemaRegistryProjectionState,
  projection: ContentSchemaRegistryWorkbenchProjection,
  now: () => string = nowIso,
): ContentSchemaRegistryProjectionState => {
  const appliedAt = now();
  const initialList = keepLastVerified(
    current.initialList,
    projection.initialList,
    current.verifiedAt.list,
  );
  const initialDetail = keepLastVerified(
    current.initialDetail,
    projection.initialDetail,
    current.verifiedAt.detail,
  );
  const initialReview = keepLastVerified(
    current.initialReview,
    projection.initialReview,
    current.verifiedAt.review,
  );
  return {
    access: projection.access,
    variant: projection.variant,
    initialList,
    initialDetail,
    initialReview,
    verifiedAt: {
      list: keptData(initialList, projection.initialList)
        ? current.verifiedAt.list
        : appliedAt,
      detail: keptData(initialDetail, projection.initialDetail)
        ? current.verifiedAt.detail
        : appliedAt,
      review: keptData(initialReview, projection.initialReview)
        ? current.verifiedAt.review
        : appliedAt,
    },
    ...(projection.actingContextLabel === undefined
      ? {}
      : { actingContextLabel: projection.actingContextLabel }),
    ...(projection.stepUpState === undefined
      ? {}
      : { stepUpState: projection.stepUpState }),
    ...(projection.stepUpFreshUntil === undefined
      ? {}
      : { stepUpFreshUntil: projection.stepUpFreshUntil }),
  };
};

/** Remove protected authority: failure or denial keeps only the disabled gate. */
export const toDisabledProjection = (
  current: ContentSchemaRegistryProjectionState,
  reason: string,
): ContentSchemaRegistryProjectionState => ({
  ...current,
  access: 'disabled',
  initialList: { status: 'disabled', reason },
  initialDetail:
    current.initialDetail === null ? null : { status: 'disabled', reason },
  initialReview:
    current.initialReview === null ? null : { status: 'disabled', reason },
});
