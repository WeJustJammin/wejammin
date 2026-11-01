import type { TaxonomyVersionRequest } from '@wejammin/contracts';
import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import {
  sendTaxonomyMutation,
  type TaxonomyMutationOutcome,
} from './taxonomy-transport';

export const TAXONOMY_WRITE_PATH = '/api/v1/cms/taxonomies/versions';

/** The facts of a saved draft the form shows; nothing else of the resource is kept. */
export interface TaxonomyCreatedFacts {
  readonly id: string;
  readonly taxonomyId: string;
  readonly taxonomyKey: string;
  readonly taxonomyVersion: number;
  readonly version: string;
}

export type TaxonomySubmitResult =
  | { readonly kind: 'created'; readonly resource: TaxonomyCreatedFacts }
  | Exclude<TaxonomyMutationOutcome, { kind: 'success' }>;

const sameList = (left: unknown, right: readonly string[]): boolean =>
  Array.isArray(left) && JSON.stringify(left) === JSON.stringify(right);

/** The draft that answers this request (the proxy's own binding, repeated), or null. */
const createdFacts = (
  resource: unknown,
  request: TaxonomyVersionRequest,
  etag: string | null,
): TaxonomyCreatedFacts | null => {
  if (typeof resource !== 'object' || resource === null) return null;
  const record = resource as Readonly<Record<string, unknown>>;
  const { id, taxonomyId, version, taxonomyVersion } = record;
  if (
    typeof id !== 'string' ||
    !isCmsUuid(id) ||
    typeof taxonomyId !== 'string' ||
    !isCmsUuid(taxonomyId) ||
    typeof version !== 'string' ||
    !isCmsVersion(version) ||
    typeof taxonomyVersion !== 'number' ||
    version !== String(taxonomyVersion) ||
    BigInt(version) !== BigInt(request.expectedVersion ?? '0') + 1n ||
    record.state !== 'draft' ||
    record.taxonomyKey !== request.taxonomyKey ||
    record.shape !== request.shape ||
    !sameList(record.allowedTypeKeys, request.allowedTypeKeys) ||
    !sameList(record.allowedFieldKeys, request.allowedFieldKeys) ||
    !sameList(
      record.canonicalOverlapDomains,
      request.canonicalOverlapDomains,
    ) ||
    etag !== `"${version}"`
  )
    return null;
  return {
    id,
    taxonomyId,
    taxonomyKey: request.taxonomyKey,
    taxonomyVersion,
    version,
  };
};

/** Send one CMS-03C-16 request; the browser never sends an authority claim. */
export const submitTaxonomyVersion = async (
  request: TaxonomyVersionRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<TaxonomySubmitResult> => {
  const outcome = await sendTaxonomyMutation({
    operation: 'CMS-03C-16',
    url: TAXONOMY_WRITE_PATH,
    body: JSON.stringify(request),
    csrfToken,
    idempotencyKey,
    ifMatch:
      request.expectedVersion === null ? null : `"${request.expectedVersion}"`,
    successStatus: 201,
    fetcher,
  });
  if (outcome.kind !== 'success') return outcome;
  const facts = createdFacts(outcome.body, request, outcome.etag);
  return facts === null
    ? { kind: 'uncertain' }
    : { kind: 'created', resource: facts };
};
