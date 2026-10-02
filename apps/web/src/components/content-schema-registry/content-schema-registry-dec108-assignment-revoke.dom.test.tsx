// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  assignmentResource,
  callFacade,
  reviewResource,
  reviewTarget,
} from './content-schema-review-dec108.test-support';
import {
  fieldRecord,
  renderDocument,
  reviewPageProps,
  type Dec108WorkbenchProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 / WP2c follow-up: the owner-only `assignments[]` safe summary lets the
 * owner revoke a reviewer assignment (CMS-03A-14 `revoke`). The summary carries
 * a display label, never a person identifier.
 */

const OTHER_ASSIGNMENT_ID = '4b7d1c93-8e05-7a2f-9c46-d3e0f15a8b62';
const REVOKED_ASSIGNMENT_ID = 'c20f6a58-3d91-7e47-b8a5-0f9d2e6c1b73';

const summary = (
  assignmentId: string,
  state: 'active' | 'revoked',
  label: string,
) => ({
  assignmentId,
  version: '2',
  state,
  startsAt: '2026-10-02T12:00:00.000Z',
  endsAt: '2026-10-05T12:00:00.000Z',
  reviewerLabel: label,
});

const reviewWith = (overrides: Record<string, unknown> = {}) =>
  reviewResource({
    permittedNextActions: ['assign_reviewer'],
    assignments: [
      summary(ASSIGNMENT_ID, 'active', 'Reviewer A'),
      summary(OTHER_ASSIGNMENT_ID, 'active', 'Reviewer B'),
      summary(REVOKED_ASSIGNMENT_ID, 'revoked', 'Reviewer C'),
    ],
    ...overrides,
  });

const page = (
  review = reviewWith(),
  overrides: Partial<Dec108WorkbenchProps> = {},
) =>
  reviewPageProps(review, {
    variant: 'ownerFull',
    access: 'full',
    ...overrides,
  });

const revokeForms = (doc: Document): HTMLFormElement[] =>
  [
    ...doc.querySelectorAll<HTMLFormElement>(
      'form[data-operation-id="CMS-03A-14"]',
    ),
  ].filter(
    (form) =>
      form.querySelector('input[name="action"]')?.getAttribute('value') ===
      'revoke',
  );

describe('[WP2c] reviewer assignment revoke (owner)', () => {
  it('lists every assignment with its display label and window', () => {
    const doc = renderDocument(page());
    const region = doc.querySelector('[aria-label="Reviewer assignments"]');
    if (region === null)
      throw new Error('RED: expected a "Reviewer assignments" region');
    expect(region.textContent).toContain('Reviewer A');
    expect(region.textContent).toContain('Reviewer B');
    expect(region.textContent).toContain('Reviewer C');
    expect(region.textContent).toMatch(/Revoked/u);
    expect(region.textContent).toContain('2026-10-05T12:00:00.000Z');
  });

  it('renders one revoke form per active assignment and none for revoked ones', () => {
    const forms = revokeForms(renderDocument(page()));
    expect(forms).toHaveLength(2);
    expect(forms.map((form) => fieldRecord(form).assignmentId).sort()).toEqual(
      [ASSIGNMENT_ID, OTHER_ASSIGNMENT_ID].sort(),
    );
  });

  it('gives every revoke form its own printable idempotency key', () => {
    const doc = renderDocument(page());
    const keys = [...revokeForms(doc)].map(
      (form) => fieldRecord(form)['idempotency-key'] ?? '',
    );
    const createKey = fieldRecord(
      [...doc.querySelectorAll<HTMLFormElement>('form')].find(
        (form) => fieldRecord(form).action === 'create',
      ) ?? doc.createElement('form'),
    )['idempotency-key'];
    expect(new Set([...keys, createKey]).size).toBe(3);
    for (const key of keys) {
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key.length).toBeLessThanOrEqual(128);
      expect(key).toMatch(/^[\x20-\x7e]+$/u);
    }
  });

  it('carries the review version as expectedVersion and strong If-Match', () => {
    const [form] = revokeForms(renderDocument(page()));
    if (form === undefined) throw new Error('RED: expected a revoke form');
    const fields = fieldRecord(form);
    expect(fields.action).toBe('revoke');
    expect(fields.reviewId).toBe(REVIEW_ID);
    expect(fields.expectedVersion).toBe('3');
    expect(fields['if-match']).toBe('"3"');
    expect(fields.operationId).toBe('CMS-03A-14');
  });

  it('names each revoke button for its reviewer and offers an optional reason', () => {
    const [form] = revokeForms(renderDocument(page()));
    if (form === undefined) throw new Error('RED: expected a revoke form');
    expect(form.textContent).toMatch(
      /Revoke .*Reviewer A|Revoke .*Reviewer B/u,
    );
    const reason = form.querySelector<HTMLInputElement>('input[name="reason"]');
    expect(reason?.getAttribute('maxlength')).toBe('256');
    expect(reason?.required).toBe(false);
  });

  it.each([
    [
      'the review-only variant',
      { variant: 'schemaReviewAssigned', access: 'read-only' },
    ],
    [
      'an entitled read variant',
      { variant: 'entitledRead', access: 'read-only' },
    ],
  ] as const)('renders no revoke form for %s', (_label, overrides) => {
    expect(
      revokeForms(renderDocument(page(reviewWith(), overrides))),
    ).toHaveLength(0);
  });

  it('renders no revoke form when the server does not permit assign_reviewer', () => {
    expect(
      revokeForms(
        renderDocument(
          page(reviewWith({ permittedNextActions: ['record_decision'] })),
        ),
      ),
    ).toHaveLength(0);
  });

  it('never prints a person identifier or the private reviewer reference', () => {
    const html = renderDocument(page()).body.innerHTML;
    expect(html).not.toContain(REVIEWER_PERSON_ID);
  });

  it('round trips the revoke form through the facade as the revoke variant', async () => {
    const [form] = revokeForms(renderDocument(page()));
    if (form === undefined) throw new Error('RED: expected a revoke form');
    const base = fieldRecord(form);
    const fields = { ...base, reason: '' };
    const { response, forwardedBody, forwarded } = await callFacade({
      target: reviewTarget('CMS-03A-14'),
      form: fields,
      headers: {
        cookie: 'wj_access=session; wj_csrf=csrf-token',
        'x-csrf-token': null,
        'idempotency-key': null,
        'if-match': null,
      },
      upstream: { status: 200, body: assignmentResource() },
    });
    expect(response.status).toBe(200);
    expect(forwardedBody).toStrictEqual({
      action: 'revoke',
      expectedVersion: '3',
      assignmentId: base.assignmentId,
    });
    expect(forwarded?.headers.get('if-match')).toBe('"3"');
  });
});
