/**
 * Slice 11 real composition, CMS-03B-09 publish (lane S11-4R; split from the
 * inherited combined publication suite, titles and assertions preserved). Through
 * the production Worker routes, adapters, Kong, PostgREST and the newest SQL: a
 * 202 publish with Location/strong ETag and an exact replay, unconditional step-up,
 * the publisher capability gate, the E11 separation split, the stale-version,
 * stale-version-set and wrong-hash refusals, the COMMITTED dependency_changed
 * refusal (HTTP 200 on the wire) and the 503 outage whose command carries an
 * exactly-null evidence member.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { PublicationResourceSchema } from '@wejammin/contracts';

import {
  type ReviewedDraft,
  approvedDraft,
} from './support/phase-02-slice-11-flow';
import {
  expectEvidenceNull,
  expectEvidencePresent,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  resourceDigest,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
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
import { psql } from './support/stack';

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

describe('CMS-03B-09 publish through the real stack', () => {
  it('[CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing', async () => {
    const draft = await approvedDraft(stack, world, 'Publish subject');
    stack.as(world.publisher, 'fresh');
    const key = `publish-${draft.entryId}`;
    const before = reservationCount();
    stack.clearRpcs();
    const response = await publish(draft, { key });
    expectStatus(response, 202);
    const publication = PublicationResourceSchema.parse(response.body);
    expect(publication.state).toBe('active');
    // The version is a lossless decimal string (CmsVersionSchema / BE00 version
    // grammar); the resource never carries a JSON number.
    expect(publication.version).toBe('1');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/publications/${publication.id}`,
    );
    expect(response.headers.get('etag')).toBe(`"${publication.version}"`);
    expect(reservationCount()).toBe(before + 1);
    expect(workflowEffects(draft.entryId).publications).toBe(1);
    const sent = stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision');
    expect(sent).toBeDefined();
    expectEvidencePresent(sent?.request ?? {});
    expect(sent?.request.expectedVersionSet).toEqual(draft.versionSet);
    expect(sent?.request.expectedVersion).toBe(draft.reviewVersion);

    stack.clearRpcs();
    const beforeReplay = snapshotDigest();
    const replay = await publish(draft, { key });
    expectStatus(replay, 202);
    expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
    expect(
      stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision')
        ?.replayHeader,
    ).toBe('true');
    expect(workflowEffects(draft.entryId).publications).toBe(1);
    expect(reservationCount()).toBe(before + 1);
    expectUnchanged(
      beforeReplay,
      snapshotDigest(),
      'publication replay preserves every effect group',
    );
  });

  it('[CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation', async () => {
    const draft = await approvedDraft(stack, world, 'Step-up subject');
    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.publisher, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const beforeEffects = snapshotDigest();
      const response = await publish(draft);
      expectStatus(response, 401, proof);
      expect(response.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
      expectUnchanged(
        beforeEffects,
        snapshotDigest(),
        'MFA refusal preserves every effect group',
      );
    }
    expect(workflowEffects(draft.entryId).publications).toBe(0);
  });

  it('[CMS-03B-09] a session without cms.publisher is 403 at the Worker; a session claiming it without the database grant is capability_missing from the database', async () => {
    const draft = await approvedDraft(stack, world, 'Capability subject');
    stack.as(world.owner, 'fresh');
    stack.clearRpcs();
    const gated = await publish(draft);
    expectStatus(gated, 403);
    expect(stack.rpcs()).toEqual([]);

    stack.as({ ...world.reviewer, capabilities: ['cms.publisher'] }, 'fresh');
    stack.clearRpcs();
    const claimed = await publish(draft);
    expectStatus(claimed, 403);
    expect(claimed.body.details).toMatchObject({
      reasonCode: 'capability_missing',
    });
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toContain(
      'cms_publish_revision',
    );
    expect(workflowEffects(draft.entryId).publications).toBe(0);
  });

  it('[CMS-03B-09] a counted approver who is not the revision author publishes normally (202 active)', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Counted approver subject',
      world.dual,
    );
    // world.dual is the counted approver (cms.reviewer + cms.publisher) but NOT the
    // revision author (the owner authored the revision): E11 forbids only the AUTHOR
    // from publishing, so this publication succeeds.
    stack.as(world.dual, 'fresh');
    const response = await publish(draft);
    expectStatus(response, 202);
    expect(PublicationResourceSchema.parse(response.body).state).toBe('active');
    expect(workflowEffects(draft.entryId).publications).toBe(1);
  });

  it('[CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects', async () => {
    const draft = await approvedDraft(
      stack,
      world,
      'Author separation subject',
    );
    // The owner authored this revision (seedDraft acts as the owner). Give the owner a
    // real standing cms.publisher grant so the refusal is the E11 separation rule and
    // not a missing capability.
    psql(`
      insert into identity_private.organization_actor_grant(
        organization_id, person_id, capability_code, valid_from, valid_through, active)
      values ('${world.organizationId}', '${world.owner.personId}', 'cms.publisher',
              current_date, null, true)
      on conflict (organization_id, person_id, capability_code)
      do update set active = true, valid_through = null`);
    stack.as(
      {
        ...world.owner,
        capabilities: [...world.owner.capabilities, 'cms.publisher'],
      },
      'fresh',
    );
    const before = snapshotDigest();
    const response = await publish(draft);
    expectSafeError(response, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'separation_of_duties' },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'a separation-of-duties refusal commits no publication, audit or outbox row',
    );
  });

  it('[CMS-03B-09] a stale review version is 409 VERSION_MISMATCH with the safe expected and current versions', async () => {
    const draft = await approvedDraft(stack, world, 'Version subject');
    stack.as(world.publisher, 'fresh');
    const stale = String(Number(draft.reviewVersion) + 4);
    const before = snapshotDigest();
    const response = await publish(draft, {
      ifMatch: stale,
      body: { expectedVersion: stale },
    });
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: stale,
        currentVersion: draft.reviewVersion,
      },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'stale review CAS has no durable effect',
    );
  });

  it('[CMS-03B-09] a stale expected version set is 409 version_set_stale and a wrong frozenHash is 422 at /frozenHash', async () => {
    const draft = await approvedDraft(stack, world, 'Set subject');
    stack.as(world.publisher, 'fresh');
    const before = snapshotDigest();
    const stale = await publish(draft, {
      body: {
        expectedVersionSet: { ...draft.versionSet, settingsVersion: '424242' },
      },
    });
    expectSafeError(stale, {
      status: 409,
      code: 'CONFLICT',
      details: { reasonCode: 'version_set_stale' },
    });

    const hash = await publish(draft, { body: { frozenHash: 'f'.repeat(64) } });
    expectStatus(hash, 422);
    expect(hash.body.details).toMatchObject({
      violations: [{ path: '/frozenHash' }],
    });
    expect(workflowEffects(draft.entryId).publications).toBe(0);
    expectUnchanged(
      before,
      snapshotDigest(),
      'version-set and frozen-hash refusals have no effects',
    );
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
    expectStatus(response, 409);
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

    const beforeReplay = snapshotDigest();
    const replay = await publish(draft, { key });
    expectStatus(replay, 409);
    expect(replay.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
    });
    expectUnchanged(
      beforeReplay,
      snapshotDigest(),
      'committed dependency refusal replay has no additional effects',
    );
  });

  it('[CMS-03B-09] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and nothing is committed', async () => {
    const draft = await approvedDraft(stack, world, 'Proof subject');
    stack.as(world.publisher, 'fresh');
    stack.breakRpc('cms_load_quality_gate_input');
    try {
      const beforeSnapshot = snapshotDigest();
      stack.clearRpcs();
      const response = await publish(draft);
      // Strict safe ApiError: exact status/code/closed details, no-store and MIME
      // boundary, with only booleans/digests in any failure diagnostic.
      expectSafeError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'preflight', retryable: true },
        retryAfter: true,
      });
      // Full 14-group effect snapshot is unchanged (nothing committed).
      expectUnchanged(
        beforeSnapshot,
        snapshotDigest(),
        'the CMS-03B-09 outage commits no durable effect',
      );
      // The genuine publish RPC was issued with its OWN evidence member exactly
      // null (an unavailable checker proof, not an absent member).
      const wire = stack
        .rpcs()
        .find((rpc) => rpc.rpc === 'cms_publish_revision');
      expect(wire).toBeDefined();
      expectEvidenceNull(wire?.request ?? {});
    } finally {
      stack.breakRpc(null);
    }
  });
});
