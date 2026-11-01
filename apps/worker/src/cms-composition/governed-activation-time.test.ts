import {
  CMS_TZDB_VERSION,
  CmsGovernedTimeRefusalDetailsSchema,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  activateBody,
  activationRequest,
  NOW_MS,
  retireBody,
  scheduleAt,
  scheduleBody,
  scheduleHarness,
  scheduledResource,
} from './governed-activation.test-support';
import {
  expectError,
  expectNoWork,
  jsonReply,
  PARTY_ID,
} from './governed-review-ops.test-support';

const INVALID = 'GOVERNED_REVIEW_VALIDATION_FAILED';
const at = (overrides: Record<string, unknown>) =>
  scheduleBody({ activateAt: scheduleAt(overrides) });

type Case = readonly [
  name: string,
  activateAt: Record<string, unknown>,
  details: Record<string, unknown>,
  pointer: string,
];

const CASES: readonly Case[] = [
  [
    'an unknown zone',
    { timezone: 'Mars/Phobos' },
    { reasonCode: 'unknown_timezone' },
    '/activateAt/timezone',
  ],
  [
    'another tz database version',
    { tzdbVersion: '2025a' },
    { reasonCode: 'tzdb_version_mismatch', pinnedVersion: CMS_TZDB_VERSION },
    '/activateAt/tzdbVersion',
  ],
  [
    'a local time inside the spring-forward gap',
    {
      localDateTime: '2027-03-14T02:30:00',
      resolvedUtc: '2027-03-14T07:30:00Z',
    },
    {
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
    },
    '/activateAt/localDateTime',
  ],
  [
    'a repeated local time without a disambiguation',
    {
      localDateTime: '2026-11-01T01:30:00',
      resolvedUtc: '2026-11-01T05:30:00Z',
    },
    {
      reasonCode: 'ambiguous_local_time',
      alternatives: [
        { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
        { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
      ],
    },
    '/activateAt/disambiguation',
  ],
  [
    'a disambiguation on a unique local time',
    { disambiguation: 'earlier' },
    { reasonCode: 'disambiguation_not_applicable' },
    '/activateAt/disambiguation',
  ],
  [
    'a resolved instant that is not the local time',
    { resolvedUtc: '2026-11-01T15:30:00Z' },
    {
      reasonCode: 'resolved_utc_mismatch',
      expectedUtc: '2026-11-01T14:30:00Z',
    },
    '/activateAt/resolvedUtc',
  ],
  [
    'an instant under the 60 second lead',
    {
      localDateTime: '2026-10-13T20:00:30',
      resolvedUtc: '2026-10-14T00:00:30Z',
    },
    {
      reasonCode: 'schedule_out_of_horizon',
      minUtc: new Date(NOW_MS + 60_000).toISOString(),
      maxUtc: new Date(NOW_MS + 366 * 86_400_000).toISOString(),
    },
    '/activateAt/resolvedUtc',
  ],
  [
    'an instant beyond 366 days',
    {
      localDateTime: '2027-10-16T09:30:00',
      resolvedUtc: '2027-10-16T13:30:00Z',
    },
    {
      reasonCode: 'schedule_out_of_horizon',
      minUtc: new Date(NOW_MS + 60_000).toISOString(),
      maxUtc: new Date(NOW_MS + 366 * 86_400_000).toISOString(),
    },
    '/activateAt/resolvedUtc',
  ],
];

describe('CMS-03C-09 schedule: the Worker Time authority (BE03b E8, BE03c 1326 step 6)', () => {
  it.each(CASES)(
    'refuses %s with 422 and the typed time refusal before any RPC',
    async (_name, activateAt, details, pointer) => {
      const harness = scheduleHarness();
      const error = await expectError(
        await harness.send(activationRequest(at(activateAt))),
        422,
        INVALID,
      );
      const reason = details.reasonCode as string;
      expect(error.details).toEqual({
        ...details,
        violations: [
          { path: pointer, code: reason, message: 'The value is invalid.' },
        ],
      });
      expect(
        CmsGovernedTimeRefusalDetailsSchema.safeParse(error.details).success,
      ).toBe(true);
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('verifies the instant over the injected clock and the pinned snapshot, then forwards it unchanged', async () => {
    const harness = scheduleHarness();
    const response = await harness.send(activationRequest(scheduleBody()));
    expect(response.status).toBe(202);
    expect(harness.fetchImpl).toHaveBeenCalledOnce();
  });

  it('accepts the earlier and the later instant of a repeated local time when named', async () => {
    for (const [disambiguation, resolvedUtc] of [
      ['earlier', '2026-11-01T05:30:00Z'],
      ['later', '2026-11-01T06:30:00Z'],
    ] as const) {
      // The stored instant must be the one verified: the reply names the resolved instant.
      const harness = scheduleHarness({}, () =>
        jsonReply(scheduledResource({ scheduledForUtc: resolvedUtc })),
      );
      const response = await harness.send(
        activationRequest(
          at({
            localDateTime: '2026-11-01T01:30:00',
            resolvedUtc,
            disambiguation,
          }),
        ),
      );
      expect(response.status).toBe(202);
    }
  });

  it('answers 503 DEPENDENCY_UNAVAILABLE when the pinned snapshot yields no authority, after the quotas', async () => {
    const harness = scheduleHarness({
      dependencies: { timeAuthority: async () => null },
    });
    const response = await harness.send(activationRequest(scheduleBody()));
    const error = await expectError(response, 503, 'DEPENDENCY_UNAVAILABLE');
    expect(error.details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
    expect(response.headers.get('retry-after')).toBe('15');
    expect(harness.rateLimit).toHaveBeenCalledTimes(2);
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('hands the authority the request instant of the injected clock', async () => {
    const resolveSchedule = vi.fn(() => ({
      ok: true as const,
      resolvedUtc: '2026-11-01T14:30:00Z',
      unixSeconds: 0,
      nanos: 0,
      offsetSeconds: -18_000,
      disambiguation: 'none' as const,
    }));
    const harness = scheduleHarness({
      dependencies: {
        timeAuthority: async () => ({ resolveSchedule }) as never,
      },
    });
    expect((await harness.send(activationRequest(scheduleBody()))).status).toBe(
      202,
    );
    expect(resolveSchedule).toHaveBeenCalledExactlyOnceWith(
      scheduleAt(),
      NOW_MS,
    );
  });

  it('never consults the authority for an activation or a retirement', async () => {
    for (const body of [activateBody(), retireBody()]) {
      const timeAuthority = vi.fn(async () => null);
      const harness = scheduleHarness({ dependencies: { timeAuthority } }, () =>
        jsonReply({ not: 'used' }),
      );
      await harness.send(activationRequest(body));
      expect(timeAuthority).not.toHaveBeenCalled();
      expect(harness.fetchImpl).toHaveBeenCalledOnce();
    }
  });

  it('keeps the order MFA, then both quotas, then the time rules', async () => {
    const stale = scheduleHarness({ stepUpAt: null });
    await expectError(
      await stale.send(activationRequest(at({ timezone: 'Mars/Phobos' }))),
      401,
      'STEP_UP_REQUIRED',
    );
    expectNoWork(stale);

    const limited = scheduleHarness({
      tuning: {
        now: () => NOW_MS,
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: input.actorId !== PARTY_ID,
            limit: input.limit,
            remaining: 0,
            resetAt: 61,
          },
        }),
      },
    });
    await expectError(
      await limited.send(activationRequest(at({ timezone: 'Mars/Phobos' }))),
      429,
      'RATE_LIMITED',
    );
    expect(limited.fetchImpl).not.toHaveBeenCalled();

    const admitted = scheduleHarness();
    await expectError(
      await admitted.send(activationRequest(at({ timezone: 'Mars/Phobos' }))),
      422,
      INVALID,
    );
    expect(admitted.rateLimit).toHaveBeenCalledTimes(2);
  });

  it('forwards the scheduled instant it verified, so a stored schedule keeps the accepted text', async () => {
    const harness = scheduleHarness({}, () => jsonReply(scheduledResource()));
    await harness.send(activationRequest(scheduleBody()));
    const wire = JSON.parse(
      String(harness.fetchImpl.mock.calls[0]?.[1]?.body),
    ) as { p_request: { activateAt: unknown } };
    expect(wire.p_request.activateAt).toEqual(scheduleAt());
  });
});
