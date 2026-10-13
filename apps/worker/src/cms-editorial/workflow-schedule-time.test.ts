import { describe, expect, it } from 'vitest';

import {
  scheduleBody,
  scheduleResource,
} from './workflow-fixtures.test-support';
import {
  errorBody,
  postJson,
  workflowHarness,
  type WorkflowHarnessOptions,
} from './workflow-harness.test-support';

/*
 * BE03b E8 over the committed pinned snapshot (2026e), evaluated at the fixed
 * acceptance instant 2026-10-08T12:00:00Z. The Worker is authoritative: nothing
 * reaches the RPC, the accessibility gate or the quota's successor on a refusal.
 */

const path = '/api/v1/cms/publication-schedules';
/** The port answers the schedule the request asked for, as the database would. */
const echoSchedule = async ({ body }: { body: Record<string, unknown> }) => ({
  ok: true as const,
  value: {
    ...scheduleResource,
    action: body.action,
    localDateTime: body.localDateTime,
    timezone: body.timezone,
    resolvedUtc: body.resolvedUtc,
    tzdbVersion: body.tzdbVersion,
    disambiguation: body.disambiguation,
    audience: body.audience,
  },
});

const send = (
  patch: Record<string, unknown>,
  options?: WorkflowHarnessOptions,
) => {
  const harness = workflowHarness({
    port: { schedulePublication: echoSchedule as never },
    ...options,
  });
  return {
    harness,
    response: postJson(harness.app, path, { ...scheduleBody, ...patch }),
  };
};

const refusal = async (patch: Record<string, unknown>) => {
  const { harness, response } = send(patch);
  const published = await response;
  expect(harness.ports.schedulePublication).not.toHaveBeenCalled();
  expect(harness.qualityGate).not.toHaveBeenCalled();
  return { status: published.status, body: await errorBody(published) };
};

describe('accepted local times', () => {
  it.each([
    ['a unique time in an ordinary zone', {}],
    [
      'UTC',
      {
        localDateTime: '2026-12-01T09:00:00',
        timezone: 'UTC',
        resolvedUtc: '2026-12-01T09:00:00Z',
      },
    ],
    [
      'a three-segment zone',
      {
        localDateTime: '2026-12-01T09:00:00',
        timezone: 'America/Argentina/Buenos_Aires',
        resolvedUtc: '2026-12-01T12:00:00Z',
      },
    ],
    [
      'the earlier instant of a fold',
      {
        localDateTime: '2026-11-01T01:30:00',
        disambiguation: 'earlier',
        resolvedUtc: '2026-11-01T05:30:00Z',
      },
    ],
    [
      'the later instant of a fold',
      {
        localDateTime: '2026-11-01T01:30:00',
        disambiguation: 'later',
        resolvedUtc: '2026-11-01T06:30:00Z',
      },
    ],
  ])('accepts %s', async (_name, patch) => {
    const { harness, response } = send(patch);
    expect((await response).status).toBe(202);
    expect(harness.ports.schedulePublication).toHaveBeenCalledTimes(1);
    expect(harness.qualityGate).toHaveBeenCalledTimes(1);
  });
});

describe('E8 refusals, in order', () => {
  it('1: a zone outside the snapshot is unknown_timezone at /timezone', async () => {
    const { status, body } = await refusal({ timezone: 'Mars/Olympus_Mons' });
    expect(status).toBe(422);
    expect(body.details).toEqual({
      reasonCode: 'unknown_timezone',
      violations: [
        {
          path: '/timezone',
          code: 'unknown_timezone',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('2: another tzdb release is tzdb_version_mismatch with the pinned release', async () => {
    const { status, body } = await refusal({ tzdbVersion: '2025b' });
    expect(status).toBe(422);
    expect(body.details).toMatchObject({
      reasonCode: 'tzdb_version_mismatch',
      pinnedVersion: '2026e',
      violations: [{ path: '/tzdbVersion' }],
    });
  });

  it('4: a spring-forward gap names both shifted alternatives', async () => {
    const { status, body } = await refusal({
      localDateTime: '2027-03-14T02:30:00',
      resolvedUtc: '2027-03-14T07:30:00Z',
    });
    expect(status).toBe(422);
    expect(body.details).toEqual({
      reasonCode: 'nonexistent_local_time',
      alternatives: [
        {
          localDateTime: '2027-03-14T01:30:00',
          resolvedUtc: '2027-03-14T06:30:00Z',
        },
        {
          localDateTime: '2027-03-14T03:30:00',
          resolvedUtc: '2027-03-14T07:30:00Z',
        },
      ],
      violations: [
        {
          path: '/localDateTime',
          code: 'nonexistent_local_time',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('5: a unique time rejects any disambiguation', async () => {
    const { body } = await refusal({ disambiguation: 'later' });
    expect(body.details).toMatchObject({
      reasonCode: 'disambiguation_not_applicable',
      violations: [{ path: '/disambiguation' }],
    });
  });

  it('6: a fall-back fold without a choice names earlier then later', async () => {
    const { body } = await refusal({
      localDateTime: '2026-11-01T01:30:00',
      resolvedUtc: '2026-11-01T05:30:00Z',
    });
    expect(body.details).toEqual({
      reasonCode: 'ambiguous_local_time',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
      ],
      violations: [
        {
          path: '/disambiguation',
          code: 'ambiguous_local_time',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('7: a resolvedUtc that is not the selected instant carries the expected one', async () => {
    const { body } = await refusal({ resolvedUtc: '2026-11-01T13:30:00Z' });
    expect(body.details).toMatchObject({
      reasonCode: 'resolved_utc_mismatch',
      expectedUtc: '2026-11-01T14:30:00Z',
      violations: [{ path: '/resolvedUtc' }],
    });
  });

  it('8: an instant under 60 seconds or over 366 days away is out of horizon', async () => {
    const soon = await refusal({
      localDateTime: '2026-10-08T08:00:30',
      resolvedUtc: '2026-10-08T12:00:30Z',
    });
    expect(soon.body.details).toMatchObject({
      reasonCode: 'schedule_out_of_horizon',
      minUtc: '2026-10-08T12:01:00.000Z',
      maxUtc: '2027-10-09T12:00:00.000Z',
    });
    const far = await refusal({
      localDateTime: '2027-10-09T08:00:01',
      resolvedUtc: '2027-10-09T12:00:01Z',
    });
    expect(far.body.details).toMatchObject({
      reasonCode: 'schedule_out_of_horizon',
    });
  });

  it('accepts the exact horizon bounds', async () => {
    const lower = send({
      localDateTime: '2026-10-08T08:01:00',
      resolvedUtc: '2026-10-08T12:01:00Z',
    });
    expect((await lower.response).status).toBe(202);
    const upper = send({
      localDateTime: '2027-10-09T08:00:00',
      resolvedUtc: '2027-10-09T12:00:00Z',
    });
    expect((await upper.response).status).toBe(202);
  });

  it('orders the refusals: the zone before the release, the gap before the instant', async () => {
    const { body } = await refusal({
      timezone: 'Mars/Olympus_Mons',
      tzdbVersion: '2025b',
    });
    expect(body.details).toMatchObject({ reasonCode: 'unknown_timezone' });
  });
});

describe('integrity of the pinned snapshot', () => {
  it('answers every schedule command 503 when the snapshot failed its hash check', async () => {
    const { harness, response } = send({}, { timeAuthority: async () => null });
    const published = await response;
    expect(published.status).toBe(503);
    expect((await errorBody(published)).details).toEqual({
      dependencyClass: 'cms_editorial',
      retryable: true,
    });
    expect(harness.ports.schedulePublication).not.toHaveBeenCalled();
    expect(harness.qualityGate).not.toHaveBeenCalled();
  });
});
