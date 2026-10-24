import {
  GovernedActivationApiRequestSchema,
  GovernedActivationRequestSchema,
  GovernedActivationResourceSchema,
  GovernedActivationScheduleReasonSchema,
  GovernedActivationScheduleStateSchema,
  GovernedNextActionSchema,
  GovernedReviewDetailResourceSchema,
  governedActivationSuccessStatus,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  KEY,
  REVIEW_ID,
  SCHEDULED_INSTANT,
  governedActivationFixture,
  governedDetailFixture,
  governedRetiredFixture,
  governedScheduledFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY,
  GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY,
} from './governed-review-labels';
import { GOVERNED_ACTIVATION_SPEC } from './governed-activation-command-spec';
import {
  activationSubmission,
  offeredActivationActions,
  type ActivationTyped,
} from './governed-activation-model';

/*
 * The browser repeats the CMS-03C-09 contract without loading zod, so this suite
 * is the drift guard: what the form builds must be accepted by the generated
 * request schema (headers and If-Match included), and the browser's status and
 * action vocabulary must equal the contract's.
 */
const typed = (overrides: Partial<ActivationTyped>): ActivationTyped => ({
  action: 'activate',
  local: '',
  zone: '',
  reason: '',
  disambiguation: 'none',
  ...overrides,
});

const RESOLVED = {
  kind: 'resolved',
  resolvedUtc: SCHEDULED_INSTANT.resolvedUtc,
  offsetSeconds: -18_000,
  disambiguation: 'none',
} as const;

const BUILT = [
  ['activate', typed({ action: 'activate' })],
  [
    'schedule',
    typed({
      action: 'schedule',
      local: SCHEDULED_INSTANT.localDateTime,
      zone: SCHEDULED_INSTANT.timezone,
    }),
  ],
  ['retire without a reason', typed({ action: 'retire' })],
  [
    'retire with a reason',
    typed({ action: 'retire', reason: 'Superseded by the redesign.' }),
  ],
] as const;

describe('CMS-03C-09 browser/contract drift', () => {
  it.each(BUILT)(
    'builds a %s the generated request schema accepts',
    (_name, input) => {
      const submission = activationSubmission('2', input, RESOLVED);
      expect(submission).not.toBeNull();
      const parsed = GovernedActivationApiRequestSchema.safeParse({
        reviewId: REVIEW_ID,
        headers: {
          contentType: 'application/json',
          idempotencyKey: KEY,
          ifMatch: submission?.ifMatch,
        },
        body: submission?.body,
      });
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(
        GOVERNED_ACTIVATION_SPEC.requestValid(submission?.body as never),
      ).toBe(true);
    },
  );

  it('refuses to build a schedule that is not resolved', () => {
    expect(
      activationSubmission('2', BUILT[1][1], { kind: 'empty' }),
    ).toBeNull();
  });

  it('answers the contract status for every action', () => {
    for (const action of ['activate', 'schedule', 'retire'] as const) {
      const body = { action, expectedVersion: '2' } as never;
      expect(GOVERNED_ACTIVATION_SPEC.successStatus(body)).toBe(
        governedActivationSuccessStatus(action),
      );
    }
  });

  it('offers only actions the review read can permit, in a fixed order', () => {
    const every = GovernedNextActionSchema.options;
    for (const action of ['activate', 'schedule', 'retire'])
      expect(every).toContain(action);
    expect(
      offeredActivationActions(
        governedDetailFixture({
          permittedNextActions: [...every].reverse(),
        }).permittedNextActions,
      ),
    ).toEqual(['activate', 'schedule', 'retire']);
  });

  it('keeps every request member the contract names in the browser table', () => {
    const shapes = GovernedActivationRequestSchema.options.map((option) =>
      Object.keys(option.shape).sort(),
    );
    expect(shapes).toEqual([
      ['action', 'expectedVersion'],
      ['action', 'activateAt', 'expectedVersion'],
      ['action', 'expectedVersion', 'reason'],
    ]);
  });
});

/*
 * DEC-191: the browser re-checks the resource it receives without zod. For every
 * candidate the generated schema and the browser's committed check must agree on
 * the new `supersededVersion` member, and the browser's copy tables must cover
 * the schedule vocabulary exactly.
 */
describe('CMS-03C-09 response drift (DEC-191 supersededVersion)', () => {
  const ids = { reviewId: REVIEW_ID } as never;
  const body = (action: 'activate' | 'schedule' | 'retire') =>
    ({
      activate: { action: 'activate', expectedVersion: '2' },
      schedule: {
        action: 'schedule',
        expectedVersion: '2',
        activateAt: SCHEDULED_INSTANT,
      },
      retire: { action: 'retire', expectedVersion: '2' },
    })[action] as never;
  const omit = (resource: object, key: string): object => {
    const copy: Record<string, unknown> = { ...resource };
    delete copy[key];
    return copy;
  };

  const CANDIDATES: readonly (readonly [
    string,
    'activate' | 'schedule' | 'retire',
    object,
  ])[] = [
    [
      'an activation superseding version 1',
      'activate',
      governedActivationFixture(),
    ],
    [
      'a first activation',
      'activate',
      governedActivationFixture({ supersededVersion: null }),
    ],
    ['a schedule', 'schedule', governedScheduledFixture()],
    ['a retirement', 'retire', governedRetiredFixture()],
  ];
  const BROKEN: readonly (readonly [
    string,
    'activate' | 'schedule' | 'retire',
    object,
  ])[] = [
    [
      'an activation without the member',
      'activate',
      omit(governedActivationFixture(), 'supersededVersion'),
    ],
    ...['2', 0, -1, 1.5, true, {}].map(
      (supersededVersion) =>
        [
          `an activation superseding ${JSON.stringify(supersededVersion)}`,
          'activate',
          { ...governedActivationFixture(), supersededVersion },
        ] as const,
    ),
    [
      'a schedule naming a superseded version',
      'schedule',
      { ...governedScheduledFixture(), supersededVersion: 1 },
    ],
    [
      'a retirement naming a superseded version',
      'retire',
      { ...governedRetiredFixture(), supersededVersion: 1 },
    ],
  ];

  it.each(CANDIDATES)(
    'accepts %s exactly as the contract does and carries the number',
    (_name, action, resource) => {
      const parsed = GovernedActivationResourceSchema.safeParse(resource);
      expect(parsed.success).toBe(true);
      const committed = GOVERNED_ACTIVATION_SPEC.bound(
        ids,
        body(action),
        resource,
      );
      expect(committed).not.toBeNull();
      expect(committed?.supersededVersion).toBe(
        parsed.success ? parsed.data.supersededVersion : 'not parsed',
      );
    },
  );

  it.each(BROKEN)(
    'refuses %s exactly as the contract does',
    (_name, action, resource) => {
      expect(GovernedActivationResourceSchema.safeParse(resource).success).toBe(
        false,
      );
      expect(
        GOVERNED_ACTIVATION_SPEC.bound(ids, body(action), resource),
      ).toBeNull();
    },
  );

  it('names every member of the contract resource', () => {
    expect(
      Object.keys(GovernedActivationResourceSchema.unwrap().shape).sort(),
    ).toEqual([
      'action',
      'activatedAt',
      'eventType',
      'lineageId',
      'reviewId',
      'reviewVersion',
      'scheduledForUtc',
      'subjectId',
      'subjectKind',
      'subjectState',
      'subjectVersion',
      'supersededVersion',
    ]);
  });
});

describe('CMS-03C-10 activationSchedule drift (DEC-191)', () => {
  it('has copy for exactly the states and closed reasons the contract names', () => {
    expect(Object.keys(GOVERNED_ACTIVATION_SCHEDULE_STATE_COPY).sort()).toEqual(
      [...GovernedActivationScheduleStateSchema.options].sort(),
    );
    expect(
      Object.keys(GOVERNED_ACTIVATION_SCHEDULE_REASON_COPY).sort(),
    ).toEqual([...GovernedActivationScheduleReasonSchema.options].sort());
  });

  it('is a member of the contract detail the page parses', () => {
    expect(
      Object.keys(GovernedReviewDetailResourceSchema.unwrap().shape),
    ).toContain('activationSchedule');
  });
});
