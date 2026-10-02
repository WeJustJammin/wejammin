import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type { ContentSchemaRegistryWorkbenchProjection } from './content-schema-registry-canonical-state-validate';
import type {
  ContentSchemaRegistryAccess,
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryReviewState,
  ContentSchemaRegistryVariant,
} from './content-schema-registry-types';

/** React-ownable projection state (the fields the Island may re-render). */
export interface ContentSchemaRegistryProjectionState {
  readonly access: ContentSchemaRegistryAccess;
  readonly variant: ContentSchemaRegistryVariant;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly initialReview: ContentSchemaRegistryReviewState | null;
  readonly actingContextLabel?: string;
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
}

export const initialProjectionState = (props: {
  readonly access: ContentSchemaRegistryAccess;
  readonly variant: ContentSchemaRegistryVariant;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly initialReview?: ContentSchemaRegistryReviewState | null | undefined;
  readonly actingContextLabel?: string;
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
}): ContentSchemaRegistryProjectionState => ({
  access: props.access,
  variant: props.variant,
  initialList: props.initialList,
  initialDetail: props.initialDetail,
  initialReview: props.initialReview ?? null,
  ...(props.actingContextLabel === undefined
    ? {}
    : { actingContextLabel: props.actingContextLabel }),
  ...(props.stepUpState === undefined
    ? {}
    : { stepUpState: props.stepUpState }),
  ...(props.stepUpFreshUntil === undefined
    ? {}
    : { stepUpFreshUntil: props.stepUpFreshUntil }),
});

export const applyProjection = (
  current: ContentSchemaRegistryProjectionState,
  projection: ContentSchemaRegistryWorkbenchProjection,
): ContentSchemaRegistryProjectionState => ({
  access: projection.access,
  variant: projection.variant,
  initialList: projection.initialList,
  initialDetail: projection.initialDetail,
  initialReview: projection.initialReview,
  ...(projection.actingContextLabel === undefined
    ? {}
    : { actingContextLabel: projection.actingContextLabel }),
  ...(projection.stepUpState === undefined
    ? {}
    : { stepUpState: projection.stepUpState }),
  ...(projection.stepUpFreshUntil === undefined
    ? {}
    : { stepUpFreshUntil: projection.stepUpFreshUntil }),
});

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
