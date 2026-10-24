import { describe, expect, it } from 'vitest';

import {
  SCHEDULED_INSTANT,
  governedActivationFixture,
  governedRetiredFixture,
  governedScheduledFixture,
} from './cms-governed-review-fixtures.test-support';
import {
  CASES,
  catalogError,
  request,
  run,
  success,
  type CommandCase,
} from './cms-governed-review-platform-command.test-support';
import { bindingFor } from './cms-workflow-platform-command.test-support';

/*
 * CMS-03C-09 specifics (BE03c row 171 and 1326, DEC-190): the strict
 * discriminated body, the version each action must answer at, and the typed
 * refusals the operation may publish. The shared transport rules are covered by
 * the table-driven suite beside this one.
 */
const [activate, schedule, retire] = CASES.slice(-3) as unknown as readonly [
  CommandCase,
  CommandCase,
  CommandCase,
];

const withBody = (testCase: CommandCase, body: unknown) =>
  request(testCase, { body: JSON.stringify(body) });

const violationPaths = async (response: Response): Promise<string[]> =>
  (
    (await response.json()) as { details: { violations?: { path: string }[] } }
  ).details.violations?.map((entry) => entry.path) ?? [];

describe('CMS-03C-09 request body', () => {
  it('refuses members that do not belong to the action, naming only the contract pointer', async () => {
    const cases: readonly [CommandCase, Record<string, unknown>, string][] = [
      [
        activate,
        { ...(activate.body as object), activateAt: SCHEDULED_INSTANT },
        '/',
      ],
      [activate, { ...(activate.body as object), reason: 'No.' }, '/'],
      [schedule, { action: 'schedule', expectedVersion: '2' }, '/activateAt'],
      [
        schedule,
        {
          ...(schedule.body as object),
          activateAt: { ...SCHEDULED_INSTANT, timezone: '' },
        },
        '/activateAt',
      ],
      [
        retire,
        { ...(retire.body as object), activateAt: SCHEDULED_INSTANT },
        '/',
      ],
      [retire, { ...(retire.body as object), reason: '' }, '/reason'],
      [
        retire,
        { ...(retire.body as object), reason: 'x'.repeat(257) },
        '/reason',
      ],
      [retire, { ...(retire.body as object), reason: 'é' }, '/reason'],
      [retire, { action: 'delete', expectedVersion: '2' }, '/action'],
    ];
    for (const [testCase, body, pointer] of cases) {
      const binding = bindingFor();
      const response = await run(testCase, withBody(testCase, body), binding);
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect(await violationPaths(response)).toContain(pointer);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });

  it('accepts a retirement without a reason and forwards exactly the body it was sent', async () => {
    const body = { action: 'retire', expectedVersion: '2' };
    const binding = bindingFor(success(retire));
    const response = await run(retire, withBody(retire, body), binding);
    expect(response.status).toBe(200);
    expect(JSON.parse(await (binding.requests()[0] as Request).text())).toEqual(
      body,
    );
  });

  it('takes the review from the path only: the body names none', async () => {
    for (const testCase of [activate, schedule, retire])
      expect(Object.keys(testCase.body)).not.toContain('reviewId');
    const response = await run(
      activate,
      withBody(activate, { ...(activate.body as object), reviewId: 'x' }),
      bindingFor(),
    );
    expect(response.status).toBe(422);
  });
});

describe('CMS-03C-09 response binding', () => {
  const unverified = async (
    testCase: CommandCase,
    resource: unknown,
    etag: string,
  ) => {
    const response = await run(
      testCase,
      request(testCase),
      bindingFor(success(testCase, { resource, etag })),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  };

  it('binds an activation and a retirement to the review version advanced by one', async () => {
    await unverified(
      activate,
      governedActivationFixture({ reviewVersion: '2' }),
      '"2"',
    );
    await unverified(
      activate,
      governedActivationFixture({ reviewVersion: '4' }),
      '"4"',
    );
    await unverified(
      retire,
      governedRetiredFixture({ reviewVersion: '2' }),
      '"2"',
    );
    await unverified(
      retire,
      governedRetiredFixture({ reviewVersion: '9' }),
      '"9"',
    );
  });

  it('binds a scheduled acceptance to the unchanged review version and the requested instant', async () => {
    await unverified(
      schedule,
      governedScheduledFixture({ reviewVersion: '3' }),
      '"3"',
    );
    await unverified(
      schedule,
      governedScheduledFixture({ scheduledForUtc: '2026-12-01T14:00:01Z' }),
      '"2"',
    );
  });

  it('accepts the stored instant when it differs from the requested one by a millisecond', async () => {
    const response = await run(
      schedule,
      request(schedule),
      bindingFor(
        success(schedule, {
          resource: governedScheduledFixture({
            scheduledForUtc: '2026-12-01T14:00:00.001Z',
          }),
        }),
      ),
    );
    expect(response.status).toBe(202);
  });

  it('refuses an answer for another action or another review', async () => {
    await unverified(activate, governedRetiredFixture(), '"3"');
    await unverified(retire, governedActivationFixture(), '"3"');
    await unverified(
      schedule,
      governedActivationFixture({ reviewVersion: '2' }),
      '"2"',
    );
  });

  it('refuses an answer that is not the strict resource', async () => {
    await unverified(
      activate,
      { ...governedActivationFixture(), unknownMember: 1 },
      '"3"',
    );
    await unverified(
      activate,
      { ...governedActivationFixture(), eventType: null },
      '"3"',
    );
  });

  it('refuses an answer whose supersededVersion (DEC-191) is missing, mistyped or named by a retirement or schedule', async () => {
    const withoutMember: Record<string, unknown> = {
      ...governedActivationFixture(),
    };
    delete withoutMember.supersededVersion;
    await unverified(activate, withoutMember, '"3"');
    for (const supersededVersion of ['1', 0, -1, 1.5, true])
      await unverified(
        activate,
        { ...governedActivationFixture(), supersededVersion },
        '"3"',
      );
    await unverified(
      retire,
      { ...governedRetiredFixture(), supersededVersion: 1 },
      '"3"',
    );
    await unverified(
      schedule,
      { ...governedScheduledFixture(), supersededVersion: 1 },
      '"2"',
    );
  });

  it('relays the superseded version of an activation and null for a first activation', async () => {
    for (const supersededVersion of [1, 7, null]) {
      const resource = governedActivationFixture({ supersededVersion });
      const response = await run(
        activate,
        request(activate),
        bindingFor(success(activate, { resource })),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(resource);
    }
  });
});

describe('CMS-03C-09 refusals', () => {
  const refuse = async (testCase: CommandCase, upstream: Response) => {
    const response = await run(
      testCase,
      request(testCase),
      bindingFor(upstream),
    );
    return {
      status: response.status,
      body: (await response.json()) as {
        code: string;
        details: Record<string, unknown>;
      },
      marked: response.headers.has('x-cms-editorial-outcome'),
    };
  };

  it.each([
    'subject_not_activatable',
    'subject_not_retirable',
    'activation_conflict',
    'schedule_exists',
    'dependency_changed',
  ])('relays the 409 token %s as a definite refusal', async (reasonCode) => {
    const { status, body, marked } = await refuse(
      activate,
      catalogError(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', { reasonCode }),
    );
    expect(status).toBe(409);
    expect(body.code).toBe('GOVERNED_REVIEW_VERSION_CONFLICT');
    expect(body.details).toEqual({ reasonCode });
    expect(marked).toBe(false);
  });

  it('drops a 409 token the operation does not publish and relays a bare version conflict', async () => {
    const { body } = await refuse(
      activate,
      catalogError(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
        reasonCode: 'review_not_open',
      }),
    );
    expect(body.details).toEqual({});
  });

  it.each([
    'unknown_timezone',
    'tzdb_version_mismatch',
    'nonexistent_local_time',
    'ambiguous_local_time',
    'disambiguation_not_applicable',
    'resolved_utc_mismatch',
    'schedule_out_of_horizon',
    'authority_ends_before_schedule',
  ])(
    'relays the 422 time token %s with its pointers and no typed member',
    async (reasonCode) => {
      const { status, body } = await refuse(
        schedule,
        catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
          reasonCode,
          pinnedVersion: '2026e',
          alternatives: [{ localDateTime: '2026-03-08T03:00' }],
          minUtc: '2026-10-15T00:00:00Z',
          violations: [
            {
              path: '/activateAt/localDateTime',
              code: reasonCode,
              message: 'attacker text',
            },
            { path: '/somewhere/else', code: 'x', message: 'y' },
          ],
        }),
      );
      expect(status).toBe(422);
      expect(body.details).toEqual({
        reasonCode,
        violations: [
          {
            path: '/activateAt/localDateTime',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      });
    },
  );

  it('names the unbuilt canonical domain and refuses a domain-less answer', async () => {
    const named = await refuse(
      activate,
      catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'canonical_source_unavailable',
        domain: 'rights',
      }),
    );
    expect(named.body.details).toEqual({
      reasonCode: 'canonical_source_unavailable',
      domain: 'rights',
    });
    const bare = await refuse(
      activate,
      catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'canonical_source_unavailable',
      }),
    );
    expect(bare.body.details).toEqual({});
  });

  it('relays 403 capability_missing, 404 and the step-up shortfall for this operation', async () => {
    expect(
      (
        await refuse(
          retire,
          catalogError(403, 'GOVERNED_REVIEW_FORBIDDEN', {
            reasonCode: 'capability_missing',
          }),
        )
      ).body.details,
    ).toEqual({ reasonCode: 'capability_missing' });
    expect(
      (await refuse(retire, catalogError(404, 'GOVERNED_REVIEW_NOT_FOUND')))
        .status,
    ).toBe(404);
    const stepUp = await refuse(
      retire,
      catalogError(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(stepUp.status).toBe(401);
    expect(stepUp.body.code).toBe('STEP_UP_REQUIRED');
    expect(stepUp.marked).toBe(false);
  });

  it('publishes a 5xx as an unknown outcome', async () => {
    const failed = await refuse(
      schedule,
      catalogError(503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'cms_composition',
        retryable: true,
      }),
    );
    expect(failed.status).toBe(503);
    expect(failed.marked).toBe(true);
  });
});
