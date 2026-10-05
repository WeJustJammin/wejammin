import type { ContentSchemaRegistryInitialFailure } from './ContentSchemaRegistryInitialFailureBoundary';
import type {
  ContentSchemaRegistryDetailState,
  ContentSchemaRegistryListState,
  ContentSchemaRegistryReviewState,
} from './content-schema-registry-types';

/**
 * The first exact server read failure of a projection: list, then detail, then
 * review. A review failure keeps its code-free shape so the shared boundary
 * renders the same request id and retry affordance.
 */
export const initialFailureOf = (state: {
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly initialReview?: ContentSchemaRegistryReviewState | null | undefined;
}): ContentSchemaRegistryInitialFailure | null => {
  const { initialList, initialDetail, initialReview } = state;
  if (initialList.status === 'error' || initialList.status === 'degraded')
    return initialList;
  if (initialDetail?.status === 'error' || initialDetail?.status === 'degraded')
    return initialDetail;
  if (initialReview?.status === 'error') return initialReview;
  if (initialReview?.status === 'degraded')
    return { ...initialReview, data: null };
  return null;
};
