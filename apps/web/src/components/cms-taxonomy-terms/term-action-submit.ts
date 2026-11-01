import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import {
  sendTaxonomyMutation,
  type TaxonomyMutationOutcome,
} from '../cms-taxonomy-designer/taxonomy-transport';
import { TERM_KEY_REGEX } from './term-rules';
import { TERM_LIFECYCLES, type TermLifecycle } from './taxonomy-terms-read';

/** The term a committed action answered; nothing else of the resource is kept. */
export interface TermDoneFacts {
  readonly termId: string;
  readonly termKey: string;
  readonly lifecycle: TermLifecycle;
  readonly parentId: string | null;
  readonly successorId: string | null;
  readonly version: string;
}

export type TermActionResult =
  | { readonly kind: 'done'; readonly term: TermDoneFacts }
  | Exclude<TaxonomyMutationOutcome, { kind: 'success' }>;

const uuidOrNull = (value: unknown): string | null | undefined =>
  value === null
    ? null
    : typeof value === 'string' && isCmsUuid(value)
      ? value
      : undefined;

/**
 * The term that answers this action (the proxy's and the Worker's own binding, repeated;
 * BE03c 1377): the term row's own version (1 on create, later after any other action), the
 * stored lifecycle, the requested parent only on create and rename and the survivor as the
 * successor of a merge.
 */
const doneFacts = (
  resource: unknown,
  request: TaxonomyTermActionRequest,
  etag: string | null,
): TermDoneFacts | null => {
  if (typeof resource !== 'object' || resource === null) return null;
  const record = resource as Readonly<Record<string, unknown>>;
  const { id, termId, termKey, lifecycle, version } = record;
  const parentId = uuidOrNull(record.parentId);
  const successorId = uuidOrNull(record.successorId);
  const { action } = request;
  const first = action === 'create';
  const allowed: readonly string[] =
    action === 'merge'
      ? ['merged']
      : action === 'deprecate'
        ? ['deprecated']
        : first
          ? ['active']
          : ['active', 'deprecated'];
  if (
    typeof id !== 'string' ||
    id !== termId ||
    typeof termId !== 'string' ||
    !isCmsUuid(termId) ||
    record.taxonomyId !== request.taxonomyId ||
    typeof termKey !== 'string' ||
    !TERM_KEY_REGEX.test(termKey) ||
    termKey !== request.termKey ||
    typeof lifecycle !== 'string' ||
    !(TERM_LIFECYCLES as readonly string[]).includes(lifecycle) ||
    !allowed.includes(lifecycle) ||
    typeof version !== 'string' ||
    !isCmsVersion(version) ||
    (first ? version !== '1' : BigInt(version) < 2n) ||
    parentId === undefined ||
    (first || action === 'rename' ? parentId !== request.parentId : false) ||
    successorId === undefined ||
    successorId !== (action === 'merge' ? request.survivorId : null) ||
    etag !== `"${version}"`
  )
    return null;
  return {
    termId,
    termKey,
    lifecycle: lifecycle as TermLifecycle,
    parentId,
    successorId,
    version,
  };
};

/** Send one CMS-03C-03 request; the browser never sends an authority claim. */
export const submitTermAction = async (
  request: TaxonomyTermActionRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<TermActionResult> => {
  const outcome = await sendTaxonomyMutation({
    operation: 'CMS-03C-03',
    url: `/api/v1/cms/taxonomies/${request.taxonomyId}/terms/actions`,
    body: JSON.stringify(request),
    csrfToken,
    idempotencyKey,
    ifMatch: `"${request.expectedVersion}"`,
    successStatus: 200,
    fetcher,
  });
  if (outcome.kind !== 'success') return outcome;
  const term = doneFacts(outcome.body, request, outcome.etag);
  return term === null ? { kind: 'uncertain' } : { kind: 'done', term };
};
