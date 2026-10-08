import type { JsonValue } from '@wejammin/contracts';

import type {
  CmsEditorialEntryRevisionResource,
  CmsEditorialRevisionHistoryPage,
} from './cms-editorial-contracts';

/**
 * Browser-side projections of the locked FE03 shared types
 * (.memory/wiki/specs/fe/03-cms-content-modeling.md lines 51-122) and the
 * locked `EditorialWorkflowPublicationWorkbench` contract (lines 246-372).
 */

export interface CmsEditorialUiError {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details: Readonly<Record<string, unknown>> | null;
}

export type CmsEditorialAsyncState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly startedAt: string }
  | {
      readonly status: 'error';
      readonly error: CmsEditorialUiError;
      readonly retryable: boolean;
    }
  | {
      readonly status: 'empty';
      readonly reason: 'no-records' | 'filter-miss' | 'not-disclosed';
    }
  | {
      readonly status: 'success';
      readonly data: T;
      readonly version: string;
      readonly stale: false;
    }
  | {
      readonly status: 'optimistic-pending';
      readonly data: T;
      readonly operationId: string;
      readonly version: string;
    }
  | {
      readonly status: 'optimistic-rollback';
      readonly data: T;
      readonly error: CmsEditorialUiError;
      readonly version: string;
    }
  | { readonly status: 'disabled'; readonly reason: string }
  | {
      readonly status: 'degraded';
      readonly data: T | null;
      readonly requestId: string;
      readonly lastVerifiedAt: string | null;
    };

export type CmsEditorialAccessVariant =
  'full' | 'read-only' | 'partial-hidden' | 'disabled' | 'not-rendered';

export type CmsEditorialDomainVariant =
  | 'publicPage'
  | 'appPage'
  | 'adminPage'
  | 'authPage'
  | 'degradedPage'
  | 'publicRead'
  | 'entitledRead'
  | 'ownerFull'
  | 'guardianMandate'
  | 'juniorRestricted'
  | 'businessMandate'
  | 'staffCaseScoped'
  | 'adminStepUp'
  | 'forbiddenHidden'
  | 'disabledPrerequisite';

export type CmsEditorialBreakpoint = 'mobile' | 'tablet' | 'desktop';

export type CmsEditorialResource =
  CmsEditorialEntryRevisionResource | CmsEditorialRevisionHistoryPage;

export interface CmsEditorialWorkbenchContractFields {
  readonly source: string;
  readonly fields: Readonly<Record<string, string>>;
}

export const CMS_EDITORIAL_CONTRACT_FIELDS = {
  source: 'packages/contracts/src/cms-editorial',
  fields: {
    revisionRequest: 'EntryRevisionRequest',
    revisionResource: 'EntryRevisionResource',
    historyQuery: 'RevisionHistoryQuery',
    historyPage: 'RevisionHistoryPage',
    entryId: 'EntryRevisionRequest.entryId',
    baseRevision: 'EntryRevisionRequest.baseRevision',
    changedPaths: 'EntryRevisionRequest.changedPaths',
    values: 'EntryRevisionRequest.values',
    expectedVersion: 'EntryRevisionRequest.expectedVersion',
  },
} as const satisfies CmsEditorialWorkbenchContractFields;

/**
 * CMS-03B-01 is the only 03b operation this island issues. CMS-03B-03 is a
 * protected read-only GET and never carries mutation headers or effects.
 */
export interface CmsEditorialRevisionCreateOperation {
  readonly operationId: 'CMS-03B-01';
  readonly method: 'POST';
  readonly path: '/api/v1/cms/entries/{entryId}/revisions';
  readonly request: 'EntryRevisionRequest';
  readonly response: 'EntryRevisionResource';
  readonly status: 201;
  readonly browserPolicy: 'human-form';
}

export const CMS_EDITORIAL_REVISION_CREATE_OPERATION = {
  operationId: 'CMS-03B-01',
  method: 'POST',
  path: '/api/v1/cms/entries/{entryId}/revisions',
  request: 'EntryRevisionRequest',
  response: 'EntryRevisionResource',
  status: 201,
  browserPolicy: 'human-form',
} as const satisfies CmsEditorialRevisionCreateOperation;

export type CmsEditorialErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'DEPENDENCY_INVALID_RESPONSE'
  | 'DEPENDENCY_DEADLINE_EXCEEDED'
  | 'INTERNAL_ERROR';

export const CMS_EDITORIAL_SAFE_ERROR_MESSAGES: Readonly<
  Record<CmsEditorialErrorCode, string>
> = {
  INVALID_REQUEST: 'The revision request is invalid.',
  UNAUTHENTICATED: 'Your session expired. Sign in again to keep editing.',
  FORBIDDEN:
    'You no longer have assignment to this entry. Your unsent edits are kept in this browser only.',
  NOT_FOUND: 'This entry or revision is not available.',
  CONFLICT:
    'This entry changed elsewhere. Review the current version before saving again.',
  UNSUPPORTED_MEDIA_TYPE: 'The revision request format is not supported.',
  VALIDATION_FAILED: 'Check the highlighted fields.',
  RATE_LIMITED: 'Too many saves. Try again shortly.',
  PAYLOAD_TOO_LARGE: 'This revision is too large to save.',
  DEPENDENCY_UNAVAILABLE:
    'Saving is unavailable right now. Editing continues; nothing was published.',
  DEPENDENCY_INVALID_RESPONSE:
    'The save result could not be verified. Check the current version before retrying.',
  DEPENDENCY_DEADLINE_EXCEEDED:
    'The save did not finish in time. Check the current version before retrying.',
  INTERNAL_ERROR:
    'Saving failed unexpectedly. Check the current version before retrying.',
};

export const safeCmsEditorialErrorMessage = (code: string): string =>
  Object.hasOwn(CMS_EDITORIAL_SAFE_ERROR_MESSAGES, code)
    ? CMS_EDITORIAL_SAFE_ERROR_MESSAGES[code as CmsEditorialErrorCode]
    : CMS_EDITORIAL_SAFE_ERROR_MESSAGES.INTERNAL_ERROR;

/** A stable field identity from the active compiled schema (03a). */
export interface CmsEditorialDraftField {
  readonly fieldId: string;
  readonly fieldKey: string;
  readonly value: JsonValue;
}

/**
 * The editable draft the workbench renders. It is supplied by the authorised
 * server loader (`loadEntryEditPage` over CMS-03B-11); the browser never reads
 * protected values directly.
 */
export interface CmsEditorialEntryDraft {
  readonly entryId: string;
  readonly entryLifecycle: 'active';
  readonly baseRevision: string;
  readonly expectedVersion: string;
  readonly locale: string;
  readonly schemaVersionId: string;
  readonly fields: readonly CmsEditorialDraftField[];
}

export interface CmsEditorialWorkbenchProps {
  readonly contractFields: CmsEditorialWorkbenchContractFields;
  readonly children?: never;
  readonly variant: CmsEditorialDomainVariant;
  readonly initial: CmsEditorialAsyncState<CmsEditorialResource>;
  readonly actorId: string;
  readonly actingPartyId: string;
  readonly access: CmsEditorialAccessVariant;
  readonly query: CmsEditorialQuery | null;
  readonly selectedId: string | null;
  readonly expectedVersion: string | null;
  readonly onCanonicalRefetch: (
    reason: 'navigation' | 'realtime-hint' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}

export interface CmsEditorialQuery {
  readonly entryId: string;
  readonly cursor?: string | null;
  readonly limit?: number;
  readonly state?: string;
  readonly compareRevisionId?: string;
  readonly locale?: string;
}
