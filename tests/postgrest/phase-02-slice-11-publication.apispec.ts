/**
 * Slice 11 real composition, publication (lane S11-4R): CMS-03B-08 (preview mint +
 * the CMS-03B-19 verifier adapter) and CMS-03B-09 (publish) through the production
 * Worker routes, adapters, Kong, PostgREST and the newest SQL.
 *
 * Proves what the transport fakes cannot: the wire members the adapter sends are the
 * ones the SQL reads, a 401 step-up refusal reserves nothing, every typed refusal and
 * its structured DETAIL survive the PostgREST boundary, the committed refusal of a
 * stale frozen manifest (DEC-159(2)) is HTTP 200 on the wire and 409 for the browser
 * and keeps the review invalidation, and the 503 preflight answer carries Retry-After.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  PreviewTokenResourceSchema,
  PublicationResourceSchema,
} from '@wejammin/contracts';

import { createPreviewTokenVerifier } from '../../apps/worker/src/cms-editorial-production-preview-verifier';
import {
  type ReviewedDraft,
  approvedDraft,
} from './support/phase-02-slice-11-flow';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  reservationCount,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { API_URL, psql, workerServiceCredential } from './support/stack';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

const publishBody = (
  draft: ReviewedDraft,
  over: Record<string, unknown> = {},
) => ({
  entryId: draft.entryId,
  revisionId: draft.revisionId,
  frozenHash: draft.frozenHash,
  expectedVersionSet: draft.versionSet,
  audience: 'public',
  expectedVersion: draft.reviewVersion,
  ...over,
});

const publish = (
  draft: ReviewedDraft,
  options: {
    body?: Record<string, unknown>;
    ifMatch?: string;
    key?: string;
  } = {},
) =>
  stack.post('/api/v1/cms/publications', {
    body: publishBody(draft, options.body),
    ifMatch: options.ifMatch ?? draft.reviewVersion,
    ...(options.key === undefined ? {} : { idempotencyKey: options.key }),
  });

describe('CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack', () => {
  let draft: ReviewedDraft;
  let entryVersion: string;
  const previewBody = (over: Record<string, unknown> = {}) => ({
    entryId: draft.entryId,
    revisionId: draft.revisionId,
    locale: 'en-US',
    audience: 'public',
    route: '/preview/article',
    versionSet: draft.versionSet,
    ...over,
  });

  beforeAll(async () => {
    draft = await approvedDraft(stack, world, 'Preview subject');
    entryVersion = psql(
      `select version from platform_private.cms_content_entries where id = '${draft.entryId}'`,
    );
  });

  it('[CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding', async () => {
    stack.as(world.owner);
    const key = `preview-${draft.entryId}`;
    stack.clearRpcs();
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      idempotencyKey: key,
      ifMatch: entryVersion,
    });
    expect(response.status, response.text).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    const preview = PreviewTokenResourceSchema.parse(response.body);
    expect(preview.revoked).toBe(false);
    const sent = stack.rpcs().find((rpc) => rpc.rpc === 'cms_mint_preview');
    expect(sent?.request.ifMatch).toBe(entryVersion);
    expect(sent?.request.expectedVersion).toBe(entryVersion);

    stack.clearRpcs();
    const replay = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      idempotencyKey: key,
      ifMatch: entryVersion,
    });
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body).toEqual(response.body);
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_mint_preview')?.replayHeader,
    ).toBe('true');

    const verify = createPreviewTokenVerifier({
      environment: {
        SUPABASE_URL: API_URL,
        SUPABASE_SECRET_KEY: workerServiceCredential(),
      },
    });
    const contextVersion = psql(
      `select platform_private.cms_acting_context_version('${world.owner.personId}', '${world.organizationId}')`,
    );
    const binding = {
      token: preview.token,
      actorPersonId: world.owner.personId,
      actingContextVersion: contextVersion,
      route: '/preview/article',
      locale: 'en-US',
      audience: 'public',
    };
    const valid = await verify(binding);
    expect(valid).toMatchObject({
      valid: true,
      entryId: draft.entryId,
      revisionId: draft.revisionId,
      revoked: false,
    });
    const wrongRoute = await verify({ ...binding, route: '/preview/other' });
    const unknown = await verify({ ...binding, token: 'A'.repeat(43) });
    expect(wrongRoute).toEqual(unknown);
    expect(wrongRoute).toMatchObject({ valid: false });
  });

  it('[CMS-03B-08] a stale version set is 409 version_set_stale and a stale entry version is 409 VERSION_MISMATCH with the safe versions', async () => {
    stack.as(world.owner);
    const stale = await stack.post('/api/v1/cms/previews', {
      body: previewBody({
        versionSet: { ...draft.versionSet, settingsVersion: '99999' },
      }),
      ifMatch: entryVersion,
    });
    expect(stale.status, stale.text).toBe(409);
    expect(stale.body.details).toMatchObject({
      reasonCode: 'version_set_stale',
    });

    const mismatch = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      ifMatch: String(Number(entryVersion) + 7),
    });
    expect(mismatch.status, mismatch.text).toBe(409);
    expect(mismatch.body.details).toMatchObject({
      expectedVersion: String(Number(entryVersion) + 7),
      currentVersion: entryVersion,
    });
  });

  it('[CMS-03B-08] an unscoped confirmed member is refused by the database, not by the Worker', async () => {
    // The Worker gate admits any editorial capability; the member holds none in the database.
    stack.as({ ...world.outsider, capabilities: ['cms.author'] });
    stack.clearRpcs();
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      ifMatch: entryVersion,
    });
    expect([403, 404]).toContain(response.status);
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toContain('cms_mint_preview');
    expect(response.text).not.toContain(draft.entryId);
  });
});

describe('CMS-03B-09 publish through the real stack', () => {
  it('[CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing', async () => {
    const draft = await approvedDraft(stack, world, 'Publish subject');
    stack.as(world.publisher, 'fresh');
    const key = `publish-${draft.entryId}`;
    const before = reservationCount();
    stack.clearRpcs();
    const response = await publish(draft, { key });
    expect(response.status, response.text).toBe(202);
    const publication = PublicationResourceSchema.parse(response.body);
    expect(publication.state).toBe('active');
    expect(publication.version).toBe(1);
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/publications/${publication.id}`,
    );
    expect(response.headers.get('etag')).toBe(`"${publication.version}"`);
    expect(reservationCount()).toBe(before + 1);
    expect(workflowEffects(draft.entryId).publications).toBe(1);
    const sent = stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision');
    expect(sent?.request.evidence).not.toBeNull();
    expect(sent?.request.expectedVersionSet).toEqual(draft.versionSet);
    expect(sent?.request.expectedVersion).toBe(draft.reviewVersion);

    stack.clearRpcs();
    const replay = await publish(draft, { key });
    expect(replay.status, replay.text).toBe(202);
    expect(replay.body).toEqual(response.body);
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision')
        ?.replayHeader,
    ).toBe('true');
    expect(workflowEffects(draft.entryId).publications).toBe(1);
    expect(reservationCount()).toBe(before + 1);
  });

  it('[CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation', async () => {
    const draft = await approvedDraft(stack, world, 'Step-up subject');
    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.publisher, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const response = await publish(draft);
      expect(response.status, `${proof}: ${response.text}`).toBe(401);
      expect(response.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }
    expect(workflowEffects(draft.entryId).publications).toBe(0);
  });

  it('[CMS-03B-09] a session without cms.publisher is 403 at the Worker; a session claiming it without the database grant is capability_missing from the database', async () => {
    const draft = await approvedDraft(stack, world, 'Capability subject');
    stack.as(world.owner, 'fresh');
    stack.clearRpcs();
    const gated = await publish(draft);
    expect(gated.status, gated.text).toBe(403);
    expect(stack.rpcs()).toEqual([]);

    stack.as({ ...world.reviewer, capabilities: ['cms.publisher'] }, 'fresh');
    stack.clearRpcs();
    const claimed = await publish(draft);
    expect(claimed.status, claimed.text).toBe(403);
    expect(claimed.body.details).toMatchObject({
      reasonCode: 'capability_missing',
    });
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toContain(
      'cms_publish_revision',
    );
    expect(workflowEffects(draft.entryId).publications).toBe(0);
  });

  it('[CMS-03B-09] the counted approver may not publish: 403 separation_of_duties', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Separation subject',
      world.dual,
    );
    stack.as(world.dual, 'fresh');
    const response = await publish(draft);
    expect(response.status, response.text).toBe(403);
    expect(response.body.details).toMatchObject({
      reasonCode: 'separation_of_duties',
    });
    expect(workflowEffects(draft.entryId).publications).toBe(0);
  });

  it('[CMS-03B-09] a stale review version is 409 VERSION_MISMATCH with the safe expected and current versions', async () => {
    const draft = await approvedDraft(stack, world, 'Version subject');
    stack.as(world.publisher, 'fresh');
    const stale = String(Number(draft.reviewVersion) + 4);
    const response = await publish(draft, {
      ifMatch: stale,
      body: { expectedVersion: stale },
    });
    expect(response.status, response.text).toBe(409);
    expect(response.body.details).toMatchObject({
      expectedVersion: stale,
      currentVersion: draft.reviewVersion,
    });
  });

  it('[CMS-03B-09] a stale expected version set is 409 version_set_stale and a wrong frozenHash is 422 at /frozenHash', async () => {
    const draft = await approvedDraft(stack, world, 'Set subject');
    stack.as(world.publisher, 'fresh');
    const stale = await publish(draft, {
      body: {
        expectedVersionSet: { ...draft.versionSet, settingsVersion: '424242' },
      },
    });
    expect(stale.status, stale.text).toBe(409);
    expect(stale.body.details).toMatchObject({
      reasonCode: 'version_set_stale',
    });

    const hash = await publish(draft, { body: { frozenHash: 'f'.repeat(64) } });
    expect(hash.status, hash.text).toBe(422);
    expect(hash.body.details).toMatchObject({
      violations: [{ path: '/frozenHash' }],
    });
    expect(workflowEffects(draft.entryId).publications).toBe(0);
  });

  it('[CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409', async () => {
    const draft = await approvedDraft(stack, world, 'Drift subject');
    // Fixture drift (what pgTAP does with its trigger-bypassing raw exec): the frozen manifest no
    // longer equals the rebuilt one while the stored version set still matches the request.
    psql(`
      begin;
      select set_config('app.cms_rpc', 'true', true);
      alter table platform_private.cms_editorial_reviews disable trigger user;
      update platform_private.cms_editorial_reviews
         set dependency_manifest = jsonb_set(dependency_manifest, '{checker,version}', '"2"'),
             dependency_hash = platform_private.cms_jcs_sha256(
               jsonb_set(dependency_manifest, '{checker,version}', '"2"'))
       where id = '${draft.reviewId}';
      alter table platform_private.cms_editorial_reviews enable trigger user;
      commit;`);
    stack.as(world.publisher, 'fresh');
    const key = `drift-${draft.entryId}`;
    stack.clearRpcs();
    const response = await publish(draft, { key });
    expect(response.status, response.text).toBe(409);
    expect(response.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
      dependencyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    const wire = stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision');
    expect(wire?.status).toBe(200);
    expect(wire?.response).toMatchObject({
      kind: 'refusal',
      reasonCode: 'dependency_changed',
    });
    expect(
      psql(
        `select state from platform_private.cms_editorial_reviews where id = '${draft.reviewId}'`,
      ),
    ).toBe('invalidated');
    expect(workflowEffects(draft.entryId).publications).toBe(0);

    const replay = await publish(draft, { key });
    expect(replay.status, replay.text).toBe(409);
    expect(replay.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
    });
  });

  it('[CMS-03B-09] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and nothing is committed', async () => {
    const draft = await approvedDraft(stack, world, 'Proof subject');
    stack.as(world.publisher, 'fresh');
    stack.breakRpc('cms_load_quality_gate_input');
    try {
      const before = workflowEffects(draft.entryId);
      const response = await publish(draft);
      expect(response.status, response.text).toBe(503);
      expect(response.headers.get('retry-after')).toMatch(/^[0-9]+$/u);
      expect(response.body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(response.body.details).toMatchObject({
        dependencyClass: 'preflight',
      });
      expect(workflowEffects(draft.entryId)).toEqual(before);
    } finally {
      stack.breakRpc(null);
    }
  });
});
