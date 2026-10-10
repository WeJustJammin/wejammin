import { beforeAll, describe, expect, it } from 'vitest';
import { PreviewVerificationRequestSchema } from '@wejammin/contracts';

import {
  expectSafeEqual,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  approvedDraft,
  type ReviewedDraft,
} from './support/phase-02-slice-11-flow';
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

let world: S11World;
let stack: S11Stack;
let draft: ReviewedDraft;
let preview: ReturnType<typeof parsePreview>;
let binding: ReturnType<typeof verificationBinding>;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  draft = await approvedDraft(stack, world, 'Verifier exact binding');
  stack.as(world.owner);
  preview = parsePreview(
    await stack.post('/api/v1/cms/previews', {
      body: previewBody(draft),
      ifMatch: entryVersion(draft),
    }),
  );
  binding = verificationBinding(preview, world.owner);
});

describe('CMS-03B-19 production adapter over actual PostgREST', () => {
  it('[CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes', async () => {
    const requests: unknown[] = [];
    const wireResults: unknown[] = [];
    const forward = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const request = JSON.parse(String(init?.body)) as { p_request?: unknown };
      const parsed = PreviewVerificationRequestSchema.safeParse(
        request.p_request,
      );
      if (!parsed.success)
        throw new Error('invalid strict verifier wire request');
      requests.push(parsed.data);
      expect(
        String(init?.body).includes(preview.token),
        'plaintext never reaches RPC',
      ).toBe(false);
      const response = await fetch(input, init);
      expect(response.status).toBe(200);
      wireResults.push(strictVerification(await response.clone().json()));
      return response;
    }) as typeof fetch;
    const verify = createRealVerifier(forward);
    const before = snapshotDigest();
    const result = strictVerification(await verify(binding));
    expectSafeEqual(
      result,
      {
        valid: true,
        userId: world.owner.personId,
        entryId: draft.entryId,
        revisionId: draft.revisionId,
        exactVersionSet: draft.versionSet,
        expiresAt: preview.expiresAt,
        revoked: false,
      },
      'complete valid verifier result',
    );
    expectSafeEqual(
      requests,
      [
        {
          tokenHash: previewHash(preview.token),
          actorPersonId: world.owner.personId,
          actingContextVersion: binding.actingContextVersion,
          route: preview.route,
          locale: preview.locale,
          audience: preview.audience,
        },
      ],
      'one exact hash-only verifier request',
    );
    expectSafeEqual(
      wireResults,
      [result],
      'adapter preserves strict wire result',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'successful verifier writes nothing',
    );
  });

  it.each([
    'unknown hash',
    'forwarded actor',
    'acting context',
    'route',
    'locale',
    'audience',
  ] as const)(
    '[CMS-03B-19] %s has the complete identical null-detail denial and zero writes',
    async (cause) => {
      const changes = {
        'unknown hash': { token: 'A'.repeat(43) },
        'forwarded actor': { actorPersonId: world.reviewer.personId },
        'acting context': { actingContextVersion: '0'.repeat(64) },
        route: { route: '/preview/other' },
        locale: { locale: 'fr-FR' },
        audience: { audience: 'members' },
      };
      let wireCalls = 0;
      const verify = createRealVerifier((async (input, init) => {
        wireCalls += 1;
        const response = await fetch(input, init);
        expect(response.status).toBe(200);
        expectDeniedPreview(await response.clone().json());
        return response;
      }) as typeof fetch);
      const before = snapshotDigest();
      const result = await verify({ ...binding, ...changes[cause] });
      expectDeniedPreview(result);
      expect(wireCalls, 'denial comes from the real database').toBe(1);
      expectUnchanged(
        before,
        snapshotDigest(),
        'denied verifier writes nothing',
      );
    },
  );

  it('[CMS-03B-19] malformed bearer is denied locally without transport or durable effects', async () => {
    let calls = 0;
    const verify = createRealVerifier((async (input, init) => {
      calls += 1;
      return fetch(input, init);
    }) as typeof fetch);
    const before = snapshotDigest();
    for (const token of ['', 'short', 'A'.repeat(44), '+'.repeat(43)])
      expectDeniedPreview(await verify({ ...binding, token }));
    expect(calls).toBe(0);
    expectUnchanged(
      before,
      snapshotDigest(),
      'malformed bearer writes nothing',
    );
  });
});
