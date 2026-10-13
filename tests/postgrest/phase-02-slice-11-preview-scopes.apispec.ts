import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  approvedDraft,
  type ReviewedDraft,
} from './support/phase-02-slice-11-flow';
import {
  expectAbsent,
  expectSafeEqual,
  expectSafeError,
  expectUnchanged,
  parseApiError,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import {
  entryVersion,
  expectPreviewAppend,
  expectPreviewStored,
  parsePreview,
  previewBody,
} from './support/phase-02-slice-11-preview-support';
import { expectRpcIdentity } from './support/phase-02-slice-11-publish-support';

let world: S11World;
let stack: S11Stack;
let draft: ReviewedDraft;
let version: string;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  draft = await approvedDraft(stack, world, 'Preview scope matrix');
  version = entryVersion(draft);
});

describe('CMS-03B-08 scope and transport boundaries', () => {
  it.each(['owner', 'publisher', 'reviewer'] as const)(
    '[CMS-03B-08] %s scope mints with exact binding, lifetime and three-group append delta',
    async (role) => {
      const actor = world[role];
      stack.as(actor);
      stack.clearRpcs();
      const requestId = randomUUID();
      const before = snapshotDigest();
      const response = await stack.post('/api/v1/cms/previews', {
        body: previewBody(draft),
        ifMatch: version,
        headers: { 'x-request-id': requestId },
      });
      const preview = parsePreview(response);
      expectSafeEqual(
        { ...preview, token: undefined, expiresAt: undefined },
        {
          ...previewBody(draft),
          token: undefined,
          expiresAt: undefined,
          revoked: false,
        },
        'complete preview resource binding',
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('etag')).toBeNull();
      expect(response.headers.get('location')).toBeNull();
      expectSafeEqual(
        response.headers.get('x-request-id'),
        requestId,
        'mint request header',
      );
      expectRpcIdentity(stack, 'cms_mint_preview', requestId);
      const tokenId = expectPreviewStored(preview, actor);
      expectPreviewAppend(before, tokenId, requestId);
    },
  );

  it('[CMS-03B-08] preview token response prohibits indexing as well as storage', async () => {
    stack.as(world.owner);
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(draft),
      ifMatch: version,
    });
    parsePreview(response);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      /(?:^|[\s,])noindex(?:$|[\s,])/u.test(
        response.headers.get('x-robots-tag') ?? '',
      ),
      'preview response prohibits indexing',
    ).toBe(true);
  });

  it('[CMS-03B-08] no session is a strict 401 before RPC with all effects unchanged', async () => {
    stack.as(null);
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(draft),
      ifMatch: version,
    });
    expectSafeError(response, {
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(stack.rpcs()).toEqual([]);
    expectUnchanged(
      before,
      snapshotDigest(),
      'unauthenticated mint has no effects',
    );
  });

  it('[CMS-03B-08] hidden and absent entries have identical strict safe 404 bodies with own RPC identities', async () => {
    stack.as(world.stranger);
    const errors = [];
    for (const candidate of [
      draft,
      { ...draft, entryId: randomUUID(), revisionId: randomUUID() },
    ]) {
      stack.clearRpcs();
      const requestId = randomUUID();
      const before = snapshotDigest();
      const response = await stack.post('/api/v1/cms/previews', {
        body: previewBody(candidate),
        ifMatch: version,
        headers: { 'x-request-id': requestId },
      });
      expectSafeError(response, {
        status: 404,
        code: 'NOT_FOUND',
        details: {},
        requestId,
      });
      expectRpcIdentity(stack, 'cms_mint_preview', requestId);
      expectAbsent(response, candidate.entryId, 'concealed entry absent');
      expectAbsent(response, candidate.revisionId, 'concealed revision absent');
      const error = parseApiError(response);
      errors.push({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'concealed mint has no effects',
      );
    }
    expectSafeEqual(errors[0], errors[1], 'hidden and absent mint semantics');
  });

  it('[CMS-03B-08] an unassigned reviewer sees a tenant-visible 403 and no token or reservation', async () => {
    stack.as(world.reviewer2);
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(draft),
      ifMatch: version,
    });
    expectSafeError(response, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(stack.rpcs().some((rpc) => rpc.rpc === 'cms_mint_preview')).toBe(
      true,
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'visible unassigned reviewer mint has no effects',
    );
  });

  it.each([
    ['missing key', { idempotencyKey: null }, 400, 'INVALID_REQUEST'],
    ['missing If-Match', { ifMatch: null }, 400, 'INVALID_REQUEST'],
    ['malformed JSON', { body: '{' }, 400, 'INVALID_REQUEST'],
    [
      'non-JSON media',
      { headers: { 'content-type': 'text/plain' } },
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
  ] as const)(
    '[CMS-03B-08] %s rejects before RPC and preserves all effects',
    async (_name, options, status, code) => {
      stack.as(world.owner);
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post('/api/v1/cms/previews', {
        body: previewBody(draft),
        ifMatch: version,
        ...options,
      });
      expectSafeError(response, {
        status,
        code,
        ...(_name === 'malformed JSON'
          ? { details: {} }
          : status === 415
            ? { details: { allowedMediaTypes: ['application/json'] } }
            : { detailsKeys: ['violations'] }),
      });
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'transport refusal has no effects',
      );
    },
  );

  it('[CMS-03B-08] changed route under the same key is an effect-free idempotency conflict', async () => {
    stack.as(world.owner);
    const key = `preview-binding-${randomUUID()}`;
    parsePreview(
      await stack.post('/api/v1/cms/previews', {
        body: previewBody(draft),
        ifMatch: version,
        idempotencyKey: key,
      }),
    );
    const before = snapshotDigest();
    const response = await stack.post('/api/v1/cms/previews', {
      body: previewBody(draft, { route: '/preview/different' }),
      ifMatch: version,
      idempotencyKey: key,
    });
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'changed binding cannot mint another token',
    );
  });

  it.each([
    [
      'query route',
      { route: '/preview/article?token=blocked' },
      '/route',
      'route_query_or_fragment',
    ],
    [
      'fragment route',
      { route: '/preview/article#blocked' },
      '/route',
      'route_query_or_fragment',
    ],
    [
      'dot segment',
      { route: '/preview/../article' },
      '/route',
      'route_not_normalized',
    ],
    [
      'encoded slash',
      { route: '/preview/%2farticle' },
      '/route',
      'route_not_normalized',
    ],
    [
      'uppercase audience',
      { audience: 'PUBLIC' },
      '/audience',
      'audience_invalid',
    ],
    ['caller evidence', { evidence: null }, '/evidence', 'unknown_field'],
    [
      'caller version',
      { expectedVersion: '1' },
      '/expectedVersion',
      'unknown_field',
    ],
  ] as const)(
    '[CMS-03B-08] %s has one exact safe violation and no mint effects',
    async (_name, body, path, code) => {
      stack.as(world.owner);
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post('/api/v1/cms/previews', {
        body: previewBody(draft, body),
        ifMatch: version,
      });
      expectSafeError(response, {
        status: 422,
        code: 'VALIDATION_FAILED',
        details: {
          violations: [{ path, code, message: 'The value is invalid.' }],
        },
      });
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'invalid preview contract has no effects',
      );
    },
  );

  it.each([
    'schemaHash',
    'settingsVersion',
    'taxonomyVersionIds',
    'blockVersionIds',
    'patternVersionIds',
  ] as const)(
    '[CMS-03B-08] stale %s is checked against canonical state without effects',
    async (member) => {
      stack.as(world.owner);
      const value =
        member === 'schemaHash'
          ? 'f'.repeat(64)
          : member === 'settingsVersion'
            ? '999999'
            : [randomUUID()];
      const before = snapshotDigest();
      const response = await stack.post('/api/v1/cms/previews', {
        body: previewBody(draft, {
          versionSet: { ...draft.versionSet, [member]: value },
        }),
        ifMatch: version,
      });
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: { reasonCode: 'version_set_stale' },
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'stale exact version-set member has no effects',
      );
    },
  );
});
