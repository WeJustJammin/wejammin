import type {
  CapabilityGrantRequest,
  CmsCapabilityGrantListPage,
  CmsCapabilityGrantResource,
  GrantableCmsCapability,
} from '@wejammin/contracts';

import type { ContentSchemaRegistryStepUpState } from '../content-schema-registry/ContentSchemaRegistryConfirmationStep';
import type { ContentSchemaRegistryUiError } from '../content-schema-registry/content-schema-registry-types';

export type {
  CapabilityGrantRequest,
  CmsCapabilityGrantListPage,
  CmsCapabilityGrantResource,
  GrantableCmsCapability,
};

/** The grant console is an owner-only surface (FE03 DEC-119). */
export type CmsCapabilityGrantVariant =
  'ownerFull' | 'forbiddenHidden' | 'disabledPrerequisite';

export type CmsCapabilityGrantAccess = 'full' | 'disabled' | 'not-rendered';

export const CMS_CAPABILITY_GRANT_OPERATION_IDS = [
  'CMS-03A-15',
  'CMS-03A-16',
  'CMS-03A-17',
  'CMS-03A-18',
] as const;

export interface CmsCapabilityGrantContractFields {
  readonly source: string;
  readonly fields: Readonly<Record<string, string>>;
}

export const CMS_CAPABILITY_GRANT_CONTRACT_FIELDS = {
  source: 'packages/contracts/src/content-schema-registry/index.ts',
  fields: {
    grant: 'CapabilityGrantRequest',
    renewal: 'CapabilityGrantRenewalRequest',
    revocation: 'CapabilityGrantRevocationRequest',
    resource: 'CmsCapabilityGrantResource',
    list: 'CmsCapabilityGrantListPage',
    query: 'CmsCapabilityGrantListQuery',
  },
} as const satisfies CmsCapabilityGrantContractFields;

/** FE03 `listState` (CMS-03A-18): `AsyncState<CmsCapabilityGrantListPage>`. */
export type CmsCapabilityGrantListState =
  | { readonly status: 'idle' | 'loading' }
  | {
      readonly status: 'success';
      readonly data: CmsCapabilityGrantListPage;
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
      readonly httpStatus?: number | undefined;
      readonly retryAfterSeconds?: number | null | undefined;
    }
  | {
      readonly status: 'degraded';
      readonly data: CmsCapabilityGrantListPage | null;
      readonly requestId: string;
      readonly lastVerifiedAt: string | null;
      readonly retryable: boolean;
      readonly httpStatus?: number | undefined;
      readonly retryAfterSeconds?: number | null | undefined;
    }
  | { readonly status: 'disabled'; readonly reason: string };

/** Safe display evidence only: a label and an expiring step-up window. */
export interface CmsCapabilityGrantContextEvidence {
  readonly actingContextLabel?: string | undefined;
  readonly stepUpState: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string | undefined;
}

export interface CmsCapabilityGrantQueryState {
  readonly capability?: GrantableCmsCapability | undefined;
  readonly state?: CmsCapabilityGrantResource['state'] | undefined;
  readonly limit: number;
  readonly cursor?: string | undefined;
  readonly sort: 'updatedAt' | 'validThrough';
  readonly direction: 'asc' | 'desc';
}

/** The serializable page the Astro route spreads into the island. */
export interface CmsCapabilityGrantPage {
  readonly state: 'ready' | 'degraded';
  readonly variant: CmsCapabilityGrantVariant;
  readonly access: CmsCapabilityGrantAccess;
  readonly initialList: CmsCapabilityGrantListState;
  readonly query: CmsCapabilityGrantQueryState;
  readonly cursor: string | null;
  readonly termWindow: { readonly minDate: string; readonly maxDate: string };
  readonly requestId: string;
  readonly canonicalUrl: string;
  readonly retryUrl: string;
  readonly csrfToken: string;
  readonly contractFields: CmsCapabilityGrantContractFields;
  readonly actingContextLabel?: string;
  readonly stepUpState: ContentSchemaRegistryStepUpState;
  readonly stepUpFreshUntil?: string;
}

export interface CmsCapabilityGrantConsoleProps {
  readonly contractFields: CmsCapabilityGrantContractFields;
  readonly variant: CmsCapabilityGrantVariant;
  readonly access: CmsCapabilityGrantAccess;
  readonly initialList: CmsCapabilityGrantListState;
  readonly contextEvidence: CmsCapabilityGrantContextEvidence;
  readonly query: CmsCapabilityGrantQueryState;
  readonly termWindow: { readonly minDate: string; readonly maxDate: string };
  readonly cursor: string | null;
  readonly requestId: string;
  readonly canonicalUrl: string;
  readonly retryUrl: string;
  readonly csrfToken: string;
  readonly onCanonicalRefetch?: (
    reason: 'list-read' | 'mutation' | 'reconnect',
  ) => Promise<void>;
}
