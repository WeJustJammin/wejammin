import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  GRANT_ID,
  OTHER_SUBJECT_ID,
  SUBJECT_ID,
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import CmsCapabilityGrantConsole from './CmsCapabilityGrantConsole';
import type {
  CmsCapabilityGrantConsoleProps,
  CmsCapabilityGrantListState,
} from './cms-capability-grant-types';

export const LAPSED_ID = '8e5b04f7-2d91-7a6c-b3d8-1f70c4a95e26';
export const REVOKED_ID = '4b7d1c93-8e05-7a2f-9c46-d3e0f15a8b62';
export const REQUEST_ID = '6a3173d9-f113-4aa4-91c3-3fbc137ea258';

export const sampleItems = () => [
  grantResource(),
  grantResource({
    id: LAPSED_ID,
    state: 'lapsed',
    capability: 'cms.editor',
    subjectPersonId: OTHER_SUBJECT_ID,
    validFrom: '2026-08-01',
    validThrough: '2026-09-01',
    endsAt: '2026-09-02T00:00:00.000Z',
  }),
  grantResource({
    id: REVOKED_ID,
    state: 'revoked',
    capability: 'cms.reviewer.legal',
    lastAction: 'revoked',
    version: '5',
  }),
];

export const successList = (
  items = sampleItems(),
  nextCursor: string | null = null,
): CmsCapabilityGrantListState => ({
  status: 'success',
  data: grantListPage(items, nextCursor),
  version: '2',
  stale: false,
});

export const consoleProps = (
  overrides: Partial<CmsCapabilityGrantConsoleProps> = {},
): CmsCapabilityGrantConsoleProps => ({
  contractFields: { source: 'contracts', fields: {} },
  variant: 'ownerFull',
  access: 'full',
  initialList: successList(),
  contextEvidence: {
    actingContextLabel: 'Northwind Collective',
    stepUpState: 'verified',
    stepUpFreshUntil: '2026-10-02T12:05:00.000Z',
  },
  query: { limit: 25, sort: 'updatedAt', direction: 'desc' },
  termWindow: { minDate: '2026-10-02', maxDate: '2026-12-30' },
  cursor: null,
  requestId: REQUEST_ID,
  canonicalUrl: '/app/cms-content-modeling/capability-grants',
  retryUrl: '/app/cms-content-modeling/capability-grants',
  csrfToken: 'csrf-token',
  ...overrides,
});

export const ConsoleUnderTest = CmsCapabilityGrantConsole;

/** Server-render the console to a parsed document (jsdom environment required). */
export const renderConsoleDocument = (
  props: CmsCapabilityGrantConsoleProps,
): Document =>
  new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(React.createElement(ConsoleUnderTest, props))}</body>`,
    'text/html',
  );

export const rowFor = (doc: Document, grantId: string): HTMLElement | null =>
  doc.querySelector<HTMLElement>(`[data-grant-id="${grantId}"]`);

export const names = { GRANT_ID, SUBJECT_ID, OTHER_SUBJECT_ID };

export const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const apiError = (code: string, details: unknown = {}) => ({
  code,
  details,
  message: 'Refused.',
  requestId: REQUEST_ID,
});
