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

const slice10Operations = {
  'CMS-03B-01': ['POST', '/api/v1/cms/entries/{entryId}/revisions'],
  'CMS-03B-02': [
    'POST',
    '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
  ],
  'CMS-03B-03': ['GET', '/api/v1/cms/entries/{entryId}/revisions'],
  'CMS-03B-04': [
    'POST',
    '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
  ],
  'CMS-03B-10': ['POST', '/api/v1/cms/entries'],
  'CMS-03B-11': ['GET', '/api/v1/cms/entries/{entryId}'],
  'CMS-03B-12': ['GET', '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}'],
  'CMS-03B-13': ['GET', '/api/v1/cms/entries'],
  'CMS-03B-14': ['GET', '/api/v1/cms/entries/authoring-context'],
} as const;

// Slice 11 (DEC-149, BE03b CMS-03B-05..09 and CMS-03B-15..18): the explicit allow-list of the operations Slice 11 registers.
const slice11Operations = {
  'CMS-03B-05': ['POST', '/api/v1/cms/entries/{entryId}/reviews'],
  'CMS-03B-06': ['POST', '/api/v1/cms/reviews/{reviewId}/decision'],
  'CMS-03B-07': ['POST', '/api/v1/cms/publication-schedules'],
  'CMS-03B-08': ['POST', '/api/v1/cms/previews'],
  'CMS-03B-09': ['POST', '/api/v1/cms/publications'],
  'CMS-03B-15': ['GET', '/api/v1/cms/entries/{entryId}/workflow'],
  'CMS-03B-16': ['GET', '/api/v1/cms/reviews/{reviewId}'],
  'CMS-03B-17': ['GET', '/api/v1/cms/reviews'],
  'CMS-03B-18': ['POST', '/api/v1/cms/reviews/{reviewId}/assignments'],
} as const;

const methodAndPath = (operation: string): readonly string[] | undefined => {
  const route = cmsEditorialRoutePolicies.find(
    (candidate) => candidate.operationId === operation,
  );
  return route === undefined ? undefined : [route.method, route.path];
};

describe('EB publication scope: the Slice 10 operations plus the explicit Slice 11 allow-list are the only registered editorial operations, Worker RPC bindings and routes', () => {
  for (const [operation, route] of Object.entries(slice11Operations))
    it(`EB publication scope ${operation}: it is a registered route operation and a Worker RPC binding on its named method and path`, () => {
      expect(methodAndPath(operation)).toEqual(route);
      expect(Object.keys(CMS_EDITORIAL_RPC)).toContain(operation);
    });
  for (const operation of ['CMS-03B-19', 'CMS-03B-20'])
    it(`EB publication scope ${operation}: it is neither a registered route operation nor a Worker RPC binding`, () => {
      expect(
        cmsEditorialRoutePolicies.map((route) => route.operationId),
      ).not.toContain(operation);
      expect(Object.keys(CMS_EDITORIAL_RPC)).not.toContain(operation);
    });
  it('EB publication scope: the nine Slice 10 operations stay registered Worker RPC bindings on their locked method and path', () => {
    for (const [operation, route] of Object.entries(slice10Operations)) {
      expect(methodAndPath(operation)).toEqual(route);
      expect(Object.keys(CMS_EDITORIAL_RPC)).toContain(operation);
    }
  });
  it('EB publication scope: the registered editorial operations are exactly the nine of Slice 10 plus the nine named Slice 11 operations', () => {
    const allowed = [
      ...Object.keys(slice10Operations),
      ...Object.keys(slice11Operations),
    ].sort();
    expect(allowed).toHaveLength(18);
    expect(
      cmsEditorialRoutePolicies.map((route) => route.operationId).sort(),
    ).toEqual(allowed);
    expect(Object.keys(CMS_EDITORIAL_RPC).sort()).toEqual(allowed);
  });
  it('EB publication scope: the route paths that mint, open or revoke a preview token, schedule, review or publish are exactly the named Slice 11 paths', () => {
    const paths = cmsEditorialRoutePolicies.map((route) => route.path);
    const reviewLike = /preview|publication|schedule|review|decision/u;
    expect(paths.filter((path) => reviewLike.test(path)).sort()).toEqual(
      Object.values(slice11Operations)
        .map(([, path]) => path)
        .filter((path) => reviewLike.test(path))
        .sort(),
    );
  });
});
