import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi, expect } from 'vitest';

import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  REVIEW_PATH,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/** Shared review-route fixtures and the decision-form driver for the IA edge tests. */

export const protectedOpen = (overrides: Record<string, unknown> = {}) =>
  reviewResource({
    riskClass: 'protected',
    requiredDecisionCount: 2,
    requiredCapabilities: ['cms.schema_review', 'cms.reviewer.legal'],
    permittedNextActions: ['record_decision'],
    ...overrides,
  });

export const reviewerMarkup = (review = protectedOpen()): string =>
  renderToStaticMarkup(
    React.createElement(
      WorkbenchUnderTest,
      reviewPageProps(review, {
        variant: 'schemaReviewAssigned',
        access: 'read-only',
      }),
    ),
  );

export const mountReviewer = (review = protectedOpen()): HTMLFormElement => {
  window.history.replaceState({}, '', REVIEW_PATH);
  document.body.innerHTML = reviewerMarkup(review);
  const form = document.querySelector<HTMLFormElement>(
    'form[data-operation-id="CMS-03A-12"]',
  );
  if (form === null) throw new Error('decision form not rendered');
  return form;
};

export const decide = async (
  decision: 'approve' | 'reject',
  answer: Response,
  review = protectedOpen(),
) => {
  const form = mountReviewer(review);
  for (const radio of form.querySelectorAll<HTMLInputElement>(
    'input[name="decision"]',
  ))
    radio.checked = radio.value === decision;
  const calls: FormData[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init?.body as FormData);
      return answer;
    }),
  );
  const navigate = vi.fn();
  const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(form.getAttribute('aria-busy')).toBe('false'));
  cleanup();
  return { form, navigate, calls };
};

export const apiError = (
  code: string,
  status: number,
  details = {},
): Response =>
  new Response(
    JSON.stringify({
      code,
      message: 'refused',
      details,
      requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
