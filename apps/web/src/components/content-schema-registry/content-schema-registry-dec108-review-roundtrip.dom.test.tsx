// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  assignmentResource,
  callFacade,
  decisionResource,
  reviewResource,
  reviewTarget,
} from './content-schema-review-dec108.test-support';
import {
  fieldRecord,
  renderDocument,
  requireForm,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 form-to-header contract for the review-scoped commands (CMS-03A-12 and
 * CMS-03A-14): the rendered native form, submitted as a browser would, reaches
 * the private upstream with the generated request body and the transport
 * fields moved to Idempotency-Key and If-Match headers.
 */

const submit = async (
  doc: Document,
  operationId: 'CMS-03A-12' | 'CMS-03A-14',
  edit: Readonly<Record<string, string>>,
  upstream: { status: number; body: unknown },
) => {
  const form = requireForm(doc, operationId);
  const fields = { ...fieldRecord(form), ...edit };
  const result = await callFacade({
    target: reviewTarget(operationId),
    form: fields,
    headers: {
      cookie: 'wj_access=session; wj_csrf=csrf-token',
      'x-csrf-token': null,
      'idempotency-key': null,
      'if-match': null,
    },
    upstream,
  });
  return { ...result, fields };
};

describe('[DEC-108] CMS-03A-12 decision form -> facade -> upstream', () => {
  const reviewer = () =>
    renderDocument(
      reviewPageProps(reviewResource(), {
        variant: 'schemaReviewAssigned',
        access: 'read-only',
      }),
    );

  it.each(['approve', 'reject'] as const)(
    '[P2-S09-AC-982] selecting %s sends { expectedVersion, decision } to the review decisions path',
    async (decision) => {
      const doc = reviewer();
      const radio = requireForm(
        doc,
        'CMS-03A-12',
      ).querySelector<HTMLInputElement>(
        `input[type="radio"][value="${decision}"]`,
      );
      if (radio === null) throw new Error('RED: expected a decision radio');
      radio.checked = true;
      const { response, forwarded, forwardedBody, fields } = await submit(
        doc,
        'CMS-03A-12',
        {},
        { status: 201, body: decisionResource(decision) },
      );
      expect(response.status).toBe(201);
      expect(forwardedBody).toStrictEqual({ expectedVersion: '3', decision });
      expect(new URL(forwarded?.url ?? '').pathname).toBe(
        `/api/v1/cms/schema-reviews/${REVIEW_ID}/decisions`,
      );
      expect(forwarded?.headers.get('if-match')).toBe('"3"');
      expect(forwarded?.headers.get('idempotency-key')).toBe(
        fields['idempotency-key'],
      );
    },
  );

  it('submitting with no decision selected is refused locally and never forwarded', async () => {
    const { response, fetch } = await submit(
      reviewer(),
      'CMS-03A-12',
      {},
      { status: 201, body: decisionResource() },
    );
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('[DEC-108] CMS-03A-14 assignment form -> facade -> upstream', () => {
  const owner = () =>
    renderDocument(
      reviewPageProps(
        reviewResource({ permittedNextActions: ['assign_reviewer'] }),
        { variant: 'ownerFull', access: 'full' },
      ),
    );
  const expiresAt = '2026-10-05T12:00:00.000Z';

  it('[P2-S09-AC-983] sends the create variant with the reviewer reference and omits a blank reason', async () => {
    const { response, forwardedBody, forwarded } = await submit(
      owner(),
      'CMS-03A-14',
      { reviewerPersonId: REVIEWER_PERSON_ID, expiresAt, reason: '' },
      { status: 201, body: assignmentResource() },
    );
    expect(response.status).toBe(201);
    expect(forwardedBody).toStrictEqual({
      action: 'create',
      expectedVersion: '3',
      reviewerPersonId: REVIEWER_PERSON_ID,
      expiresAt,
    });
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `/api/v1/cms/schema-reviews/${REVIEW_ID}/assignments`,
    );
    expect(forwarded?.headers.get('if-match')).toBe('"3"');
  });

  it('forwards a supplied reason and refuses a non-UUID reviewer locally', async () => {
    const accepted = await submit(
      owner(),
      'CMS-03A-14',
      {
        reviewerPersonId: REVIEWER_PERSON_ID,
        expiresAt,
        reason: 'Second reviewer for a protected schema',
      },
      { status: 201, body: assignmentResource() },
    );
    expect(accepted.forwardedBody).toMatchObject({
      reason: 'Second reviewer for a protected schema',
    });
    const refused = await submit(
      owner(),
      'CMS-03A-14',
      { reviewerPersonId: 'not-a-uuid', expiresAt },
      { status: 201, body: assignmentResource() },
    );
    expect(refused.response.status).toBe(422);
    expect(refused.fetch).not.toHaveBeenCalled();
  });
});
