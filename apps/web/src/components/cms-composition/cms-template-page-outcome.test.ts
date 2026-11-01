import { describe, expect, it } from 'vitest';

import {
  templateCreatePageOutcome,
  templateSuccessorPageOutcome,
} from './cms-template-page-outcome';

/*
 * P2-S12-AC-164 (c3, c6): the template pages render no form, and so offer no submission, unless the designer context
 * (and for a successor the latest detail) was read and verified. A missing session is the sign-in redirect; a denied
 * context is the capability sentence; a rate limit is the wait sentence with its Retry-After; a degraded read is the
 * retry sentence. Each answer is the status the page responds with.
 */
const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const HASH = 'a'.repeat(64);
const CONTEXT = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: VERSION_ID,
      activeVersion: 2,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'profile.text', blockVersion: 1 }],
};
const DETAIL = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132dc',
  version: '2',
  templateVersion: 2,
  contentHash: HASH,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T13:00:00.000Z',
  state: 'draft',
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'release-note',
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const contextOk = () => Response.json(CONTEXT, { status: 200 });
const detailOk = () =>
  Response.json(DETAIL, { status: 200, headers: { etag: '"2"' } });
const answer = (status: number, headers: Record<string, string> = {}) =>
  Response.json({ code: 'X' }, { status, headers });

const CAPABILITY =
  'Template designer access is required for the current acting context.';
const RATE_CREATE =
  'Template choices are temporarily rate-limited. Wait and reload.';
const RETRY_CREATE =
  'Template choices are unavailable. Reload when the service is ready.';
const RETRY_EDIT =
  'The template or its choices are unavailable. Reload when the service is ready.';

describe('templateCreatePageOutcome (templates/new)', () => {
  it('is ready with the verified context only', async () => {
    const outcome = await templateCreatePageOutcome(contextOk());
    expect(outcome).toEqual({ kind: 'ready', context: CONTEXT });
  });

  it('redirects a missing session to the allowlisted sign-in return path, showing no form', async () => {
    expect(await templateCreatePageOutcome(answer(401))).toEqual({
      kind: 'redirect',
      location:
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Ftemplates%2Fnew',
    });
  });

  it('answers a denied context with 403 and the capability sentence, with no Retry-After', async () => {
    expect(await templateCreatePageOutcome(answer(403))).toEqual({
      kind: 'unavailable',
      status: 403,
      retryAfter: null,
      copy: CAPABILITY,
    });
  });

  it('answers a rate limit with 429, the wait sentence and the stated Retry-After', async () => {
    expect(
      await templateCreatePageOutcome(answer(429, { 'retry-after': '12' })),
    ).toEqual({
      kind: 'unavailable',
      status: 429,
      retryAfter: '12',
      copy: RATE_CREATE,
    });
  });

  it.each(['0', 'abc', '012', '100000', '1.5', ''])(
    'does not believe a Retry-After of %j',
    async (value) => {
      const outcome = await templateCreatePageOutcome(
        answer(429, { 'retry-after': value }),
      );
      expect(outcome).toMatchObject({ kind: 'unavailable', retryAfter: null });
    },
  );

  it.each([503, 504])(
    'answers a degraded %i with the retry sentence and its Retry-After',
    async (status) => {
      expect(
        await templateCreatePageOutcome(
          answer(status, { 'retry-after': '30' }),
        ),
      ).toEqual({
        kind: 'unavailable',
        status,
        retryAfter: '30',
        copy: RETRY_CREATE,
      });
    },
  );

  it.each([400, 404, 500, 502])(
    'answers %i with the retry sentence and no Retry-After, even when one is sent',
    async (status) => {
      expect(
        await templateCreatePageOutcome(
          answer(status, { 'retry-after': '30' }),
        ),
      ).toEqual({
        kind: 'unavailable',
        status,
        retryAfter: null,
        copy: RETRY_CREATE,
      });
    },
  );

  it.each([
    ['a body that is not JSON', new Response('{', { status: 200 })],
    ['a body that is not the context', Response.json({ nope: 1 })],
    ['an extra member', Response.json({ ...CONTEXT, extra: 1 })],
  ])('answers 502 for %s and shows no form', async (_name, response) => {
    expect(await templateCreatePageOutcome(response)).toEqual({
      kind: 'unavailable',
      status: 502,
      retryAfter: null,
      copy: RETRY_CREATE,
    });
  });
});

describe('templateSuccessorPageOutcome (templates/[templateKey])', () => {
  const outcome = (
    context: Response,
    latest: Response,
    key: string | null = 'release-note',
  ) => templateSuccessorPageOutcome(key, context, latest);

  it('is ready with the verified context and the latest detail', async () => {
    expect(await outcome(contextOk(), detailOk())).toEqual({
      kind: 'ready',
      context: CONTEXT,
      detail: DETAIL,
    });
  });

  it.each([
    ['the context', answer(401), detailOk()],
    ['the latest detail', contextOk(), answer(401)],
  ])('redirects a missing session on %s to sign-in', async (_name, a, b) => {
    expect(await outcome(a, b)).toEqual({
      kind: 'redirect',
      location:
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Ftemplates%2Frelease-note',
    });
  });

  it('answers a denied latest detail with 403 and the capability sentence', async () => {
    expect(await outcome(contextOk(), answer(403))).toEqual({
      kind: 'unavailable',
      status: 403,
      retryAfter: null,
      copy: CAPABILITY,
    });
  });

  it('answers a denied context with 403 when the latest detail was read', async () => {
    expect(await outcome(answer(403), detailOk())).toEqual({
      kind: 'unavailable',
      status: 403,
      retryAfter: null,
      copy: CAPABILITY,
    });
  });

  it('answers an absent or concealed template with 404 and the unavailable sentence', async () => {
    expect(await outcome(contextOk(), answer(404))).toEqual({
      kind: 'unavailable',
      status: 404,
      retryAfter: null,
      copy: 'This template is unavailable to the current acting context.',
    });
  });

  it('answers a rate limit on either read with 429, the wait sentence and the stated Retry-After', async () => {
    const expected = {
      kind: 'unavailable',
      status: 429,
      retryAfter: '7',
      copy: 'Template choices are temporarily rate-limited. Wait and reload.',
    };
    expect(
      await outcome(contextOk(), answer(429, { 'retry-after': '7' })),
    ).toEqual(expected);
    expect(
      await outcome(answer(429, { 'retry-after': '7' }), detailOk()),
    ).toEqual(expected);
  });

  it.each([503, 504])(
    'answers a degraded %i on either read with the retry sentence and its Retry-After',
    async (status) => {
      const expected = {
        kind: 'unavailable',
        status,
        retryAfter: '30',
        copy: RETRY_EDIT,
      };
      expect(
        await outcome(contextOk(), answer(status, { 'retry-after': '30' })),
      ).toEqual(expected);
      expect(
        await outcome(answer(status, { 'retry-after': '30' }), detailOk()),
      ).toEqual(expected);
    },
  );

  it('reports the latest detail failure first when both reads failed', async () => {
    expect(await outcome(answer(503), answer(403))).toMatchObject({
      status: 403,
    });
  });

  it.each([
    [
      'a context that is not the context',
      Response.json({ nope: 1 }),
      detailOk(),
    ],
    [
      'a detail that is not the detail',
      contextOk(),
      Response.json({ nope: 1 }, { headers: { etag: '"2"' } }),
    ],
    [
      'a detail of another key',
      contextOk(),
      Response.json(
        { ...DETAIL, templateKey: 'other-key' },
        { headers: { etag: '"2"' } },
      ),
    ],
    [
      'a detail whose version is not its template version',
      contextOk(),
      Response.json({ ...DETAIL, version: '3' }, { headers: { etag: '"3"' } }),
    ],
    ['a detail without its strong ETag', contextOk(), Response.json(DETAIL)],
    [
      'a detail with another ETag',
      contextOk(),
      Response.json(DETAIL, { headers: { etag: '"9"' } }),
    ],
    [
      'a body that is not JSON',
      contextOk(),
      new Response('{', { status: 200, headers: { etag: '"2"' } }),
    ],
  ])('answers 502 for %s and shows no form', async (_name, a, b) => {
    expect(await outcome(a, b)).toEqual({
      kind: 'unavailable',
      status: 502,
      retryAfter: null,
      copy: RETRY_EDIT,
    });
  });

  it('answers a malformed or reserved key with 400 and no status-specific sentence', async () => {
    expect(
      await outcome(
        new Response(null, { status: 400 }),
        new Response(null, { status: 400 }),
        null,
      ),
    ).toEqual({
      kind: 'unavailable',
      status: 400,
      retryAfter: null,
      copy: 'This template is not available.',
    });
  });
});
