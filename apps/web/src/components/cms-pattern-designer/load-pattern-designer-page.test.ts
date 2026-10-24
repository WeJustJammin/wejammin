import { describe, expect, it, vi } from 'vitest';

import {
  jsonResponse,
  patternApiError,
  patternDetailFixture,
} from '../../server/cms-pattern-platform.test-support';
import {
  loadPatternDesignerPage,
  type PatternDesignerPageReads,
} from './load-pattern-designer-page';

const CONTEXT = {
  contentTypes: [
    {
      id: '30000000-0000-4000-8000-000000000003',
      typeKey: 'profile',
      activeVersionId: '40000000-0000-4000-8000-000000000004',
      activeVersion: 1,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [
    { blockKey: 'profile.header', blockVersion: 1 },
    { blockKey: 'profile.text', blockVersion: 3 },
  ],
};
const ORIGIN = 'https://web.test';
const request = (path: string, cookie = 'wj_access=a; wj_csrf=csrf-token-1') =>
  new Request(`${ORIGIN}${path}`, { headers: { cookie } });
const reads = (
  context: Response,
  latest: Response = jsonResponse(200, patternDetailFixture(), { etag: '"1"' }),
) => {
  const stub = {
    context: vi.fn(async () => context),
    latest: vi.fn(async () => latest),
  };
  return stub satisfies PatternDesignerPageReads;
};
const okContext = () => jsonResponse(200, CONTEXT);

describe('loadPatternDesignerPage: a new pattern', () => {
  const load = (stub: PatternDesignerPageReads) =>
    loadPatternDesignerPage({
      request: request('/app/cms-content-modeling/patterns/new'),
      patternKey: null,
      reads: stub,
    });

  it('serves only the selectors the form needs and the CSRF token', async () => {
    const stub = reads(okContext());
    const outcome = await load(stub);
    expect(outcome.kind === 'view' && outcome.status).toBe(200);
    if (outcome.kind !== 'view') return;
    expect(outcome.view).toEqual({
      mode: 'create',
      context: {
        contentTypes: [{ id: CONTEXT.contentTypes[0]!.id, typeKey: 'profile' }],
        registeredBlocks: CONTEXT.registeredBlocks,
      },
      latest: null,
      panel: null,
      csrfToken: 'csrf-token-1',
    });
    expect(JSON.stringify(outcome.view)).not.toContain('activeVersionId');
    expect(stub.latest).not.toHaveBeenCalled();
  });

  it('redirects an expired session to sign-in and back to the new-pattern page', async () => {
    const outcome = await load(
      reads(jsonResponse(401, patternApiError('cmsPatternLatestRead', 401))),
    );
    expect(outcome).toEqual({
      kind: 'redirect',
      location:
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fpatterns%2Fnew',
    });
  });

  it.each([
    [403, 'Template designer access is required'],
    [404, 'unavailable to the current acting context'],
    [503, 'not responding'],
  ])('shows one fixed notice for a %i', async (status, copy) => {
    const outcome = await load(
      reads(
        jsonResponse(status, patternApiError('cmsPatternLatestRead', status)),
      ),
    );
    expect(outcome.kind).toBe('notice');
    if (outcome.kind !== 'notice') return;
    expect(outcome.notice.status).toBe(status);
    expect(outcome.notice.message).toContain(copy);
  });

  it('keeps the wait of a rate limit', async () => {
    const outcome = await load(
      reads(
        jsonResponse(429, patternApiError('cmsPatternLatestRead', 429), {
          'retry-after': '12',
        }),
      ),
    );
    expect(outcome.kind === 'notice' && outcome.notice.message).toContain(
      '12 seconds',
    );
  });

  it('renders nothing from a context that is not the strict projection', async () => {
    const outcome = await load(
      reads(jsonResponse(200, { ...CONTEXT, ownerId: 'x' })),
    );
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});

describe('loadPatternDesignerPage: a saved pattern', () => {
  const load = (
    stub: PatternDesignerPageReads,
    key: string | null = 'profile-hero',
  ) =>
    loadPatternDesignerPage({
      request: request(`/app/cms-content-modeling/patterns/${key}`),
      patternKey: key ?? '',
      reads: stub,
    });

  it('serves the latest version as the edit preimage and the panel facts', async () => {
    const stub = reads(okContext());
    const outcome = await load(stub);
    if (outcome.kind !== 'view') throw new Error('expected a view');
    const fixture = patternDetailFixture();
    expect(outcome.view.mode).toBe('edit');
    expect(outcome.view.latest).toEqual({
      id: fixture.id,
      version: '1',
      contentHash: fixture.contentHash,
      state: 'draft',
      patternKey: 'profile-hero',
      patternVersion: 1,
      compatibleTypeIds: fixture.compatibleTypeIds,
      nodeCount: 2,
      blockRegistryDigest: fixture.blockRegistryDigest,
      blockTree: fixture.blockTree,
    });
    expect(outcome.view.panel).toEqual({
      id: fixture.id,
      contentHash: fixture.contentHash,
      patternKey: 'profile-hero',
      patternVersion: 1,
      state: 'draft',
    });
    expect(stub.latest).toHaveBeenCalledWith(
      expect.any(Request),
      'profile-hero',
    );
  });

  it.each(['selector', 'new', 'context', 'versions', 'Bad_Key', ''])(
    'answers the key %j with a 400 before any read',
    async (key) => {
      const stub = reads(okContext());
      const outcome = await loadPatternDesignerPage({
        request: request('/app/cms-content-modeling/patterns/x'),
        patternKey: key,
        reads: stub,
      });
      expect(outcome.kind === 'notice' && outcome.notice.status).toBe(400);
      expect(stub.context).not.toHaveBeenCalled();
      expect(stub.latest).not.toHaveBeenCalled();
    },
  );

  it('redirects when either read says the session ended', async () => {
    const expired = jsonResponse(
      401,
      patternApiError('cmsPatternLatestRead', 401),
    );
    for (const stub of [reads(expired), reads(okContext(), expired)])
      expect(await load(stub)).toEqual({
        kind: 'redirect',
        location:
          '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fpatterns%2Fprofile-hero',
      });
  });

  it('sends an ended session to sign-in even when the other read answered 404', async () => {
    const outcome = await load(
      reads(
        jsonResponse(401, patternApiError('cmsPatternLatestRead', 401)),
        jsonResponse(404, patternApiError('cmsPatternLatestRead', 404)),
      ),
    );
    expect(outcome.kind).toBe('redirect');
  });

  it('shows the disclosure-safe 404 for a concealed or absent key', async () => {
    const outcome = await load(
      reads(
        okContext(),
        jsonResponse(404, patternApiError('cmsPatternLatestRead', 404)),
      ),
    );
    expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
      status: 404,
      message: 'This pattern is unavailable to the current acting context.',
    });
  });

  it.each([
    [
      'another key',
      jsonResponse(200, patternDetailFixture({ patternKey: 'other-key' }), {
        etag: '"1"',
      }),
    ],
    [
      'a wrong ETag',
      jsonResponse(200, patternDetailFixture(), { etag: '"7"' }),
    ],
    [
      'a body outside the contract',
      jsonResponse(
        200,
        { ...patternDetailFixture(), ownerId: 'x' },
        { etag: '"1"' },
      ),
    ],
  ])('renders nothing for %s', async (_name, latest) => {
    const outcome = await load(reads(okContext(), latest));
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});
