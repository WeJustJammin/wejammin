import { describe, expect, it } from 'vitest';

import {
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  CmsCapabilityGrantListPageSchema,
  CmsCapabilityGrantListQuerySchema,
  CmsCapabilityGrantResourceSchema,
  CmsUtcDateSchema,
  GRANTABLE_CMS_CAPABILITIES,
  GrantableCmsCapabilitySchema,
  daysBetweenUtcDates,
  getContentSchemaRegistryBrowserOpenApiComponentSchemas,
  utcDateToEpochMs,
} from './index';
import { meta, uuid2 } from './review-fixtures.test-support';

const grant = {
  ...meta,
  resourceKind: 'cms_capability_grant' as const,
  state: 'active' as const,
  subjectPersonId: uuid2,
  capability: 'cms.author' as const,
  validFrom: '2026-10-02',
  validThrough: '2026-10-08',
  endsAt: '2026-10-09T00:00:00.000Z',
  lastAction: 'granted' as const,
  reason: null,
};

describe('grantable CMS capability registry', () => {
  it('is the closed DEC-119 set', () => {
    expect([...GRANTABLE_CMS_CAPABILITIES]).toEqual([
      'cms.schema_registry.read',
      'cms.schema_designer',
      'cms.template_designer',
      'cms.taxonomy_curator',
      'cms.author',
      'cms.editor',
      'cms.reviewer',
      'cms.reviewer.policy',
      'cms.reviewer.legal',
      'cms.reviewer.security',
      'cms.reviewer.financial',
      'cms.publisher',
      'cms.navigation_editor',
      'cms.media_contributor',
      'cms.media_curator',
    ]);
    expect(GrantableCmsCapabilitySchema.options).toEqual([
      ...GRANTABLE_CMS_CAPABILITIES,
    ]);
  });

  it.each([
    'cms.schema_review',
    'cms.schema_review.assign',
    'cms.delivery_review',
    'cms.delivery_review.assign',
    'cms.public_content.read',
    'admin.cms',
    'admin.*',
    'cms.*',
    '*',
    'cms.unregistered',
    '',
  ])('refuses %j', (capability) => {
    expect(GrantableCmsCapabilitySchema.safeParse(capability).success).toBe(
      false,
    );
  });
});

describe('UTC date helpers', () => {
  it('accepts only real calendar dates', () => {
    expect(CmsUtcDateSchema.safeParse('2026-10-02').success).toBe(true);
    expect(CmsUtcDateSchema.safeParse('2028-02-29').success).toBe(true);
    expect(CmsUtcDateSchema.safeParse('0001-01-01').success).toBe(true);
    for (const bad of [
      '2026-02-29',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-10-00',
      '2026-10-32',
      '2026-10-2',
      '2026-10-02T00:00:00Z',
      ' 2026-10-02',
      '',
    ])
      expect(CmsUtcDateSchema.safeParse(bad).success, bad).toBe(false);
  });

  it('computes whole UTC days and refuses non-dates', () => {
    expect(utcDateToEpochMs('1970-01-01')).toBe(0);
    expect(utcDateToEpochMs('1970-01-02')).toBe(86_400_000);
    expect(utcDateToEpochMs('2026-02-30')).toBeNull();
    expect(utcDateToEpochMs('not-a-date')).toBeNull();
    expect(daysBetweenUtcDates('2026-10-02', '2026-10-08')).toBe(6);
    expect(daysBetweenUtcDates('2026-10-08', '2026-10-02')).toBe(-6);
    expect(daysBetweenUtcDates('2026-02-30', '2026-10-02')).toBeNull();
    expect(daysBetweenUtcDates('2026-10-02', 'bad')).toBeNull();
  });
});

describe('CMS-03A-15..17 request contracts', () => {
  const create = {
    subjectPersonId: uuid2,
    capability: 'cms.reviewer.legal',
    validThrough: '2026-10-08',
  };

  it('accepts a grant with and without a reason', () => {
    expect(CapabilityGrantRequestSchema.parse(create)).toEqual(create);
    expect(
      CapabilityGrantRequestSchema.parse({ ...create, reason: 'x'.repeat(256) })
        .reason,
    ).toHaveLength(256);
  });

  it('allows every grantable capability, including the owner itself', () => {
    for (const capability of GRANTABLE_CMS_CAPABILITIES)
      expect(
        CapabilityGrantRequestSchema.safeParse({ ...create, capability })
          .success,
      ).toBe(true);
  });

  it.each([
    ['unknown key', { ...create, ownerId: uuid2 }],
    [
      'non-grantable capability',
      { ...create, capability: 'cms.schema_review' },
    ],
    ['malformed person id', { ...create, subjectPersonId: 'person' }],
    ['non-date validThrough', { ...create, validThrough: '2026-02-30' }],
    ['empty reason', { ...create, reason: '' }],
    ['oversized reason', { ...create, reason: 'x'.repeat(257) }],
    [
      'missing validThrough',
      { subjectPersonId: uuid2, capability: 'cms.author' },
    ],
  ])('rejects a grant with %s', (_label, body) => {
    expect(CapabilityGrantRequestSchema.safeParse(body).success).toBe(false);
  });

  it('validates renewal and revocation bodies', () => {
    const renewal = { expectedVersion: '3', validThrough: '2026-10-08' };
    expect(CapabilityGrantRenewalRequestSchema.parse(renewal)).toEqual(renewal);
    expect(
      CapabilityGrantRenewalRequestSchema.safeParse({
        ...renewal,
        expectedVersion: '0',
      }).success,
    ).toBe(false);
    expect(
      CapabilityGrantRenewalRequestSchema.safeParse({
        expectedVersion: '3',
      }).success,
    ).toBe(false);
    const revocation = { expectedVersion: '3', reason: 'left the project' };
    expect(CapabilityGrantRevocationRequestSchema.parse(revocation)).toEqual(
      revocation,
    );
    expect(
      CapabilityGrantRevocationRequestSchema.safeParse({
        expectedVersion: '3',
        validThrough: '2026-10-08',
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03A-18 list query contract', () => {
  it('applies the BE03a defaults and coerces the limit', () => {
    expect(CmsCapabilityGrantListQuerySchema.parse({})).toEqual({
      limit: 25,
      sort: 'updatedAt',
      direction: 'desc',
    });
    expect(
      CmsCapabilityGrantListQuerySchema.parse({
        limit: '100',
        subjectPersonId: uuid2,
        capability: 'cms.publisher',
        state: 'lapsed',
        cursor: 'c'.repeat(512),
        sort: 'validThrough',
        direction: 'asc',
      }),
    ).toMatchObject({ limit: 100, state: 'lapsed', sort: 'validThrough' });
  });

  it.each([
    ['limit zero', { limit: '0' }],
    ['limit 101', { limit: '101' }],
    ['unknown state', { state: 'expired' }],
    ['unknown sort', { sort: 'createdAt' }],
    ['oversized cursor', { cursor: 'c'.repeat(513) }],
    ['non-grantable capability', { capability: 'cms.schema_review' }],
    ['unknown filter', { organizationId: uuid2 }],
  ])('rejects %s', (_label, query) => {
    expect(CmsCapabilityGrantListQuerySchema.safeParse(query).success).toBe(
      false,
    );
  });
});

describe('CmsCapabilityGrantResource', () => {
  it('accepts every derived state across a single-day to seven-day term', () => {
    for (const state of ['active', 'lapsed', 'revoked'] as const)
      expect(
        CmsCapabilityGrantResourceSchema.safeParse({ ...grant, state }).success,
      ).toBe(true);
    expect(
      CmsCapabilityGrantResourceSchema.safeParse({
        ...grant,
        validThrough: '2026-10-02',
        endsAt: '2026-10-03T00:00:00Z',
        lastAction: 'renewed',
        reason: 'because',
      }).success,
    ).toBe(true);
  });

  it('rejects a term longer than seven UTC days or ending before it starts', () => {
    const longer = CmsCapabilityGrantResourceSchema.safeParse({
      ...grant,
      validThrough: '2026-10-09',
      endsAt: '2026-10-10T00:00:00.000Z',
    });
    expect(longer.success).toBe(false);
    expect(longer.error?.issues.map(({ message }) => message)).toEqual([
      'grant_term_spans_at_most_seven_utc_days',
    ]);
    expect(
      CmsCapabilityGrantResourceSchema.safeParse({
        ...grant,
        validThrough: '2026-10-01',
        endsAt: '2026-10-02T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('requires endsAt to be the start of the UTC day after validThrough', () => {
    const result = CmsCapabilityGrantResourceSchema.safeParse({
      ...grant,
      endsAt: '2026-10-08T23:59:59.000Z',
    });
    expect(result.error?.issues.map(({ message }) => message)).toEqual([
      'ends_at_must_be_start_of_day_after_valid_through',
    ]);
  });

  it('skips the term checks when a date is malformed and reports the shape', () => {
    const result = CmsCapabilityGrantResourceSchema.safeParse({
      ...grant,
      validFrom: '2026-02-30',
      validThrough: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('exposes no grantor, actor, party, binding, or ownership identifier', () => {
    for (const key of [
      'grantorPersonId',
      'actorId',
      'actingPartyId',
      'bindingId',
      'ownerId',
    ])
      expect(
        CmsCapabilityGrantResourceSchema.safeParse({ ...grant, [key]: uuid2 })
          .success,
      ).toBe(false);
    const serialized = JSON.stringify(
      getContentSchemaRegistryBrowserOpenApiComponentSchemas()
        .CmsCapabilityGrantResource,
    );
    expect(serialized).not.toMatch(
      /grantor|actorId|actingPartyId|binding|owner/iu,
    );
  });

  it('pages at most one hundred grants with a nullable cursor', () => {
    expect(
      CmsCapabilityGrantListPageSchema.parse({
        items: [grant],
        nextCursor: null,
      }).items,
    ).toHaveLength(1);
    expect(
      CmsCapabilityGrantListPageSchema.safeParse({
        items: Array.from({ length: 101 }, () => grant),
        nextCursor: 'cursor',
      }).success,
    ).toBe(false);
    expect(
      CmsCapabilityGrantListPageSchema.safeParse({
        items: [],
        nextCursor: '',
      }).success,
    ).toBe(false);
  });
});
