import type { CompositionObservation } from './observability-observation';
import {
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
  TaxonomyVersionResourceSchema,
  TaxonomyVersionsPageSchema,
  type TaxonomySelectorPage,
  type TaxonomySelectorQuery,
  type TaxonomyTermListPage,
  type TaxonomyTermListQuery,
  type TaxonomyVersionRequest,
  type TaxonomyVersionResource,
  type TaxonomyVersionsPage,
} from '@wejammin/contracts';
import type { CmsEditorialSession } from '../cms-editorial/types';
import type { CmsEditorialProductionError } from '../cms-editorial-production-types';
import { validHumanSession } from '../cms-editorial/admission-identity';
import { validEnvelope, validRateDecision } from './template-shared';
import {
  TAXONOMY_RATES,
  type TaxonomyOperation,
  type TaxonomyRateOperation,
  type TaxonomyRateRow,
} from './taxonomy-rpc-table';

export { validEnvelope } from './template-shared';
export const TAXONOMY_BYTES = 256 * 1024;
export type { TaxonomyOperation };
export type CmsTaxonomyDefinitionError = CmsEditorialProductionError;
export type CmsTaxonomyDefinitionResult<T> =
  Readonly<{ ok: true; value: T }> | CmsTaxonomyDefinitionError;
export type TaxonomyBaseInput = Readonly<{
  operationId: TaxonomyOperation;
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
}>;
export type CmsTaxonomyDefinitionWriteInput = TaxonomyBaseInput &
  Readonly<{
    operationId: 'CMS-03C-16';
    body: TaxonomyVersionRequest;
    idempotencyKey: string;
    ifMatch: string | null;
  }>;
export type CmsTaxonomyDefinitionVersionsInput = TaxonomyBaseInput &
  Readonly<{
    operationId: 'cmsTaxonomyVersionsRead';
    taxonomyId: string;
  }>;
/** cmsTaxonomyTermsRead: the vocabulary lineage id and the strict query (the limit default already applied). */
export type CmsTaxonomyTermsInput = TaxonomyBaseInput &
  Readonly<{
    operationId: 'cmsTaxonomyTermsRead';
    taxonomyId: string;
    query: TaxonomyTermListQuery;
  }>;
/** CMS-03C-17: the strict query (the limit default already applied); the selector has no path id. */
export type CmsTaxonomySelectorInput = TaxonomyBaseInput &
  Readonly<{ operationId: 'CMS-03C-17'; query: TaxonomySelectorQuery }>;
export type TaxonomyRateInput = Readonly<{
  operationId: TaxonomyOperation;
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: TaxonomyRateRow['rateClass'];
  rateScope: 'user' | 'party';
  limit: number;
  windowSeconds: 60;
}>;
export type TaxonomyRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;
export type TaxonomyTelemetry = Readonly<{
  operationId: TaxonomyOperation;
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
}>;
export type CmsTaxonomyDefinitionDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  maxResponseBytes?: number;
  deadlineMs?: number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<CmsEditorialSession>>;
  rateLimit: (
    input: TaxonomyRateInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<TaxonomyRateDecision>>;
  createVersion: (
    input: CmsTaxonomyDefinitionWriteInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<TaxonomyVersionResource>>;
  readVersions: (
    input: CmsTaxonomyDefinitionVersionsInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<TaxonomyVersionsPage>>;
  readTerms: (
    input: CmsTaxonomyTermsInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<TaxonomyTermListPage>>;
  readSelector: (
    input: CmsTaxonomySelectorInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyDefinitionResult<TaxonomySelectorPage>>;
  telemetry: (event: TaxonomyTelemetry) => void | Promise<void>;
}>;

export const failure = (
  status: CmsTaxonomyDefinitionError['status'],
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): CmsTaxonomyDefinitionError => {
  const code = cmsCompositionCatalogCode('CMS-03C-16', status)!;
  return {
    ok: false,
    status,
    code,
    message: cmsCompositionCatalogMessage('taxonomy', code),
    details,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
};
export const boundedBytes = (value = TAXONOMY_BYTES): number =>
  Number.isSafeInteger(value) && value > 0
    ? Math.min(value, TAXONOMY_BYTES)
    : TAXONOMY_BYTES;
export const MIN_TAXONOMY_ERROR_BYTES = new TextEncoder().encode(
  JSON.stringify({
    code: failure(502).code,
    message: failure(502).message,
    requestId: '00000000-0000-4000-8000-000000000000',
    details: {},
  }),
).byteLength;
export const validDraft = (
  value: unknown,
  body: TaxonomyVersionRequest,
): value is TaxonomyVersionResource => {
  const parsed = TaxonomyVersionResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const row = parsed.data;
  return (
    row.state === 'draft' &&
    row.taxonomyKey === body.taxonomyKey &&
    row.version === String(row.taxonomyVersion) &&
    BigInt(row.version) === BigInt(body.expectedVersion ?? '0') + 1n &&
    row.shape === body.shape &&
    JSON.stringify(row.allowedTypeKeys) ===
      JSON.stringify(body.allowedTypeKeys) &&
    JSON.stringify(row.allowedFieldKeys) ===
      JSON.stringify(body.allowedFieldKeys) &&
    JSON.stringify(row.canonicalOverlapDomains) ===
      JSON.stringify(body.canonicalOverlapDomains)
  );
};
export const validVersions = (
  value: unknown,
  taxonomyId: string,
): value is TaxonomyVersionsPage => {
  const parsed = TaxonomyVersionsPageSchema.safeParse(value);
  return (
    parsed.success &&
    parsed.data.items.every(
      (row) =>
        row.taxonomyId === taxonomyId &&
        row.version === String(row.taxonomyVersion),
    )
  );
};
export const humanSessionError = (
  session: CmsEditorialSession,
): CmsTaxonomyDefinitionError | null => {
  if (
    typeof session !== 'object' ||
    session === null ||
    validHumanSession(session) !== null
  )
    return failure(401);
  return null;
};
export const curatorError = (
  session: CmsEditorialSession,
): CmsTaxonomyDefinitionError | null => {
  const malformed = humanSessionError(session);
  if (malformed !== null) return malformed;
  return session.actingPartyId === null ||
    !session.capabilities.includes('cms.taxonomy_curator')
    ? failure(403, { reasonCode: 'capability_missing' })
    : null;
};
/** CMS-03C-17 is the author-facing selector: `cms.author` or `cms.editor` (BE03c 179, 1478); every other operation is the curator's. */
export const authorEditorError = (
  session: CmsEditorialSession,
): CmsTaxonomyDefinitionError | null => {
  const malformed = humanSessionError(session);
  if (malformed !== null) return malformed;
  return session.actingPartyId === null ||
    !(
      session.capabilities.includes('cms.author') ||
      session.capabilities.includes('cms.editor')
    )
    ? failure(403, { reasonCode: 'capability_missing' })
    : null;
};
export const operationAuthority = (
  session: CmsEditorialSession,
  operationId: TaxonomyOperation,
): CmsTaxonomyDefinitionError | null =>
  operationId === 'CMS-03C-17'
    ? authorEditorError(session)
    : curatorError(session);
export const quota = async (
  dependencies: CmsTaxonomyDefinitionDependencies,
  input: TaxonomyBaseInput,
  signal: AbortSignal,
): Promise<CmsTaxonomyDefinitionError | null> => {
  const authority = operationAuthority(input.session, input.operationId);
  if (authority !== null) return authority;
  const row = TAXONOMY_RATES[input.operationId as TaxonomyRateOperation];
  for (const rateScope of ['user', 'party'] as const) {
    if (signal.aborted) return failure(504, {}, 5);
    const limit = rateScope === 'user' ? row.user : row.party;
    const result = await dependencies.rateLimit(
      {
        operationId: input.operationId,
        request: input.request,
        rateScope,
        limit,
        actorId:
          rateScope === 'user'
            ? input.session.userId
            : input.session.actingPartyId!,
        actingPartyId: input.session.actingPartyId!,
        principalClass: 'human',
        rateClass: row.rateClass,
        windowSeconds: 60,
      },
      signal,
    );
    if (!validEnvelope<TaxonomyRateDecision>(result)) return failure(502);
    if (!result.ok) return result;
    if (!validRateDecision(result.value, limit)) return failure(502);
    if (!result.value.allowed) {
      const retry = Math.max(
        1,
        result.value.resetAt - Math.floor(dependencies.now() / 1000),
      );
      return failure(
        429,
        {
          retryAfterSeconds: retry,
          limit,
          resetAt: String(result.value.resetAt),
        },
        retry,
      );
    }
  }
  return null;
};
