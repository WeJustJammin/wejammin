import {
  TaxonomySelectorPageSchema,
  type TaxonomySelectorPage,
} from '@wejammin/contracts';
import { vi } from 'vitest';

import {
  PARENT_ID,
  REQUEST_ID,
  ROW_ID,
  SELECTOR_PATH,
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERM_ID,
  jsonResponse,
} from '../../server/cms-taxonomy-platform.test-support';
import { readCmsTaxonomySelector } from './cms-taxonomy-selector-read';

export {
  PARENT_ID,
  REQUEST_ID,
  ROW_ID,
  SELECTOR_PATH,
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERM_ID,
  jsonResponse,
};

/*
 * Fixtures and the fetch-boundary driver of the protected browser transport for CMS-03C-17
 * (`GET /api/v1/cms/taxonomies/selector`). `selectorPage` parses through the REAL generated
 * contract, so a fixture can never drift from the schema it stands for; `mutate` and `rawPage`
 * build the hostile variants the verifier must refuse. Only `fetch` is ever replaced.
 */

/** The entry content type key, taxonomy field key and authoring locale the control reads for. */
export const SELECTOR_QUERY = {
  typeKey: 'article',
  fieldKey: 'instruments',
  locale: 'en-US',
} as const;

export type UnknownQuery = Readonly<Record<string, unknown>>;

/** One author-facing row: an active term of an allowlisted vocabulary. */
export const selectorTerm = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  taxonomyId: TAXONOMY_ID,
  taxonomyVersionId: ROW_ID,
  taxonomyKey: 'instruments',
  shape: 'hierarchical',
  termId: TERM_ID,
  termKey: 'guitar',
  parentId: null,
  label: 'Guitar',
  ...overrides,
});

/** A distinct, contract-valid row for the given index. */
export const row = (
  index: number,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> =>
  selectorTerm({
    termId: `50000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    termKey: `term-${index}`,
    ...overrides,
  });

export const rows = (count: number): Array<Record<string, unknown>> =>
  Array.from({ length: count }, (_, index) => row(index));

/** The base page, parsed through the real contract so it is exactly what the schema allows. */
export const selectorPage = (
  overrides: Readonly<Record<string, unknown>> = {},
): TaxonomySelectorPage =>
  TaxonomySelectorPageSchema.parse({
    items: [selectorTerm()],
    nextCursor: null,
    pageVersion: '7',
    ...overrides,
  });

/** A page-shaped object that is NOT parsed: the hostile body a proxy must never relay. */
export const rawPage = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  items: [selectorTerm()],
  nextCursor: null,
  pageVersion: '7',
  ...overrides,
});

interface Plain {
  items?: unknown;
  nextCursor?: unknown;
  pageVersion?: unknown;
  [key: string]: unknown;
}

/** A hostile variant of the base page: the change is applied to a deep copy. */
export const mutate = (change: (copy: Plain) => void): unknown => {
  const copy = structuredClone(selectorPage()) as unknown as Plain;
  change(copy);
  return copy;
};

export const at = (copy: Plain, index: number): Record<string, unknown> =>
  (copy.items as Array<Record<string, unknown>>)[index] as Record<
    string,
    unknown
  >;

/** A 200 relay of the page: quoted page-version ETag and `Cache-Control: no-store`. */
export const served = (
  overrides: Readonly<Record<string, unknown>> = {},
  etag = '"7"',
): Response =>
  jsonResponse(200, selectorPage(overrides), {
    etag,
    'cache-control': 'no-store',
  });

/** Read through a `fetch` that answers once with `answer` (or throws it). */
export const readSelector = async (
  answer: Response | Error,
  query: UnknownQuery = SELECTOR_QUERY,
  signal?: AbortSignal,
) => {
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return {
    result: await readSelectorWith(fetcher, query, signal),
    fetcher,
  };
};

export const readSelectorWith = (
  fetcher: typeof fetch,
  query: UnknownQuery = SELECTOR_QUERY,
  signal?: AbortSignal,
) =>
  readCmsTaxonomySelector(
    query as unknown as Parameters<typeof readCmsTaxonomySelector>[0],
    fetcher,
    signal,
  );
