import type { ReleaseEnvelopeHeaders } from './contracts';
import type { CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS } from '@wejammin/contracts';

export type ContentSchemaRegistryOperationId =
  | 'CMS-03A-01'
  | 'CMS-03A-02'
  | 'CMS-03A-03'
  | 'CMS-03A-04'
  | 'CMS-03A-05'
  | 'CMS-03A-06'
  | 'CMS-03A-07'
  | 'CMS-03A-08'
  | 'CMS-03A-09'
  | 'CMS-03A-10'
  | 'CMS-03A-11'
  | 'CMS-03A-12'
  | 'CMS-03A-13'
  | 'CMS-03A-14'
  | 'CMS-03A-15'
  | 'CMS-03A-16'
  | 'CMS-03A-17'
  | 'CMS-03A-18';

/** Stable scrubbed identifier for the operational runbook. */
export const CONTENT_SCHEMA_REGISTRY_RUNBOOK =
  'content-schema-registry' as const;

export type ContentSchemaRegistrySession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
  /**
   * Server-derived expiry of the verified step-up window. Present only when
   * verified step-up is currently fresh; the browser may disclose but never
   * authorize from it. Derived from the authenticated step-up time only.
   */
  stepUpFreshUntil?: string;
  /** Optional server-selected UI scope; never read from browser input. */
  presentationVariant?: (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number];
}>;

export type ReleasePrincipal = Readonly<{
  principalId: string;
  keyId: string;
  capabilities: readonly string[];
  verifiedAt: string;
  rawBodyHash: string;
  signatureHash: string;
  nonceHash: string;
}>;

export type ContentSchemaRegistryError = Readonly<{
  ok: false;
  status:
    400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

export type ContentSchemaRegistryResult<T> =
  Readonly<{ ok: true; value: T }> | ContentSchemaRegistryError;

export type VerifiedReleaseInput = Readonly<{
  operationId: 'CMS-03A-05' | 'CMS-03A-08';
  requestId: string;
  request: Request;
  rawBody: Uint8Array;
  headers: ReleaseEnvelopeHeaders;
}>;

/** Operations admitted as a human browser mutation (JSON body, CSRF). */
export type HumanMutationOperationId =
  | 'CMS-03A-01'
  | 'CMS-03A-02'
  | 'CMS-03A-03'
  | 'CMS-03A-04'
  | 'CMS-03A-09'
  | 'CMS-03A-10'
  | 'CMS-03A-11'
  | 'CMS-03A-12'
  | 'CMS-03A-14'
  | 'CMS-03A-15'
  | 'CMS-03A-16'
  | 'CMS-03A-17';

/** Operations admitted as a human protected read (no body, no mutation header). */
export type HumanReadOperationId =
  'CMS-03A-06' | 'CMS-03A-07' | 'CMS-03A-13' | 'CMS-03A-18';
