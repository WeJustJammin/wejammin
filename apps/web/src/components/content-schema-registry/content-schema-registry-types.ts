import { CONTENT_SCHEMA_REGISTRY_OPERATION_IDS as GENERATED_CONTENT_SCHEMA_REGISTRY_OPERATION_IDS } from '@wejammin/contracts';
import type { ContentSchemaRegistryOperationId as GeneratedContentSchemaRegistryOperationId } from '@wejammin/contracts';
import type { ContentSchemaRegistryStepUpState } from './ContentSchemaRegistryConfirmationStep';
import type {
  ContentSchemaRegistryDetail,
  ContentSchemaRegistryListPage,
  ContentSchemaRegistryQuery,
  ContentTypeDraftRequest,
  ContentTypeVersionResource,
  FieldDefinitionVersionResource,
  FieldSchemaChangeRequest,
  RelationBindingRequest,
  RelationDefinitionResource,
  SchemaActivationRequest,
  SchemaActivationResource,
} from '../../server/content-schema-registry-contracts';
import type { ContentSchemaRegistryReviewState } from './content-schema-registry-review-types';

export type { ContentSchemaRegistryReviewState } from './content-schema-registry-review-types';
export type {
  ContentSchemaRegistryDetail,
  ContentSchemaRegistryListPage,
  ContentSchemaRegistryQuery,
  ContentSchemaRegistryRecord,
  ContentSchemaRegistryResourceKind,
  ContentSchemaRegistrySafeBlockProjection,
  ContentTypeDraftRequest,
  ContentTypeVersionResource,
  FieldDefinitionVersionResource,
  FieldSchemaChangeRequest,
  RelationBindingRequest,
  RelationDefinitionResource,
  SchemaActivationPreparation,
  SchemaActivationRequest,
  SchemaActivationResource,
  SchemaReviewResource,
} from '../../server/content-schema-registry-contracts';

export type ContentSchemaRegistryAccess =
  'full' | 'read-only' | 'disabled' | 'not-rendered';
export type ContentSchemaRegistryVariant =
  | 'degradedPage'
  | 'entitledRead'
  | 'ownerFull'
  | 'guardianMandate'
  | 'juniorRestricted'
  | 'businessMandate'
  | 'staffCaseScoped'
  | 'adminStepUp'
  | 'schemaReviewAssigned'
  | 'forbiddenHidden'
  | 'disabledPrerequisite';

export interface ContentSchemaRegistryContractFields {
  readonly source: string;
  readonly fields: Readonly<Record<string, string>>;
}

/** The browser consumes the exact operation-ID union owned by BE03a. */
export type ContentSchemaRegistryOperationId =
  GeneratedContentSchemaRegistryOperationId;

export const CONTENT_SCHEMA_REGISTRY_OPERATION_IDS =
  GENERATED_CONTENT_SCHEMA_REGISTRY_OPERATION_IDS;

export type ContentSchemaRegistryMutationRequest =
  | ContentTypeDraftRequest
  | FieldSchemaChangeRequest
  | RelationBindingRequest
  | SchemaActivationRequest;

export type ContentSchemaRegistryMutationResource =
  | ContentTypeVersionResource
  | FieldDefinitionVersionResource
  | RelationDefinitionResource
  | SchemaActivationResource;

export type ContentSchemaRegistryCommandState =
  'idle' | 'pending' | 'success' | 'error' | 'degraded' | 'disabled';

export const CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS = {
  source: 'packages/contracts/src/content-schema-registry/index.ts',
  fields: {
    resourceKind: 'ContentSchemaRegistryRecord.resourceKind',
    query: 'ContentSchemaRegistryListQuery',
    list: 'ContentSchemaRegistryListPage',
    detail: 'ContentSchemaRegistryDetail',
    blockProjection: 'BlockDefinitionRegistryRecord',
  },
} as const satisfies ContentSchemaRegistryContractFields;

export interface ContentSchemaRegistryUiError {
  readonly code: ContentSchemaRegistryErrorCode;
  readonly message: string;
  /**
   * Server-side only. Removed before hydration (see
   * `content-schema-registry-diagnostic-ids.ts`); the browser shows the
   * island's `supportReference` instead.
   */
  readonly requestId?: string;
}

export type ContentSchemaRegistryErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_INVALID_RESPONSE'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'DEPENDENCY_DEADLINE_EXCEEDED'
  | 'INTERNAL_ERROR';

export const CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES: Readonly<
  Record<ContentSchemaRegistryErrorCode, string>
> = {
  INVALID_REQUEST: 'The registry request is invalid.',
  UNAUTHENTICATED: 'Sign in to view the content schema registry.',
  FORBIDDEN: 'You do not have access to this registry.',
  NOT_FOUND: 'The requested registry record was not found.',
  VALIDATION_FAILED: 'The registry request did not pass validation.',
  RATE_LIMITED: 'Too many registry requests. Try again shortly.',
  DEPENDENCY_INVALID_RESPONSE: 'The registry returned invalid data.',
  DEPENDENCY_UNAVAILABLE: 'The registry is temporarily unavailable.',
  DEPENDENCY_DEADLINE_EXCEEDED:
    'The registry did not respond in time. Try again shortly.',
  INTERNAL_ERROR: 'The registry could not be loaded.',
};

export const safeContentSchemaRegistryErrorMessage = (code: string): string =>
  CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES[
    code as ContentSchemaRegistryErrorCode
  ] ?? 'The registry could not be loaded.';

export type ContentSchemaRegistryListState =
  | {
      readonly status: 'idle' | 'loading';
      readonly preserveSafePriorContent?: boolean;
    }
  | {
      readonly status: 'success';
      readonly data: ContentSchemaRegistryListPage;
      readonly version: string;
      readonly stale: boolean;
    }
  | {
      readonly status: 'empty';
      readonly reason: 'no-records' | 'filter-miss';
    }
  | {
      readonly status: 'error';
      readonly error: ContentSchemaRegistryUiError;
      readonly retryable: boolean;
      readonly httpStatus?: number;
      readonly retryAfterSeconds?: number | null;
    }
  | {
      readonly status: 'degraded';
      readonly data: ContentSchemaRegistryListPage | null;
      readonly code?:
        | 'DEPENDENCY_INVALID_RESPONSE'
        | 'DEPENDENCY_UNAVAILABLE'
        | 'DEPENDENCY_DEADLINE_EXCEEDED';
      /** Server-side only; removed before hydration. */
      readonly requestId?: string;
      readonly lastVerifiedAt: string | null;
      /** Server-declared dependency retry proof; absent means fail closed. */
      readonly retryable?: boolean;
      readonly httpStatus?: number;
      readonly retryAfterSeconds?: number | null;
      readonly etag?: string | null;
    }
  | {
      readonly status: 'disabled';
      readonly reason: string;
    };

export type ContentSchemaRegistryDetailState =
  | {
      readonly status: 'idle' | 'loading';
      readonly preserveSafePriorContent?: boolean;
    }
  | {
      readonly status: 'success';
      readonly data: ContentSchemaRegistryDetail;
      readonly version: string;
      readonly stale: boolean;
    }
  | {
      readonly status: 'empty';
      readonly reason: 'not-selected' | 'not-found';
    }
  | {
      readonly status: 'error';
      readonly error: ContentSchemaRegistryUiError;
      readonly retryable: boolean;
      readonly httpStatus?: number;
      readonly retryAfterSeconds?: number | null;
    }
  | {
      readonly status: 'degraded';
      readonly data: ContentSchemaRegistryDetail | null;
      readonly code?:
        | 'DEPENDENCY_INVALID_RESPONSE'
        | 'DEPENDENCY_UNAVAILABLE'
        | 'DEPENDENCY_DEADLINE_EXCEEDED';
      /** Server-side only; removed before hydration. */
      readonly requestId?: string;
      readonly lastVerifiedAt: string | null;
      /** Server-declared dependency retry proof; absent means fail closed. */
      readonly retryable?: boolean;
      readonly httpStatus?: number;
      readonly retryAfterSeconds?: number | null;
      readonly etag?: string | null;
    }
  | {
      readonly status: 'disabled';
      readonly reason: string;
    };

export interface ContentSchemaRegistryWorkbenchProps {
  readonly children?: never;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly contractFields: ContentSchemaRegistryContractFields;
  readonly variant: ContentSchemaRegistryVariant;
  readonly access: ContentSchemaRegistryAccess;
  /** Server-resolved human acting-context label; never a raw identifier. */
  readonly actingContextLabel?: string;
  /** Server-derived disclosure state for the activation step-up clause. */
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  /** Server-derived absolute expiry of the verified step-up window. */
  readonly stepUpFreshUntil?: string;
  readonly query: ContentSchemaRegistryQuery;
  readonly contentTypeId: string | null;
  readonly versionId: string | null;
  /** The exact protected review the route reads; null off the review route. */
  readonly reviewId?: string | null;
  /** CMS-03A-13 read named by `activationPreparation.reviewRef`, if any. */
  readonly initialReview?: ContentSchemaRegistryReviewState | null;
  readonly cursor: string | null;
  readonly expectedVersion: string | null;
  /**
   * User-facing support reference with no relationship to any request,
   * trace or correlation identifier (none of those cross into the island).
   */
  readonly supportReference: string;
  readonly canonicalUrl: string;
  readonly listUrl: string;
  readonly retryUrl: string;
  readonly csrfToken: string;
  /**
   * Browser-owned counter the island bumps on a trusted acting-context change
   * so a local confirmation resets without any identifier crossing the boundary.
   */
  readonly contextEpoch?: number;
  /** Browser-owned canonical refresh presentation (island only). */
  readonly loading?: boolean;
  readonly offline?: boolean;
  readonly message?: string | null;
  readonly onCanonicalRefetch: (
    reason: 'list-read' | 'detail-read' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

export interface ContentSchemaRegistryPage {
  readonly state: 'ready' | 'degraded';
  readonly variant: ContentSchemaRegistryVariant;
  readonly access: ContentSchemaRegistryAccess;
  readonly actingContextLabel?: string;
  readonly stepUpState?: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
  readonly query: ContentSchemaRegistryQuery;
  readonly contentTypeId: string | null;
  readonly versionId: string | null;
  readonly reviewId: string | null;
  readonly cursor: string | null;
  readonly expectedVersion: string | null;
  readonly supportReference: string;
  readonly canonicalUrl: string;
  readonly listUrl: string;
  readonly retryUrl: string;
  readonly csrfToken: string;
  readonly initialList: ContentSchemaRegistryListState;
  readonly initialDetail: ContentSchemaRegistryDetailState | null;
  readonly initialReview: ContentSchemaRegistryReviewState | null;
  readonly contractFields: ContentSchemaRegistryContractFields;
}
