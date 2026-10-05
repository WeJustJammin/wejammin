import type { SchemaReviewResource } from '../../server/content-schema-registry-contracts';
import type { ContentSchemaRegistryUiError } from './content-schema-registry-types';

/** CMS-03A-13 read state; separate from list and detail (FE03 reviewState). */
export type ContentSchemaRegistryReviewState =
  | { readonly status: 'idle' | 'loading' }
  | {
      readonly status: 'success';
      readonly data: SchemaReviewResource;
      readonly version: string;
      readonly stale: boolean;
    }
  | { readonly status: 'empty'; readonly reason: 'not-disclosed' }
  | {
      readonly status: 'error';
      readonly error: ContentSchemaRegistryUiError;
      readonly retryable: boolean;
      readonly httpStatus?: number;
      readonly retryAfterSeconds?: number | null;
    }
  | {
      readonly status: 'degraded';
      readonly data: SchemaReviewResource | null;
      readonly requestId?: string;
      readonly lastVerifiedAt: string | null;
      readonly retryable?: boolean;
      readonly httpStatus?: number;
      readonly retryAfterSeconds?: number | null;
    }
  | { readonly status: 'disabled'; readonly reason: string };
