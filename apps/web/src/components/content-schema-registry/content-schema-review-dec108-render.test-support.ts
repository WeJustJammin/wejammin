import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SchemaReviewResource } from '@wejammin/contracts';

import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import type { ContentSchemaRegistryDetail } from '../../server/content-schema-registry-contracts';
import {
  REVIEW_ID,
  REVIEW_PATH,
  TYPE_ID,
  VERSION_ID,
  VERSION_PATH,
  draftDetail,
} from './content-schema-review-dec108.test-support';

// ---------------------------------------------------------------------------
// Workbench rendering helpers (FE03 ContentSchemaRegistryWorkbench review mode)
// ---------------------------------------------------------------------------

/** AsyncState<SchemaReviewResource> for the CMS-03A-13 read (FE03 reviewState). */
/** The island's non-correlatable support reference; never a request id. */
export const SUPPORT_REFERENCE = 'SR-0A1B-2C3D-4E5F-6A7B';

export type Dec108ReviewState =
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
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly requestId?: string;
      };
      readonly retryable: boolean;
      readonly httpStatus?: number;
    }
  | {
      readonly status: 'degraded';
      readonly data: SchemaReviewResource | null;
      readonly code?: string;
      readonly requestId?: string;
      readonly lastVerifiedAt: string | null;
      readonly retryable?: boolean;
      readonly httpStatus?: number;
    }
  | { readonly status: 'disabled'; readonly reason: string };

/**
 * Workbench props after DEC-108: the island carries no actor, person, party or
 * binding identifier (FE03 island invariant), and review mode adds the
 * `initialReview` state plus the exact `reviewId`.
 */
export interface Dec108WorkbenchProps {
  readonly variant: string;
  readonly access: 'full' | 'read-only' | 'disabled' | 'not-rendered';
  readonly actingContextLabel?: string;
  readonly stepUpState?: 'required' | 'pending' | 'verified';
  readonly stepUpFreshUntil?: string;
  readonly query: { limit: number; sort: string; direction: string };
  readonly contentTypeId: string | null;
  readonly versionId: string | null;
  readonly reviewId?: string | null;
  readonly cursor: string | null;
  readonly expectedVersion: string | null;
  readonly supportReference: string;
  readonly canonicalUrl: string;
  readonly listUrl: string;
  readonly retryUrl: string;
  readonly csrfToken: string;
  readonly contractFields: { source: string; fields: Record<string, string> };
  readonly initialList: unknown;
  readonly initialDetail: unknown;
  readonly initialReview?: Dec108ReviewState | null;
  readonly onCanonicalRefetch: () => Promise<void>;
}

export const successDetail = (
  detail: ContentSchemaRegistryDetail,
): {
  status: 'success';
  data: ContentSchemaRegistryDetail;
  version: string;
  stale: boolean;
} => ({
  status: 'success',
  data: detail,
  version: detail.resource.version,
  stale: false,
});

export const reviewSuccess = (
  data: SchemaReviewResource,
): Extract<Dec108ReviewState, { status: 'success' }> => ({
  status: 'success',
  data,
  version: data.version,
  stale: false,
});

/** Version-page props for a schema designer looking at a draft candidate. */
export const versionPageProps = (
  overrides: Partial<Dec108WorkbenchProps> = {},
): Dec108WorkbenchProps => ({
  variant: 'ownerFull',
  access: 'full',
  query: { limit: 25, sort: 'key', direction: 'asc' },
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
  reviewId: null,
  cursor: null,
  expectedVersion: '4',
  supportReference: SUPPORT_REFERENCE,
  canonicalUrl: '/app/cms-content-modeling',
  listUrl: '/app/cms-content-modeling?limit=25&sort=key&direction=asc',
  retryUrl: VERSION_PATH,
  csrfToken: 'csrf-token',
  contractFields: { source: 'contracts', fields: {} },
  initialList: { status: 'empty', reason: 'no-records' },
  initialDetail: successDetail(draftDetail()),
  initialReview: null,
  onCanonicalRefetch: async () => undefined,
  ...overrides,
});

/** Review-page props (CMS-03A-13 route) for an owner or an assigned reviewer. */
export const reviewPageProps = (
  review: SchemaReviewResource,
  overrides: Partial<Dec108WorkbenchProps> = {},
): Dec108WorkbenchProps =>
  versionPageProps({
    contentTypeId: null,
    versionId: null,
    reviewId: REVIEW_ID,
    expectedVersion: review.version,
    canonicalUrl: REVIEW_PATH,
    retryUrl: REVIEW_PATH,
    initialDetail: null,
    initialReview: reviewSuccess(review),
    ...overrides,
  });

export const WorkbenchUnderTest =
  ContentSchemaRegistryWorkbench as unknown as React.ComponentType<Dec108WorkbenchProps>;

/** Render the workbench to a parsed document (jsdom environment required). */
export const renderDocument = (props: Dec108WorkbenchProps): Document =>
  new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(React.createElement(WorkbenchUnderTest, props))}</body>`,
    'text/html',
  );

export const commandForm = (
  document: Document,
  operationId: string,
): HTMLFormElement | null =>
  document.querySelector<HTMLFormElement>(
    `form[data-operation-id="${operationId}"]`,
  );

/** The rendered form, or a descriptive RED failure when it is not rendered. */
export const requireForm = (
  document: Document,
  operationId: string,
): HTMLFormElement => {
  const form = commandForm(document, operationId);
  if (form === null)
    throw new Error(
      `RED: expected a rendered command form for ${operationId} (FE03 DEC-108)`,
    );
  return form;
};

/** The submitted FormData of a rendered native form (hidden + visible fields). */
export const submittedFields = (form: HTMLFormElement): FormData =>
  new FormData(form);

/** Fields of a rendered form by name, as a plain record of first values. */
export const fieldRecord = (form: HTMLFormElement): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const [name, value] of submittedFields(form).entries())
    if (typeof value === 'string' && !(name in record)) record[name] = value;
  return record;
};

/** Accessible name of a region from aria-label or its aria-labelledby heading. */
export const regionNamed = (
  document: Document,
  name: RegExp,
): HTMLElement | null =>
  [
    ...document.querySelectorAll<HTMLElement>(
      'section, [role="region"], aside, article',
    ),
  ].find((element) => {
    const label = element.getAttribute('aria-label');
    const labelledBy = element.getAttribute('aria-labelledby');
    const text =
      label ??
      (labelledBy === null
        ? null
        : (document.getElementById(labelledBy)?.textContent ?? null));
    return text !== null && name.test(text);
  }) ?? null;

/** Text of the `<dd>` that follows the `<dt>` whose text matches the label. */
export const definitionValue = (
  scope: HTMLElement,
  label: RegExp,
): string | null => {
  const term = [...scope.querySelectorAll('dt')].find((element) =>
    label.test(element.textContent ?? ''),
  );
  return term?.nextElementSibling?.textContent?.trim() ?? null;
};

/** Region by accessible name, or a descriptive RED failure when it is absent. */
export const requireRegion = (
  document: Document,
  name: RegExp,
): HTMLElement => {
  const region = regionNamed(document, name);
  if (region === null)
    throw new Error(
      `RED: expected a region named ${String(name)} (FE03 DEC-108)`,
    );
  return region;
};
