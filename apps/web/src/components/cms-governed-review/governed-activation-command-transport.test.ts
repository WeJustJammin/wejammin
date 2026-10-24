import { describe, expect, it } from 'vitest';

import {
  REVIEW_ID,
  SUBJECT_ID,
  governedActivationFixture,
  governedRetiredFixture,
  governedScheduledFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import { governedCommandPath } from './governed-review-command-specs';
import { ok, send } from './governed-activation-transport.test-support';
import {
  REVIEW_LOCATION,
  activateInput,
  catalogError,
  retireInput,
  scheduleInput,
} from './governed-review-transport.test-support';

/*
 * CMS-03C-09 in the browser: the strict three-action body, the version each
 * action must be answered at (an activation and a retirement advance the review
 * by one, a scheduled acceptance leaves it) and the Location of the review.
 */
describe('CMS-03C-09 path and request', () => {
  it('addresses the activation route of the review', () => {
    expect(governedCommandPath('CMS-03C-09', { reviewId: REVIEW_ID })).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/activation`,
    );
  });

  it('sends the strict body, the key and the strong If-Match of the review version', async () => {
    const { fetcher, result } = send(
      scheduleInput,
      ok(202, governedScheduledFixture(), '"2"'),
    );
    await result;
    const [path, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe(`/api/v1/cms/governed-reviews/${REVIEW_ID}/activation`);
    expect(new Headers(init.headers).get('if-match')).toBe('"2"');
    expect(JSON.parse(init.body as string)).toEqual(scheduleInput.body);
  });

  it.each([
    ['an activation with a reason', { ...activateInput.body, reason: 'No.' }],
    [
      'an activation with activateAt',
      { ...activateInput.body, activateAt: scheduleInput.body.activateAt },
    ],
    [
      'a schedule without activateAt',
      { action: 'schedule', expectedVersion: '2' },
    ],
    [
      'a schedule with a missing instant member',
      {
        ...scheduleInput.body,
        activateAt: { ...scheduleInput.body.activateAt, timezone: undefined },
      },
    ],
    [
      'a schedule with an unknown disambiguation',
      {
        ...scheduleInput.body,
        activateAt: { ...scheduleInput.body.activateAt, disambiguation: 'x' },
      },
    ],
    [
      'a schedule with an extra instant member',
      {
        ...scheduleInput.body,
        activateAt: { ...scheduleInput.body.activateAt, audience: 'web' },
      },
    ],
    [
      'a retirement with activateAt',
      { ...retireInput.body, activateAt: scheduleInput.body.activateAt },
    ],
    ['a retirement with an empty reason', { ...retireInput.body, reason: '' }],
    ['an unknown action', { action: 'delete', expectedVersion: '2' }],
    [
      'a non-numeric expectedVersion',
      { action: 'activate', expectedVersion: 'x' },
    ],
  ])('sends nothing for %s', async (_name, body) => {
    const { fetcher, result } = send({ ...activateInput, body });
    expect(await result).toEqual({ kind: 'local', reason: 'request_invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts a retirement without a reason', async () => {
    const { result } = send(
      { ...retireInput, body: { action: 'retire', expectedVersion: '2' } },
      ok(200, governedRetiredFixture(), '"3"'),
    );
    expect((await result).kind).toBe('committed');
  });

  it('sends nothing when the If-Match is not the expectedVersion', async () => {
    const { fetcher, result } = send({ ...activateInput, ifMatch: '"3"' });
    expect(await result).toEqual({ kind: 'local', reason: 'request_invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('CMS-03C-09 commit verification', () => {
  it('commits an activation at the next review version and exposes that version as the new validator', async () => {
    const { result } = send(
      activateInput,
      ok(200, governedActivationFixture(), '"3"'),
    );
    const committed = await result;
    expect(committed).toMatchObject({
      kind: 'committed',
      status: 200,
      resource: {
        version: '3',
        action: 'activate',
        subjectState: 'active',
        subjectVersion: 2,
        supersededVersion: 1,
        reviewId: REVIEW_ID,
      },
    });
  });

  it('commits a scheduled acceptance as 202 at the unchanged review version', async () => {
    const { result } = send(
      scheduleInput,
      ok(202, governedScheduledFixture(), '"2"'),
    );
    expect(await result).toMatchObject({
      kind: 'committed',
      status: 202,
      resource: {
        version: '2',
        subjectState: 'scheduled',
        scheduledForUtc: '2026-12-01T14:00:00Z',
        activatedAt: null,
      },
    });
  });

  it('commits a retirement at the next review version', async () => {
    const { result } = send(
      retireInput,
      ok(200, governedRetiredFixture(), '"3"'),
    );
    expect(await result).toMatchObject({
      kind: 'committed',
      resource: { version: '3', subjectState: 'retired' },
    });
  });

  it('tolerates a millisecond between the requested and the stored instant', async () => {
    const { result } = send(
      scheduleInput,
      ok(
        202,
        governedScheduledFixture({
          scheduledForUtc: '2026-12-01T14:00:00.001Z',
        }),
        '"2"',
      ),
    );
    expect((await result).kind).toBe('committed');
  });

  it.each([
    [
      'an activation that did not advance the review',
      activateInput,
      ok(200, governedActivationFixture({ reviewVersion: '2' }), '"2"'),
    ],
    [
      'an activation that jumped the review',
      activateInput,
      ok(200, governedActivationFixture({ reviewVersion: '5' }), '"5"'),
    ],
    [
      'a retirement that did not advance the review',
      retireInput,
      ok(200, governedRetiredFixture({ reviewVersion: '2' }), '"2"'),
    ],
    [
      'a schedule that advanced the review',
      scheduleInput,
      ok(202, governedScheduledFixture({ reviewVersion: '3' }), '"3"'),
    ],
    [
      'a schedule for another instant',
      scheduleInput,
      ok(
        202,
        governedScheduledFixture({ scheduledForUtc: '2026-12-01T15:00:00Z' }),
        '"2"',
      ),
    ],
    [
      'an answer for another review',
      activateInput,
      ok(200, governedActivationFixture({ reviewId: SUBJECT_ID }), '"3"'),
    ],
    [
      'an activation answered as a retirement',
      activateInput,
      ok(200, governedRetiredFixture(), '"3"'),
    ],
    [
      'a retirement answered as an activation',
      retireInput,
      ok(200, governedActivationFixture(), '"3"'),
    ],
    [
      'a validator that is not the review version',
      activateInput,
      ok(200, governedActivationFixture(), '"9"'),
    ],
    [
      'a missing validator',
      activateInput,
      jsonResponse(200, governedActivationFixture(), {
        location: REVIEW_LOCATION,
      }),
    ],
    [
      'a missing Location',
      activateInput,
      jsonResponse(200, governedActivationFixture(), { etag: '"3"' }),
    ],
    [
      'a Location of another review',
      activateInput,
      jsonResponse(200, governedActivationFixture(), {
        etag: '"3"',
        location: `/api/v1/cms/governed-reviews/${SUBJECT_ID}`,
      }),
    ],
    [
      'an activation answered 202',
      activateInput,
      ok(202, governedActivationFixture(), '"3"'),
    ],
    [
      'a schedule answered 200',
      scheduleInput,
      ok(200, governedScheduledFixture(), '"2"'),
    ],
    [
      'a body that is not a resource',
      activateInput,
      ok(200, { ok: true }, '"3"'),
    ],
    [
      'a state that does not follow the action',
      activateInput,
      ok(
        200,
        { ...governedActivationFixture(), subjectState: 'retired' },
        '"3"',
      ),
    ],
  ])('treats %s as an unknown outcome', async (_name, input, response) => {
    const { result } = send(input, response);
    expect(await result).toEqual({ kind: 'unknown', requestId: null });
  });

  it('treats a lost connection and a 5xx as unknown', async () => {
    expect((await send(activateInput, new Error('offline')).result).kind).toBe(
      'unknown',
    );
    expect(
      (
        await send(
          activateInput,
          catalogError(503, 'DEPENDENCY_UNAVAILABLE', { retryable: true }),
        ).result
      ).kind,
    ).toBe('unknown');
  });
});

describe('CMS-03C-09 refusals', () => {
  const refused = async (response: Response) => {
    const result = await send(activateInput, response).result;
    if (result.kind !== 'refused') throw new Error(`got ${result.kind}`);
    return result.refusal;
  };

  it.each([
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'subject_not_activatable'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'subject_not_retirable'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'activation_conflict'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'schedule_exists'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'dependency_changed'],
    [403, 'GOVERNED_REVIEW_FORBIDDEN', 'capability_missing'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'unknown_timezone'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'tzdb_version_mismatch'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'nonexistent_local_time'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'ambiguous_local_time'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'disambiguation_not_applicable'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'resolved_utc_mismatch'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED', 'schedule_out_of_horizon'],
    [
      422,
      'GOVERNED_REVIEW_VALIDATION_FAILED',
      'authority_ends_before_schedule',
    ],
  ])('registers %i %s token %s', async (status, code, reasonCode) => {
    const refusal = await refused(catalogError(status, code, { reasonCode }));
    expect(refusal.governed.reason).toBe(reasonCode);
    expect(refusal.status).toBe(status);
  });

  it('rejects a token at the wrong status or outside the operation', async () => {
    expect(
      (
        await refused(
          catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
            reasonCode: 'subject_not_activatable',
          }),
        )
      ).governed.reason,
    ).toBeNull();
    expect(
      (
        await refused(
          catalogError(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
            reasonCode: 'review_not_open',
          }),
        )
      ).governed.reason,
    ).toBeNull();
  });

  it('keeps the closed canonical domain of an unavailable provider', async () => {
    const refusal = await refused(
      catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'canonical_source_unavailable',
        domain: 'rights',
      }),
    );
    expect(refusal.governed).toEqual({
      reason: 'canonical_source_unavailable',
      domain: 'rights',
    });
  });

  it('routes the unconditional step-up shortfall to its recovery', async () => {
    const result = await send(
      activateInput,
      catalogError(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    ).result;
    expect(result.kind).toBe('step-up');
  });
});
