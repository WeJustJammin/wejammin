import { describe, expect, it } from 'vitest';

import {
  hash,
  instant,
  isRefused,
  issuePaths,
  laterInstant,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_GOVERNED_ACTIVATION_EVENT_TYPES,
  GovernedActivationApiRequestSchema,
  GovernedActivationHeadersSchema,
  GovernedActivationRequestSchema,
  GovernedActivationResourceSchema,
  ScheduledInstantSchema,
  governedActivationSuccessStatus,
} from './governed-activation';

const reviewId = uid(50);
const activateAt = {
  localDateTime: '2026-11-01T09:30:00',
  timezone: 'America/New_York',
  resolvedUtc: '2026-11-01T14:30:00Z',
  tzdbVersion: '2026e',
  disambiguation: 'none',
} as const;
const headers = {
  contentType: 'application/json',
  idempotencyKey: 'governed-activate-0001',
  ifMatch: '"6"',
} as const;
const activate = { action: 'activate', expectedVersion: '6' } as const;
const schedule = {
  action: 'schedule',
  expectedVersion: '6',
  activateAt,
} as const;
const retire = { action: 'retire', expectedVersion: '6' } as const;

const resource = {
  reviewId,
  reviewVersion: '7',
  subjectKind: 'template_version',
  subjectId: uid(51),
  lineageId: uid(52),
  subjectVersion: 3,
  action: 'activate',
  subjectState: 'active',
  activatedAt: instant,
  scheduledForUtc: null,
  eventType: 'cms.template.activated.v1',
} as const;
const scheduledResource = {
  ...resource,
  action: 'schedule',
  subjectState: 'scheduled',
  activatedAt: null,
  scheduledForUtc: laterInstant,
  eventType: null,
} as const;
const retiredResource = {
  ...resource,
  action: 'retire',
  subjectState: 'retired',
  eventType: 'cms.template.activated.v1',
} as const;

describe('ScheduledInstant (03b Time authority, OD-6)', () => {
  it('[P2-S12-AC-082] accepts the five members of the shared scheduled instant', () => {
    expect(ScheduledInstantSchema.parse(activateAt)).toEqual(activateAt);
    for (const disambiguation of ['none', 'earlier', 'later'])
      expect(
        ScheduledInstantSchema.safeParse({ ...activateAt, disambiguation })
          .success,
      ).toBe(true);
  });

  it('[P2-S12-AC-083] refuses an offset-bearing local time, an off-grammar zone or tzdb version and a missing or extra member', () => {
    for (const candidate of [
      { ...activateAt, localDateTime: '2026-11-01T09:30:00Z' },
      { ...activateAt, localDateTime: '2026-11-01T09:30:00+02:00' },
      { ...activateAt, localDateTime: '2026-02-30T09:30:00' },
      { ...activateAt, localDateTime: '2026-11-01T24:00:00' },
      { ...activateAt, localDateTime: '2026-11-01' },
      { ...activateAt, timezone: '' },
      { ...activateAt, timezone: '1Bad/Zone' },
      { ...activateAt, timezone: '../etc' },
      { ...activateAt, timezone: 'x'.repeat(65) },
      { ...activateAt, resolvedUtc: '2026-11-01T14:30:00' },
      { ...activateAt, resolvedUtc: 'noon' },
      { ...activateAt, tzdbVersion: '' },
      { ...activateAt, tzdbVersion: 'x'.repeat(33) },
      { ...activateAt, tzdbVersion: '2026 e' },
      { ...activateAt, disambiguation: 'fold' },
      { ...activateAt, offset: '-05:00' },
      without(activateAt, 'tzdbVersion'),
      without(activateAt, 'disambiguation'),
      without(activateAt, 'resolvedUtc'),
    ])
      expect(isRefused(ScheduledInstantSchema, candidate)).toBe(true);
    expect(
      ScheduledInstantSchema.safeParse({
        ...activateAt,
        timezone: 'UTC',
        tzdbVersion: 'x'.repeat(32),
      }).success,
    ).toBe(true);
  });
});

describe('CMS-03C-09 governed activation request', () => {
  it('[P2-S12-AC-082] discriminates activate, schedule (with activateAt) and retire (with an optional reason)', () => {
    for (const body of [activate, schedule, retire])
      expect(GovernedActivationRequestSchema.parse(body)).toEqual(body);
    expect(
      GovernedActivationRequestSchema.parse({
        ...retire,
        reason: 'Superseded',
      }),
    ).toEqual({ ...retire, reason: 'Superseded' });
  });

  it('[P2-S12-AC-082] refuses an unknown action and a member the action does not name', () => {
    for (const candidate of [
      { ...activate, action: 'publish' },
      { ...activate, activateAt },
      { ...activate, reason: 'because' },
      { ...retire, activateAt },
      { ...schedule, reason: 'because' },
      without(schedule, 'activateAt'),
      without(activate, 'expectedVersion'),
      without(retire, 'expectedVersion'),
      without(schedule, 'expectedVersion'),
      { ...activate, expectedVersion: '0' },
      { ...activate, expectedVersion: 6 },
      { ...activate, subjectId: uid(1) },
      { ...activate, stepUpAt: instant },
      { ...schedule, activateAt: { ...activateAt, resolvedUtc: 'noon' } },
      { ...schedule, activateAt: null },
    ])
      expect(isRefused(GovernedActivationRequestSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-083] bounds the retire reason at 1 to 256 NFC code points', () => {
    for (const reason of ['r', 'r'.repeat(256), '😀'.repeat(256)])
      expect(
        GovernedActivationRequestSchema.safeParse({ ...retire, reason })
          .success,
      ).toBe(true);
    for (const reason of ['', 'r'.repeat(257), '😀'.repeat(257), 'café'])
      expect(
        isRefused(GovernedActivationRequestSchema, { ...retire, reason }),
      ).toBe(true);
  });

  it('[P2-S12-AC-085] requires key + strong If-Match and ties the If-Match operand to expectedVersion for every action', () => {
    expect(GovernedActivationHeadersSchema.parse(headers)).toEqual(headers);
    for (const candidate of [
      without(headers, 'ifMatch'),
      { ...headers, ifMatch: 'W/"6"' },
      { ...headers, idempotencyKey: 'short' },
      { ...headers, contentType: 'application/xml' },
    ])
      expect(isRefused(GovernedActivationHeadersSchema, candidate)).toBe(true);
    for (const body of [activate, schedule, retire]) {
      expect(
        GovernedActivationApiRequestSchema.safeParse({
          reviewId,
          headers,
          body,
        }).success,
      ).toBe(true);
      expect(
        issuePaths(GovernedActivationApiRequestSchema, {
          reviewId,
          headers: { ...headers, ifMatch: '"7"' },
          body,
        }),
      ).toEqual(['headers.ifMatch']);
    }
    expect(
      isRefused(GovernedActivationApiRequestSchema, {
        headers,
        body: activate,
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-082] answers 200 for activate and retire and 202 for schedule', () => {
    expect(governedActivationSuccessStatus('activate')).toBe(200);
    expect(governedActivationSuccessStatus('retire')).toBe(200);
    expect(governedActivationSuccessStatus('schedule')).toBe(202);
  });
});

describe('GovernedActivationResource', () => {
  it('[P2-S12-AC-082] closes the activation event types to the three subject kinds', () => {
    expect(CMS_GOVERNED_ACTIVATION_EVENT_TYPES).toEqual({
      template_version: 'cms.template.activated.v1',
      pattern_version: 'cms.pattern.activated.v1',
      taxonomy_version: 'cms.taxonomy.changed.v1',
    });
  });

  it('[P2-S12-AC-082] accepts an immediate activation, a scheduled acceptance and a retirement', () => {
    for (const candidate of [resource, scheduledResource, retiredResource])
      expect(GovernedActivationResourceSchema.parse(candidate)).toEqual(
        candidate,
      );
  });

  it('[P2-S12-AC-082] sets eventType only on a committed immediate activation or retirement, matching the subject kind', () => {
    expect(
      isRefused(GovernedActivationResourceSchema, {
        ...scheduledResource,
        eventType: 'cms.template.activated.v1',
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedActivationResourceSchema, {
        ...resource,
        eventType: null,
      }),
    ).toBe(true);
    expect(
      isRefused(GovernedActivationResourceSchema, {
        ...retiredResource,
        eventType: null,
      }),
    ).toBe(true);
    const kinds = [
      ['template_version', 'cms.template.activated.v1'],
      ['pattern_version', 'cms.pattern.activated.v1'],
      ['taxonomy_version', 'cms.taxonomy.changed.v1'],
    ] as const;
    for (const [subjectKind, eventType] of kinds) {
      expect(
        GovernedActivationResourceSchema.safeParse({
          ...resource,
          subjectKind,
          eventType,
        }).success,
      ).toBe(true);
      for (const [, wrong] of kinds.filter(([, event]) => event !== eventType))
        expect(
          issuePaths(GovernedActivationResourceSchema, {
            ...resource,
            subjectKind,
            eventType: wrong,
          }),
        ).toEqual(['eventType']);
    }
  });

  it('[P2-S12-AC-082] ties the action to the resulting subject state and the activation and schedule instants', () => {
    for (const candidate of [
      { ...resource, subjectState: 'scheduled' },
      { ...resource, subjectState: 'retired' },
      { ...resource, scheduledForUtc: laterInstant },
      { ...resource, activatedAt: null },
      { ...scheduledResource, subjectState: 'active' },
      { ...scheduledResource, scheduledForUtc: null },
      { ...scheduledResource, activatedAt: instant },
      { ...retiredResource, subjectState: 'active' },
      { ...retiredResource, scheduledForUtc: laterInstant },
    ])
      expect(isRefused(GovernedActivationResourceSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-082] refuses an unknown action or state, a malformed version or instant and any ownership member', () => {
    for (const candidate of [
      { ...resource, action: 'cancel' },
      { ...resource, subjectState: 'blocked' },
      { ...resource, reviewVersion: '0' },
      { ...resource, subjectVersion: 0 },
      { ...resource, subjectVersion: 1.5 },
      { ...resource, activatedAt: '2026-10-13T12:00:00' },
      { ...resource, subjectKind: 'navigation_version' },
      { ...resource, subjectId: 'x' },
      { ...resource, lineageId: 'x' },
      { ...resource, ownerId: uid(1) },
      { ...resource, contentHash: hash },
      without(resource, 'eventType'),
      without(resource, 'scheduledForUtc'),
      without(resource, 'lineageId'),
    ])
      expect(isRefused(GovernedActivationResourceSchema, candidate)).toBe(true);
  });
});
