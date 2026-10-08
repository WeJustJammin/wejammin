import { describe, expect, it } from 'vitest';

import {
  PreviewRequestSchema,
  PublicationRequestSchema,
  PublicationScheduleRequestSchema,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';

import { CMS_EDITORIAL_RPC } from '../../apps/worker/src/cms-editorial-production-types';
import {
  uuid2,
  uuid3,
  validPreview,
  validPublication,
  validSchedule,
  validVersionSet,
} from '../../packages/contracts/src/cms-editorial/publication-contracts.test-support';
import {
  accepted,
  expect422,
  refusal,
} from './support/ev-eb-publication-boundary-support';

describe('EB publication boundary AC-043/AC-044/AC-045: CMS-03B-07 schedule is a 422 at the Worker body boundary', () => {
  it('EB boundary CMS-03B-07: the canonical schedule is admitted', async () => {
    await accepted(PublicationScheduleRequestSchema, validSchedule);
  });
  it('EB boundary CMS-03B-07 localDateTime: a local datetime carrying an offset or Z is 422 at /localDateTime', async () => {
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, localDateTime: '2026-11-01T09:30:00-05:00' },
      '/localDateTime',
    );
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, localDateTime: '2026-11-01T09:30:00Z' },
      '/localDateTime',
    );
  });
  it('EB boundary CMS-03B-07 localDateTime: an impossible calendar day is 422 at /localDateTime', async () => {
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, localDateTime: '2026-02-29T09:30' },
      '/localDateTime',
    );
  });
  it('EB boundary CMS-03B-07 timezone: an empty, an oversized and a malformed timezone are each 422 at /timezone', async () => {
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, timezone: '' },
      '/timezone',
    );
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, timezone: 'A'.repeat(65) },
      '/timezone',
    );
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, timezone: '../etc/passwd' },
      '/timezone',
    );
  });
  it('EB boundary CMS-03B-07 resolvedUtc: an instant without an offset is 422 at /resolvedUtc', async () => {
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, resolvedUtc: '2026-11-01T14:30:00' },
      '/resolvedUtc',
    );
  });
  it('EB boundary CMS-03B-07 tzdbVersion: an empty and a 33-character tzdb version are 422 at /tzdbVersion', async () => {
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, tzdbVersion: '' },
      '/tzdbVersion',
    );
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, tzdbVersion: 'x'.repeat(33) },
      '/tzdbVersion',
    );
  });
  it('EB boundary CMS-03B-07 disambiguation: a value other than none, earlier or later is 422 at /disambiguation', async () => {
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, disambiguation: 'ambiguous' },
      '/disambiguation',
    );
    for (const disambiguation of ['none', 'earlier', 'later'])
      await accepted(PublicationScheduleRequestSchema, {
        ...validSchedule,
        disambiguation,
      });
  });
  it('EB boundary CMS-03B-07 action: publish, unpublish, expire and archive are admitted and any other action is 422 at /action', async () => {
    for (const action of ['publish', 'unpublish', 'expire', 'archive'])
      await accepted(PublicationScheduleRequestSchema, {
        ...validSchedule,
        action,
      });
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, action: 'preview' },
      '/action',
    );
    await expect422(
      PublicationScheduleRequestSchema,
      { ...validSchedule, action: 'PUBLISH' },
      '/action',
    );
  });
});

describe('EB publication boundary AC-046/AC-047/AC-048: CMS-03B-08/09 preview and publication are a 422 at the Worker body boundary', () => {
  it('EB boundary CMS-03B-08: the canonical preview request is admitted', async () => {
    await accepted(PreviewRequestSchema, validPreview);
  });
  it('EB boundary CMS-03B-08 versionSet: an unknown member, a duplicate block id and a non-hash schemaHash are 422 at their pointers', async () => {
    const preview = (versionSet: unknown) => ({ ...validPreview, versionSet });
    await expect422(
      PreviewRequestSchema,
      preview({ ...validVersionSet, extra: 1 }),
      '/versionSet/extra',
      'unknown_field',
    );
    await expect422(
      PreviewRequestSchema,
      preview({ ...validVersionSet, blockVersionIds: [uuid3, uuid3] }),
      '/versionSet/blockVersionIds',
      'version_ids_must_be_unique',
    );
    await expect422(
      PreviewRequestSchema,
      preview({ ...validVersionSet, schemaHash: 'A'.repeat(64) }),
      '/versionSet/schemaHash',
    );
  });
  it('EB boundary CMS-03B-08 versionSet: a template id without its hash is 422 (the all-or-nothing coupling)', async () => {
    const outcome = await refusal(PreviewRequestSchema, {
      ...validPreview,
      versionSet: {
        ...validVersionSet,
        templateVersionId: uuid2,
        templateHash: null,
      },
    });
    expect(outcome?.status).toBe(422);
    expect(
      outcome?.violations.some(
        (violation) =>
          violation.code ===
          'version_set_template_id_and_hash_are_all_or_nothing',
      ),
    ).toBe(true);
  });
  it('EB boundary CMS-03B-08 audience/route: an unsafe audience and an external, protocol-relative or control-character route are 422', async () => {
    await expect422(
      PreviewRequestSchema,
      { ...validPreview, audience: 'Bad Audience' },
      '/audience',
    );
    await expect422(
      PreviewRequestSchema,
      { ...validPreview, route: 'https://evil.example/x' },
      '/route',
    );
    await expect422(
      PreviewRequestSchema,
      { ...validPreview, route: '//evil.example/x' },
      '/route',
    );
    await expect422(
      PreviewRequestSchema,
      { ...validPreview, route: '/a\u0007b' },
      '/route',
    );
    await expect422(
      PreviewRequestSchema,
      { ...validPreview, route: `/${'a'.repeat(2048)}` },
      '/route',
    );
  });
  it('EB boundary CMS-03B-09: the canonical publication request is admitted', async () => {
    await accepted(PublicationRequestSchema, validPublication);
  });
  it('EB boundary CMS-03B-09 frozenHash/expectedVersionSet: a non-canonical hash and an invalid version set are 422 at their pointers', async () => {
    await expect422(
      PublicationRequestSchema,
      { ...validPublication, frozenHash: 'A'.repeat(64) },
      '/frozenHash',
    );
    await expect422(
      PublicationRequestSchema,
      {
        ...validPublication,
        expectedVersionSet: { ...validVersionSet, extra: 1 },
      },
      '/expectedVersionSet/extra',
      'unknown_field',
    );
    await expect422(
      PublicationRequestSchema,
      {
        ...validPublication,
        expectedVersionSet: { ...validVersionSet, settingsVersion: '0' },
      },
      '/expectedVersionSet/settingsVersion',
    );
  });
});

describe('EB publication scope: no Slice 10 operation, Worker RPC binding or route serves CMS-03B-05..09 or the preview-token paths', () => {
  const publicationOperations = [
    'CMS-03B-05',
    'CMS-03B-06',
    'CMS-03B-07',
    'CMS-03B-08',
    'CMS-03B-09',
    'CMS-03B-19',
    'CMS-03B-20',
  ];
  for (const operation of publicationOperations)
    it(`EB publication scope ${operation}: it is neither a registered route operation nor a Worker RPC binding`, () => {
      expect(
        cmsEditorialRoutePolicies.map((route) => route.operationId),
      ).not.toContain(operation);
      expect(Object.keys(CMS_EDITORIAL_RPC)).not.toContain(operation);
    });
  it('EB publication scope: the registered editorial operations are exactly the nine of Slice 10', () => {
    expect(
      cmsEditorialRoutePolicies.map((route) => route.operationId).sort(),
    ).toEqual([
      'CMS-03B-01',
      'CMS-03B-02',
      'CMS-03B-03',
      'CMS-03B-04',
      'CMS-03B-10',
      'CMS-03B-11',
      'CMS-03B-12',
      'CMS-03B-13',
      'CMS-03B-14',
    ]);
  });
  it('EB publication scope: no route path mints, opens or revokes a preview token, schedules, reviews or publishes', () => {
    const paths = cmsEditorialRoutePolicies.map((route) => route.path);
    expect(
      paths.filter((path) =>
        /preview|publication|schedule|review|decision/u.test(path),
      ),
    ).toEqual([]);
  });
});
