/**
 * Slice 11 real composition, CMS-03B-08 preview mint and the CMS-03B-19 verifier
 * (lane S11-4R; split from the inherited combined publication suite, titles and
 * assertions preserved). Through the production Worker routes, adapters, Kong,
 * PostgREST and the newest SQL: a once-only token, no-store/no Location, an exact
 * replay, the bound verifier binding, the stale version-set and stale entry-version
 * refusals and the unscoped-member concealment.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { PreviewTokenResourceSchema } from '@wejammin/contracts';

import { createPreviewTokenVerifier } from '../../apps/worker/src/cms-editorial-production-preview-verifier';
import {
  type ReviewedDraft,
  approvedDraft,
} from './support/phase-02-slice-11-flow';
import {
  expectAbsent,
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
} from './support/phase-02-slice-11-world';
import { API_URL, psql, workerServiceCredential } from './support/stack';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
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
    expectStatus(response, 201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    const preview = PreviewTokenResourceSchema.parse(response.body);
    expect(preview.revoked).toBe(false);
    const sent = stack.rpcs().find((rpc) => rpc.rpc === 'cms_mint_preview');
    expect(sent?.request.ifMatch).toBe(entryVersion);
    expect(sent?.request.expectedVersion).toBe(entryVersion);

    stack.clearRpcs();
    const beforeReplay = snapshotDigest();
    const replay = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      idempotencyKey: key,
      ifMatch: entryVersion,
    });
    expectStatus(replay, 201);
    // Strict parse + whole-resource DIGEST equality (never a raw-body or raw-token
    // comparison, which could print the plaintext token in a failure diff).
    const replayPreview = PreviewTokenResourceSchema.parse(replay.body);
    expect(replayPreview.revoked).toBe(false);
    expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
    // The replay added no durable effect (no second token, reservation or audit row).
    expectUnchanged(
      beforeReplay,
      snapshotDigest(),
      'an exact preview replay adds no effect',
    );
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
    const beforeVerification = snapshotDigest();
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
    expectUnchanged(
      beforeVerification,
      snapshotDigest(),
      'all original verifier reads write nothing',
    );
  });

  it('[CMS-03B-08] a stale version set is 409 version_set_stale and a stale entry version is 409 VERSION_MISMATCH with the safe versions', async () => {
    stack.as(world.owner);
    const before = snapshotDigest();
    const stale = await stack.post('/api/v1/cms/previews', {
      body: previewBody({
        versionSet: { ...draft.versionSet, settingsVersion: '99999' },
      }),
      ifMatch: entryVersion,
    });
    expectSafeError(stale, {
      status: 409,
      code: 'CONFLICT',
      details: { reasonCode: 'version_set_stale' },
    });

    const mismatch = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      ifMatch: String(Number(entryVersion) + 7),
    });
    // BE00: a stale CAS operand is 409 CONFLICT with the closed VERSION_MISMATCH
    // details (conflict, recoveryAction reload, and the safe expected/current versions).
    expectSafeError(mismatch, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: String(Number(entryVersion) + 7),
        currentVersion: entryVersion,
      },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'both preview CAS refusals have no effects',
    );
  });

  it('[CMS-03B-08] an unscoped confirmed member is refused by the database, not by the Worker', async () => {
    // The Worker gate admits any editorial capability; the confirmed member is tenant-visible
    // (so the target is NOT concealed) but holds no preview scope on this entry, so the mint
    // RPC answers the visible-target-without-scope refusal: 403 capability_missing (BE03b:160).
    stack.as({ ...world.outsider, capabilities: ['cms.author'] });
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(),
      ifMatch: entryVersion,
    });
    expectSafeError(response, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toContain('cms_mint_preview');
    expectAbsent(
      response,
      draft.entryId,
      'an unscoped preview refusal never discloses the entry id',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'unscoped preview refusal has no effects',
    );
  });
});
