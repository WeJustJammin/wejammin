import { describe, expect, it } from 'vitest';

import {
  CmsPublicationScheduleHeadersSchema,
  CmsPublicationSchedulePathParamsSchema,
  CmsPublicationRequestHeadersSchema,
  CmsPreviewRequestHeadersSchema,
  CMS_PUBLICATION_SCHEDULE_SEAMS,
  CMS_PUBLICATION_SEAMS,
  PublicationRequestSchema,
  PublicationScheduleRequestSchema,
  PreviewRequestSchema,
  VersionSetSchema,
} from './index';
import {
  uuid,
  uuid3,
  validPreview,
  validPublication,
  validSchedule,
  validSchemaArtifact,
  validVersionSet,
} from './publication-contracts.test-support';

describe('[P2-S10-AC-043] CMS-03B-07 localDateTime/timezone', () => {
  it('accepts an offset-free local datetime with a 1-64 character IANA timezone', () => {
    expect(
      PublicationScheduleRequestSchema.safeParse(validSchedule).success,
    ).toBe(true);
  });

  it('rejects local datetimes carrying an offset or Z suffix', () => {
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        localDateTime: '2026-11-01T09:30:00-05:00',
      }).success,
    ).toBe(false);
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        localDateTime: '2026-11-01T09:30:00Z',
      }).success,
    ).toBe(false);
  });

  it('rejects a timezone outside 1-64 characters', () => {
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        timezone: '',
      }).success,
    ).toBe(false);
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        timezone: 'A'.repeat(65),
      }).success,
    ).toBe(false);
  });

  const scheduleAccepts = (patch: Record<string, unknown>): boolean =>
    PublicationScheduleRequestSchema.safeParse({ ...validSchedule, ...patch })
      .success;

  it('accepts every IANA name shape: single, two and three segments, and fixed-offset Etc zones', () => {
    for (const timezone of [
      'UTC',
      'GMT',
      'EST5EDT',
      'America/New_York',
      'Etc/GMT+5',
      'Etc/GMT-14',
      'America/Argentina/Buenos_Aires',
      'America/Indiana/Indianapolis',
      'America/North_Dakota/Center',
      'A'.repeat(64),
    ])
      expect(scheduleAccepts({ timezone }), timezone).toBe(true);
  });

  it('refuses a malformed timezone name', () => {
    for (const timezone of [
      '',
      '/UTC',
      'America/',
      'America//New_York',
      'America/Argentina/Buenos_Aires/Extra',
      '1UTC',
      '../etc/passwd',
      'America/..',
      'America/.',
      'America/New York',
      'America\\New_York',
      'America/New_York ',
      'A'.repeat(65),
    ])
      expect(scheduleAccepts({ timezone }), JSON.stringify(timezone)).toBe(
        false,
      );
  });

  it('accepts a real local datetime with or without seconds and a fraction', () => {
    for (const localDateTime of [
      '2026-11-01T09:30',
      '2026-11-01T09:30:00',
      '2026-11-01T09:30:59.123456789',
      '2026-11-01T00:00:00',
      '2026-11-01T23:59:59',
      '2028-02-29T12:00:00',
      '0001-01-01T00:00',
      '9999-12-31T23:59:59',
    ])
      expect(scheduleAccepts({ localDateTime }), localDateTime).toBe(true);
  });

  it('refuses an out-of-range or impossible local datetime', () => {
    for (const localDateTime of [
      '2026-13-45T25:99',
      '2026-13-01T09:30',
      '2026-00-10T09:30',
      '2026-11-00T09:30',
      '2026-11-31T09:30',
      '2026-02-29T09:30',
      '2026-02-30T09:30',
      '2026-11-01T24:00',
      '2026-11-01T09:60',
      '2026-11-01T09:30:60',
      '0000-01-01T00:00',
      '2026-11-01T09:30:00.1234567890',
      '2026-11-01 09:30',
      '2026-11-01T9:30',
      '2026-11-01',
    ])
      expect(scheduleAccepts({ localDateTime }), localDateTime).toBe(false);
  });
});

describe('[P2-S10-AC-044] CMS-03B-07 resolvedUtc/tzdbVersion/disambiguation', () => {
  it('accepts an offset ISO instant with a bounded tzdb version', () => {
    expect(
      PublicationScheduleRequestSchema.safeParse(validSchedule).success,
    ).toBe(true);
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        tzdbVersion: '2025b-custom.1',
      }).success,
    ).toBe(true);
  });

  it('rejects a resolvedUtc without an explicit offset and an over-long tzdbVersion', () => {
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        resolvedUtc: '2026-11-01T13:30:00',
      }).success,
    ).toBe(false);
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        tzdbVersion: 'x'.repeat(33),
      }).success,
    ).toBe(false);
  });

  it('locks disambiguation to none, earlier, or later', () => {
    for (const disambiguation of ['none', 'earlier', 'later']) {
      expect(
        PublicationScheduleRequestSchema.safeParse({
          ...validSchedule,
          disambiguation,
        }).success,
      ).toBe(true);
    }
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        disambiguation: 'ambiguous',
      }).success,
    ).toBe(false);
  });

  it('keeps the canonical fixture honest: resolvedUtc is the zone-correct instant of localDateTime', () => {
    // 2026-11-01 09:30 in America/New_York is after the 02:00 DST end: EST,
    // UTC-5, so 14:30Z (not 13:30Z). The contract cannot compute this; the
    // fixture and this guard make sure the canonical example is simply right.
    const zoneOffsetMs = (instant: number, zone: string): number => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(new Date(instant));
      const get = (type: string): number =>
        Number(parts.find((part) => part.type === type)?.value);
      return (
        Date.UTC(
          get('year'),
          get('month') - 1,
          get('day'),
          get('hour'),
          get('minute'),
          get('second'),
        ) - instant
      );
    };
    const localAsUtc = Date.UTC(2026, 10, 1, 9, 30, 0);
    let instant = localAsUtc - zoneOffsetMs(localAsUtc, validSchedule.timezone);
    instant = localAsUtc - zoneOffsetMs(instant, validSchedule.timezone);
    expect(new Date(instant).toISOString()).toBe('2026-11-01T14:30:00.000Z');
    expect(Date.parse(validSchedule.resolvedUtc)).toBe(instant);
  });

  it('names the schedule checks that are Slice 11 runtime, not contract rules', () => {
    expect(CMS_PUBLICATION_SCHEDULE_SEAMS).toEqual([
      'timezone_is_member_of_pinned_tzdb',
      'nonexistent_local_time_rejected',
      'resolved_utc_equals_local_time_timezone_and_disambiguation',
    ]);
    // The shape contract admits a spring-forward gap time (02:30 does not exist
    // on 2026-03-08 in New York): rejecting it needs the tzdb, which is runtime.
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        localDateTime: '2026-03-08T02:30:00',
        resolvedUtc: '2026-03-08T07:30:00Z',
      }).success,
    ).toBe(true);
  });
});

describe('[P2-S10-AC-045] CMS-03B-07 action', () => {
  it('accepts exactly publish, unpublish, expire, and archive', () => {
    for (const action of ['publish', 'unpublish', 'expire', 'archive']) {
      expect(
        PublicationScheduleRequestSchema.safeParse({ ...validSchedule, action })
          .success,
      ).toBe(true);
    }
    expect(
      PublicationScheduleRequestSchema.safeParse({
        ...validSchedule,
        action: 'preview',
      }).success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-046] CMS-03B-08 versionSet', () => {
  it('accepts the canonical strict version set', () => {
    expect(VersionSetSchema.safeParse(validVersionSet).success).toBe(true);
    expect(PreviewRequestSchema.safeParse(validPreview).success).toBe(true);
  });

  it('rejects unknown keys and mismatched artifact/compiler couplings', () => {
    expect(
      VersionSetSchema.safeParse({ ...validVersionSet, extra: 1 }).success,
    ).toBe(false);
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        schemaArtifact: { ...validSchemaArtifact, contentTypeVersionId: uuid3 },
      }).success,
    ).toBe(false);
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        schemaArtifact: { ...validSchemaArtifact, compilerVersion: '9.9.9' },
      }).success,
    ).toBe(false);
  });

  it('bounds taxonomy, block, and pattern arrays', () => {
    const id = (n: number) => uuid.slice(0, -3) + String(n).padStart(3, '0');
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        taxonomyVersionIds: Array.from({ length: 65 }, (_, n) => id(n)),
      }).success,
    ).toBe(false);
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        blockVersionIds: Array.from({ length: 129 }, (_, n) => id(n)),
      }).success,
    ).toBe(false);
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        patternVersionIds: Array.from({ length: 129 }, (_, n) => id(n)),
      }).success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-046] CMS-03B-08 versionSet identities', () => {
  const refuses = (label: string, patch: Record<string, unknown>) =>
    it(label, () => {
      expect(
        VersionSetSchema.safeParse({ ...validVersionSet, ...patch }).success,
      ).toBe(false);
    });

  it('accepts only the registered protected validator ref', () => {
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        validatorRefs: [{ key: 'rich_text.v1', version: '1' }],
      }).success,
    ).toBe(true);
    expect(
      VersionSetSchema.safeParse({ ...validVersionSet, validatorRefs: [] })
        .success,
    ).toBe(true);
  });

  refuses('refuses an unregistered validator key', {
    validatorRefs: [{ key: 'pii.safety', version: '1' }],
  });
  refuses('refuses an unregistered validator version', {
    validatorRefs: [{ key: 'rich_text.v1', version: '2' }],
  });
  refuses('refuses a validator named twice', {
    validatorRefs: [
      { key: 'rich_text.v1', version: '1' },
      { key: 'rich_text.v1', version: '1' },
    ],
  });
  refuses('refuses a taxonomy version named twice', {
    taxonomyVersionIds: [uuid3, uuid3],
  });
  refuses('refuses a block version named twice', {
    blockVersionIds: [uuid3, uuid3],
  });
  refuses('refuses a pattern version named twice', {
    patternVersionIds: [uuid3, uuid3],
  });
  refuses('refuses a malformed id inside the id arrays', {
    blockVersionIds: ['not-a-uuid'],
  });
  refuses('refuses a non-version settingsVersion', { settingsVersion: '0' });
  refuses('refuses a non-hash schemaHash', { schemaHash: 'A'.repeat(64) });
  refuses('refuses a non-hash templateHash', { templateHash: 'g'.repeat(64) });
  refuses('refuses an unknown key inside the schema artifact', {
    schemaArtifact: { ...validSchemaArtifact, extra: 1 },
  });
  refuses('refuses an unknown key inside the workflow policy evidence', {
    workflowPolicy: { ...validVersionSet.workflowPolicy, extra: 1 },
  });
});

describe('[P2-S10-AC-046] CMS-03B-08 versionSet template coupling', () => {
  it('requires the template id and hash to be both present or both absent', () => {
    expect(
      VersionSetSchema.safeParse({ ...validVersionSet, templateHash: null })
        .success,
    ).toBe(false);
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        templateVersionId: null,
      }).success,
    ).toBe(false);
    expect(
      VersionSetSchema.safeParse({
        ...validVersionSet,
        templateVersionId: null,
        templateHash: null,
      }).success,
    ).toBe(true);
  });
});

describe('[P2-S10-AC-047] CMS-03B-08 audience/route', () => {
  it('rejects a route carrying a control character', () => {
    for (const control of ['\u0000', '\u0007', '\n', '\u001f'])
      expect(
        PreviewRequestSchema.safeParse({
          ...validPreview,
          route: `/music/artist${control}spring`,
        }).success,
      ).toBe(false);
  });

  it('accepts a safe audience at the 48-character DEC-145 bound and a normalized leading-slash route', () => {
    expect(
      PreviewRequestSchema.safeParse({
        ...validPreview,
        audience: 'x'.repeat(48),
        route: '/' + 'a'.repeat(2047),
      }).success,
    ).toBe(true);
  });

  it('rejects an empty or oversized audience', () => {
    expect(
      PreviewRequestSchema.safeParse({ ...validPreview, audience: '' }).success,
    ).toBe(false);
    expect(
      PreviewRequestSchema.safeParse({
        ...validPreview,
        audience: 'x'.repeat(49),
      }).success,
    ).toBe(false);
  });

  it('rejects a backslash route that browser normalization would treat as cross-origin', () => {
    expect(
      PreviewRequestSchema.safeParse({
        ...validPreview,
        route: '/\\evil.example/music/artist',
      }).success,
    ).toBe(false);
  });

  it('rejects an oversized route and an external URL route', () => {
    expect(
      PreviewRequestSchema.safeParse({
        ...validPreview,
        route: '/' + 'a'.repeat(2048),
      }).success,
    ).toBe(false);
    expect(
      PreviewRequestSchema.safeParse({
        ...validPreview,
        route: 'https://evil.example/music/artist',
      }).success,
    ).toBe(false);
  });

  const audienceAccepted = (audience: string): boolean =>
    PreviewRequestSchema.safeParse({ ...validPreview, audience }).success;

  it('accepts exactly the shared audience grammar ^[a-z0-9_-]{1,48}$', () => {
    for (const audience of ['members', 'a', 'x'.repeat(48), 'a_b-c9', '9'])
      expect(audienceAccepted(audience), audience).toBe(true);
  });

  it('refuses an audience with unsafe characters or outside 1-48', () => {
    for (const audience of [
      '',
      'x'.repeat(49),
      '<script>',
      'two words',
      ' members',
      'members ',
      'Members',
      'a/b',
      'a.b',
      'a\u0000b',
      'a\nb',
      'mémbers',
    ])
      expect(audienceAccepted(audience), JSON.stringify(audience)).toBe(false);
  });

  const routeAccepted = (route: string): boolean =>
    PreviewRequestSchema.safeParse({ ...validPreview, route }).success;

  it('accepts normalized site paths', () => {
    for (const route of [
      '/',
      '/music',
      '/music/',
      '/music/artist/spring-2026-tour',
      '/a.b/c..d',
      '/.well-known/x',
      '/%E2%9C%93',
      '/é',
      '/' + '\u{1F600}'.repeat(2047),
    ])
      expect(routeAccepted(route), route).toBe(true);
  });

  it('refuses a protocol-relative route: //host is an external URL', () => {
    for (const route of ['//evil.example/x', '//evil.example', '//', '///x'])
      expect(routeAccepted(route), route).toBe(false);
  });

  it('refuses a route that is not a normalized path', () => {
    for (const route of [
      '/a/../b',
      '/./x',
      '/a/.',
      '/a/..',
      '/..',
      '/a//b',
      '/a/%2e%2e/b',
      '/a/%2E%2e/b',
      '/a%2fb',
      '/a%5Cb',
      '/a?b=1',
      '/a#frag',
      'a/b',
      '',
      'javascript:alert(1)',
      '/a\u007Fb',
      '/a\u0085b',
      '/a\\b',
    ])
      expect(routeAccepted(route), JSON.stringify(route)).toBe(false);
  });

  it('counts the 2048-character route bound in Unicode characters', () => {
    expect(routeAccepted('/' + '\u{1F600}'.repeat(2047))).toBe(true);
    expect(routeAccepted('/' + '\u{1F600}'.repeat(2048))).toBe(false);
  });
});

describe('[P2-S10-AC-048] CMS-03B-09 frozenHash/expectedVersionSet', () => {
  it('accepts the canonical publication request with hash plus exact version set', () => {
    expect(PublicationRequestSchema.safeParse(validPublication).success).toBe(
      true,
    );
  });

  it('rejects a non-canonical frozenHash and an invalid version set', () => {
    expect(
      PublicationRequestSchema.safeParse({
        ...validPublication,
        frozenHash: 'a'.repeat(63),
      }).success,
    ).toBe(false);
    expect(
      PublicationRequestSchema.safeParse({
        ...validPublication,
        expectedVersionSet: { ...validVersionSet, settingsVersion: '0' },
      }).success,
    ).toBe(false);
  });
});

describe('CMS-03B-05/06/07/08/09 path and header transports', () => {
  it('binds the schedule headers without a route-level audience key', () => {
    expect(CmsPublicationSchedulePathParamsSchema.safeParse({}).success).toBe(
      true,
    );
    expect(
      CmsPublicationScheduleHeadersSchema.safeParse({
        contentType: 'application/json',
        idempotencyKey: 'S10-SCHED-12345',
        ifMatch: '"3"',
      }).success,
    ).toBe(true);
  });

  it('binds preview and publication headers as key-plus-If-Match JSON commands', () => {
    for (const headersSchema of [
      CmsPreviewRequestHeadersSchema,
      CmsPublicationRequestHeadersSchema,
    ]) {
      expect(
        headersSchema.safeParse({
          contentType: 'application/json',
          idempotencyKey: 'S10-PUBLISH-123',
          ifMatch: '"3"',
        }).success,
      ).toBe(true);
    }
  });
});

describe('[P2-S10-AC-038/AC-048] runtime hash seams are named, not trusted', () => {
  it('names the approved-candidate comparison the CMS-03B-09 runtime must perform', () => {
    expect(CMS_PUBLICATION_SEAMS).toEqual([
      'frozen_hash_equals_normalized_revision_hash',
      'expected_version_set_equals_approved_candidate',
      'publication_cas_and_unique_constraint',
    ]);
  });
});
