// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  APPROVE_A_ID,
  APPROVE_B_ID,
  DRY_RUN_ID,
  approvedProtectedReview,
  callFacade,
  draftDetail,
  dryRunResource,
  reviewResource,
  versionTarget,
} from './content-schema-review-dec108.test-support';
import {
  fieldRecord,
  renderDocument,
  requireForm,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 form-to-header contract (CMS-03A-09, -10, -11 and -04): the rendered
 * native form, submitted exactly as a browser would, reaches the private
 * upstream with the generated request body and the transport fields moved to
 * the Idempotency-Key and If-Match headers. The browser supplies no header of
 * its own: everything comes from the form's hidden fields and the CSRF cookie.
 */

const render = (
  preparation: Parameters<typeof draftDetail>[0],
  extra: Parameters<typeof versionPageProps>[0] = {},
) =>
  renderDocument(
    versionPageProps({
      initialDetail: successDetail(draftDetail(preparation)),
      ...extra,
    }),
  );

const submitForm = async (
  doc: Document,
  operationId: 'CMS-03A-04' | 'CMS-03A-09' | 'CMS-03A-10' | 'CMS-03A-11',
  edit: Readonly<Record<string, string>>,
  upstream: { status: number; body: unknown },
) => {
  const fields = { ...fieldRecord(requireForm(doc, operationId)), ...edit };
  const result = await callFacade({
    target: versionTarget(operationId),
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

describe('[DEC-108] rendered form -> facade -> upstream', () => {
  it('[P2-S09-AC-979] CMS-03A-09: successor keeps the locale configuration (both null) with the form idempotency key and ETag', async () => {
    const doc = render(
      activationPreparation({ permittedNextActions: ['create_successor'] }),
    );
    const { response, forwarded, forwardedBody, fields } = await submitForm(
      doc,
      'CMS-03A-09',
      {},
      { status: 201, body: draftDetail().resource },
    );
    expect(response.status).toBe(201);
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      supportedLocales: null,
      fallbackChains: null,
    });
    expect(forwarded?.headers.get('idempotency-key')).toBe(
      fields['idempotency-key'],
    );
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
    expect(new URL(forwarded?.url ?? '').pathname).toMatch(/\/successors$/u);
  });

  it('[P2-S09-AC-980] CMS-03A-10: blank transform fields serialize as an explicit null pair', async () => {
    const { response, forwardedBody } = await submitForm(
      render(startDryRunPreparation),
      'CMS-03A-10',
      {},
      { status: 202, body: dryRunResource() },
    );
    expect(response.status).toBe(202);
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      transformKey: null,
      transformVersion: null,
    });
  });

  it('[P2-S09-AC-980] CMS-03A-10: a filled transform pair is forwarded verbatim', async () => {
    const { forwardedBody } = await submitForm(
      render(startDryRunPreparation),
      'CMS-03A-10',
      { transformKey: 'article.title_to_headline', transformVersion: '1' },
      {
        status: 202,
        body: dryRunResource({
          transformKey: 'article.title_to_headline',
          transformVersion: '1',
        }),
      },
    );
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      transformKey: 'article.title_to_headline',
      transformVersion: '1',
    });
  });

  it('[P2-S09-AC-980] CMS-03A-10: a half-filled pair is refused locally with 422 and never forwarded', async () => {
    const { response, fetch } = await submitForm(
      render(startDryRunPreparation),
      'CMS-03A-10',
      { transformKey: 'article.title_to_headline', transformVersion: '' },
      { status: 202, body: dryRunResource() },
    );
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-968] CMS-03A-11: submit-review sends the prefilled sealed dry-run id', async () => {
    const { response, forwardedBody, forwarded } = await submitForm(
      render(passedDryRunPreparation),
      'CMS-03A-11',
      {},
      { status: 201, body: reviewResource() },
    );
    expect(response.status).toBe(201);
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      dryRunId: DRY_RUN_ID,
    });
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
  });

  it('[P2-S09-AC-968] [P2-S09-AC-973] CMS-03A-04: activation sends the approve-decision ids prefilled from the approved review', async () => {
    // G8: approvalIds are the approve-decision ids of exactly one approved review.
    const doc = render(approvedReviewPreparation, {
      initialReview: reviewSuccess(approvedProtectedReview()),
    });
    const { forwardedBody, forwarded } = await submitForm(
      doc,
      'CMS-03A-04',
      { stepUpToken: 'token-123', confirmed: 'true' },
      {
        status: 202,
        body: {
          resourceKind: 'schema_activation',
        },
      },
    );
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      dryRunId: DRY_RUN_ID,
      approvalIds: [APPROVE_A_ID, APPROVE_B_ID],
      migrationPlanId: null,
    });
    expect(forwarded?.headers.get('x-step-up-token')).toBe('token-123');
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
  });

  it('CMS-03A-04: a confirmed activation form with no browser token is forwarded (recency is the session, not a form field)', async () => {
    // The activation form renders no token field (see commands.test); the
    // Worker derives recent MFA from the session, so the facade must not demand
    // an `x-step-up-token` the browser can never supply.
    const doc = render(approvedReviewPreparation, {
      initialReview: reviewSuccess(approvedProtectedReview()),
    });
    const { response, forwardedBody, forwarded } = await submitForm(
      doc,
      'CMS-03A-04',
      { confirmed: 'true' },
      {
        status: 202,
        body: {
          resourceKind: 'schema_activation',
        },
      },
    );
    // The stand-in upstream body is not a full activation resource, so the
    // facade's own 502 is acceptable here; what matters is that it forwarded.
    expect(response.status).not.toBe(403);
    expect(forwardedBody).toMatchObject({ dryRunId: DRY_RUN_ID });
    expect(forwarded?.headers.get('x-step-up-token')).toBeNull();
  });

  it('CMS-03A-04: an unconfirmed activation form is still refused locally and never forwarded', async () => {
    const doc = render(approvedReviewPreparation, {
      initialReview: reviewSuccess(approvedProtectedReview()),
    });
    const { response, fetch } = await submitForm(
      doc,
      'CMS-03A-04',
      {},
      { status: 202, body: { resourceKind: 'schema_activation' } },
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
