/**
 * Slice 11 real composition, the service-role preview takedown (BE03b "Preview token and verification":
 * a token is revoked "by the service-role takedown RPC"; DEC-156; tracker P2-S11-AC-118). Through the
 * production Worker takedown adapter, Kong, PostgREST and the newest SQL: tokens minted by the real
 * CMS-03B-08 route are verified, taken down over the Worker service credential, and then reported revoked
 * by the real CMS-03B-19 verifier; anon, authenticated and a missing key cannot execute the RPC; a
 * reason other than `takedown` is refused with nothing revoked.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createPreviewTakedown,
  PreviewTakedownError,
} from '../../apps/worker/src/cms-editorial-production-preview-takedown';
import {
  expectSafeEqual,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { approvedDraft } from './support/phase-02-slice-11-flow';
import {
  createRealVerifier,
  entryVersion,
  expectDeniedPreview,
  parsePreview,
  previewBody,
  previewHash,
  strictVerification,
  verificationBinding,
} from './support/phase-02-slice-11-preview-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import {
  API_URL,
  callRpc,
  psql,
  tokenFor,
  userToken,
  workerServiceCredential,
} from './support/stack';

let world: S11World;
let stack: S11Stack;
const takedown = createPreviewTakedown({
  environment: {
    SUPABASE_URL: API_URL,
    SUPABASE_SECRET_KEY: workerServiceCredential(),
  },
});
const verify = createRealVerifier();

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

/** A fresh approved draft and a preview token minted for it by `actor`, with its verifier binding. */
const mint = async (label: string, actor: S11World['owner'] = world.owner) => {
  const draft = await approvedDraft(stack, world, label);
  stack.as(actor);
  const preview = parsePreview(
    await stack.post('/api/v1/cms/previews', {
      body: previewBody(draft),
      ifMatch: entryVersion(draft),
    }),
  );
  return { draft, preview, binding: verificationBinding(preview, actor) };
};
const tokenRow = (token: string): string =>
  psql(`select state || '/' || version || '/' || (revoked_at is not null)::text
    from platform_private.cms_preview_tokens where token_hash = '${previewHash(token)}'`);
const rpc = (token: string | null, request: unknown) =>
  callRpc('cms_takedown_preview_tokens', token, { p_request: request });

describe('the service-role takedown over actual PostgREST', () => {
  it('[P2-S11-AC-118] revokes the minted token by CAS and the verifier then reports it revoked for its owner, idempotently', async () => {
    const { draft, preview, binding } = await mint('Takedown by entry');
    expectSafeEqual(
      strictVerification(await verify(binding)).valid,
      true,
      'the minted token verifies before the takedown',
    );
    expectSafeEqual(tokenRow(preview.token), 'active/1/false', 'live row');
    const result = await takedown({
      correlationId: randomUUID(),
      entryId: draft.entryId,
    });
    expectSafeEqual(result, { revokedTokens: 1 }, 'one token revoked');
    expectSafeEqual(
      tokenRow(preview.token),
      'revoked/2/true',
      'CAS revocation: state revoked, revoked_at set, version + 1',
    );
    expectDeniedPreview(await verify(binding), true);
    const before = snapshotDigest();
    expectSafeEqual(
      await takedown({ correlationId: randomUUID(), entryId: draft.entryId }),
      { revokedTokens: 0 },
      'a repeat finds nothing to revoke',
    );
    expectSafeEqual(
      tokenRow(preview.token),
      'revoked/2/true',
      'no second version bump',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'the idempotent repeat writes nothing',
    );
  });

  it('[P2-S11-AC-118] revokes only the named minter across entries, and an entry takedown then revokes the rest', async () => {
    const first = await mint('Takedown by person A', world.publisher2);
    const second = await mint('Takedown by person B', world.publisher2);
    // Another minter's token on the first entry: the owner (an assignee) mints it.
    stack.as(world.owner);
    const others = parsePreview(
      await stack.post('/api/v1/cms/previews', {
        body: previewBody(first.draft),
        ifMatch: entryVersion(first.draft),
      }),
    );
    const byPerson = await takedown({
      correlationId: randomUUID(),
      personId: world.publisher2.personId,
    });
    expect(byPerson.revokedTokens).toBeGreaterThanOrEqual(2);
    expectSafeEqual(
      [tokenRow(first.preview.token), tokenRow(second.preview.token)],
      ['revoked/2/true', 'revoked/2/true'],
      "the minter's tokens on both entries are revoked",
    );
    expectSafeEqual(
      tokenRow(others.token),
      'active/1/false',
      "another minter's token on the same entry is untouched by a person takedown",
    );
    expectSafeEqual(
      await takedown({
        correlationId: randomUUID(),
        entryId: first.draft.entryId,
      }),
      { revokedTokens: 1 },
      'the entry takedown revokes the remaining token of that entry',
    );
    expectSafeEqual(tokenRow(others.token), 'revoked/2/true', 'revoked');
  });
});

describe('the RPC itself', () => {
  it.each(['authenticated', 'anon', 'missing'] as const)(
    '[P2-S11-AC-118] %s cannot execute the takedown',
    async (role) => {
      const token =
        role === 'authenticated'
          ? userToken(world.owner.authUserId)
          : role === 'anon'
            ? tokenFor('anon')
            : null;
      const before = snapshotDigest();
      const response = await rpc(token, {
        reasonCode: 'takedown',
        correlationId: randomUUID(),
        entryId: randomUUID(),
      });
      expectSafeEqual(
        [response.status, response.code],
        [role === 'authenticated' ? 403 : 401, '42501'],
        'refused at the function ACL',
      );
      expectUnchanged(
        before,
        snapshotDigest(),
        'a refused call writes nothing',
      );
    },
  );

  it.each([
    ['authority_lost', { entryId: randomUUID() }],
    ['entry_unavailable', { entryId: randomUUID() }],
    ['other', { entryId: randomUUID() }],
  ])(
    '[P2-S11-AC-118] the reason %s is not a takedown: INVALID_REQUEST, nothing revoked',
    async (reasonCode, target) => {
      const before = snapshotDigest();
      const response = await rpc(tokenFor('service_role'), {
        reasonCode,
        correlationId: randomUUID(),
        ...target,
      });
      expectSafeEqual(
        [response.status, response.code, response.message],
        [400, 'P0001', 'INVALID_REQUEST'],
        'typed reason refusal',
      );
      expectUnchanged(
        before,
        snapshotDigest(),
        'a refused call writes nothing',
      );
    },
  );

  it('[P2-S11-AC-118] a request with no target or with an extra member is INVALID_REQUEST', async () => {
    for (const request of [
      { reasonCode: 'takedown', correlationId: randomUUID() },
      {
        reasonCode: 'takedown',
        correlationId: randomUUID(),
        entryId: randomUUID(),
        tokenHash: 'a'.repeat(64),
      },
      {
        reasonCode: 'takedown',
        correlationId: randomUUID(),
        entryId: 'not-a-uuid',
      },
    ]) {
      const response = await rpc(tokenFor('service_role'), request);
      expectSafeEqual(
        [response.status, response.code, response.message],
        [400, 'P0001', 'INVALID_REQUEST'],
        'closed request',
      );
    }
  });

  it('[P2-S11-AC-118] the adapter refuses a malformed takedown before any transport call', async () => {
    const error = await takedown({ correlationId: randomUUID() }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PreviewTakedownError);
    expect((error as PreviewTakedownError).code).toBe('invalid_request');
  });
});
