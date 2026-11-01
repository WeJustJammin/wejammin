import {
  CmsLineageIdSchema,
  type TaxonomySelectorPage,
  type TaxonomyTermListPage,
} from '@wejammin/contracts';

import type { TaxonomyRpc } from './cms-composition-production-taxonomy-definition-versions';
import { isRecord } from './cms-editorial-production-errors';
import {
  failure,
  type CmsTaxonomyDefinitionDependencies,
  type TaxonomyBaseInput,
} from './cms-composition/taxonomy-definition-shared';
import {
  validSelectorPage,
  validTermsPage,
} from './cms-composition/taxonomy-read-pages';

/** A safe read: GET, the operation's own path, no precondition header, no body (BE00 step 6, 8). */
const bareGet = (input: TaxonomyBaseInput, pathname: string): boolean => {
  const { request } = input;
  const contentLength = request.headers.get('content-length');
  return (
    request.method === 'GET' &&
    new URL(request.url).pathname === pathname &&
    !request.headers.has('if-match') &&
    !request.headers.has('idempotency-key') &&
    !request.headers.has('content-type') &&
    request.body === null &&
    !request.headers.has('transfer-encoding') &&
    (contentLength === null || contentLength === '0')
  );
};

/**
 * cmsTaxonomyTermsRead over `platform_api.cms_list_taxonomy_terms`. The RPC answers the witness
 * `{ taxonomyId, page }`: an empty page of a visible vocabulary can never be mistaken for an absent one (that is a 404),
 * and a page is unwrapped only after the witness names the lineage that was asked for. The signed cursor and the
 * limit travel unchanged; the database binds the cursor to the query and the caller.
 */
export const createTaxonomyTermsReader =
  (rpc: TaxonomyRpc): CmsTaxonomyDefinitionDependencies['readTerms'] =>
  async (input, signal) => {
    const { query, taxonomyId } = input;
    if (
      input.operationId !== 'cmsTaxonomyTermsRead' ||
      !CmsLineageIdSchema.safeParse(taxonomyId).success ||
      !bareGet(input, `/api/v1/cms/taxonomies/${taxonomyId}/terms`)
    )
      return failure(400);
    const result = await rpc(
      input,
      {
        taxonomyId,
        ...(query.lifecycle === undefined
          ? {}
          : { lifecycle: query.lifecycle }),
        ...(query.cursor == null ? {} : { cursor: query.cursor }),
        limit: query.limit,
      },
      (value): value is { taxonomyId: string; page: TaxonomyTermListPage } =>
        isRecord(value) &&
        Object.keys(value).length === 2 &&
        value.taxonomyId === taxonomyId &&
        validTermsPage(value.page, query),
      signal,
    );
    return result.ok ? { ok: true, value: result.value.page } : result;
  };

/** CMS-03C-17 over `platform_api.cms_list_taxonomy_selector`: the strict `TaxonomySelectorPage` itself (no path id, no witness). */
export const createTaxonomySelectorReader =
  (rpc: TaxonomyRpc): CmsTaxonomyDefinitionDependencies['readSelector'] =>
  async (input, signal) => {
    const { query } = input;
    if (
      input.operationId !== 'CMS-03C-17' ||
      !bareGet(input, '/api/v1/cms/taxonomies/selector')
    )
      return failure(400);
    return rpc(
      input,
      {
        typeKey: query.typeKey,
        fieldKey: query.fieldKey,
        locale: query.locale,
        ...(query.cursor == null ? {} : { cursor: query.cursor }),
        limit: query.limit,
      },
      (value): value is TaxonomySelectorPage => validSelectorPage(value, query),
      signal,
    );
  };
