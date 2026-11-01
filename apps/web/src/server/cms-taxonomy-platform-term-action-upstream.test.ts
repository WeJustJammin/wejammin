import { describe, expect, it } from 'vitest';
import { forwardCmsTaxonomyTermAction } from './cms-taxonomy-platform-term-action';
import {
  CANONICAL_ID,
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERM_ID,
  actionRequest,
  bindingFor,
  jsonResponse,
  taxonomyApiError,
  termActionBody,
  termResourceFixture,
} from './cms-taxonomy-platform.test-support';

const OTHER_ID = '90000000-0000-4000-8000-000000000099';
const ok = (overrides: Readonly<Record<string, unknown>> = {}, etag?: string) =>
  jsonResponse(200, termResourceFixture(overrides), {
    etag: etag ?? `"${String(overrides.version ?? '1')}"`,
  });
const run = (
  request: Request,
  taxonomyId: string | undefined,
  ...queue: (Response | Error)[]
) => {
  const binding = bindingFor(...queue);
  return {
    binding,
    done: forwardCmsTaxonomyTermAction(request, binding, taxonomyId),
  };
};
const errorOf = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('CMS-03C-03 term action proxy: an unknown member', () => {
  it('is a 422 at / and echoes neither the name nor the value', async () => {
    const { binding, done } = run(
      actionRequest({}, { ...termActionBody(), tricky: 'echo-me' }),
      TAXONOMY_ID,
    );
    const response = await done;
    expect(response.status).toBe(422);
    const parsed = await errorOf(response);
    expect(JSON.stringify(parsed)).not.toContain('echo-me');
    expect(JSON.stringify(parsed)).not.toContain('tricky');
    expect(parsed.details.violations).toEqual([
      { path: '/', code: 'invalid', message: 'The value is invalid.' },
    ]);
    expect(binding.fetch).not.toHaveBeenCalled();
  });
});

describe('CMS-03C-03 term action proxy: upstream refusals', () => {
  const refusal = async (status: number, details: Record<string, unknown>) => {
    const response = await run(
      actionRequest(),
      TAXONOMY_ID,
      jsonResponse(status, taxonomyApiError('CMS-03C-03', status, details)),
    ).done;
    return { response, body: await errorOf(response) };
  };

  it('relays taxonomy_not_active, canonical_overlap and canonical_source_unavailable with their members', async () => {
    expect(
      (await refusal(409, { reasonCode: 'taxonomy_not_active' })).body.details,
    ).toEqual({
      reasonCode: 'taxonomy_not_active',
    });
    expect(
      (
        await refusal(422, {
          reasonCode: 'canonical_overlap',
          domain: 'role',
          canonicalId: CANONICAL_ID,
        })
      ).body.details,
    ).toEqual({
      reasonCode: 'canonical_overlap',
      domain: 'role',
      canonicalId: CANONICAL_ID,
    });
    expect(
      (
        await refusal(422, {
          reasonCode: 'canonical_source_unavailable',
          domain: 'gear',
        })
      ).body.details,
    ).toEqual({ reasonCode: 'canonical_source_unavailable', domain: 'gear' });
  });

  it('relays capability_missing and a plain version conflict', async () => {
    expect(
      (await refusal(403, { reasonCode: 'capability_missing' })).body.details,
    ).toEqual({
      reasonCode: 'capability_missing',
    });
    expect(
      (await refusal(409, { expectedVersion: '2', currentVersion: '5' })).body
        .details,
    ).toEqual({
      expectedVersion: '2',
      currentVersion: '5',
    });
  });

  it('marks 5xx as an unknown outcome and a definite refusal as not', async () => {
    for (const status of [500, 502, 503, 504])
      expect(
        (await refusal(status, {})).response.headers.get(
          'x-cms-editorial-outcome',
        ),
      ).toBe('unknown');
    for (const status of [400, 401, 404, 409, 415, 422, 429])
      expect(
        (await refusal(status, {})).response.headers.get(
          'x-cms-editorial-outcome',
        ),
      ).toBeNull();
  });

  it('treats a transport loss and a non-Response as an unknown outcome', async () => {
    const lost = await run(actionRequest(), TAXONOMY_ID, new Error('reset'))
      .done;
    expect(lost.status).toBe(503);
    expect(lost.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    const odd = await forwardCmsTaxonomyTermAction(
      actionRequest(),
      { fetch: () => Promise.resolve(1) },
      TAXONOMY_ID,
    );
    expect(odd.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });
});

describe('CMS-03C-03 term action proxy: an upstream success must be this request', () => {
  const bad = async (body: Record<string, unknown>, upstream: Response) => {
    const response = await run(actionRequest({}, body), TAXONOMY_ID, upstream)
      .done;
    expect(response.status).toBe(502);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    expect((await errorOf(response)).details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  };
  const good = async (body: Record<string, unknown>, upstream: Response) => {
    const response = await run(actionRequest({}, body), TAXONOMY_ID, upstream)
      .done;
    expect(response.status).toBe(200);
  };

  it('binds a create to a first-version active term of the requested key and parent', async () => {
    await good(termActionBody(), ok());
    await good(
      termActionBody({ parentId: TERM_ID }),
      ok({ parentId: TERM_ID }),
    );
    await bad(termActionBody(), ok({ version: '2' }));
    await bad(termActionBody(), ok({ lifecycle: 'deprecated' }));
    await bad(termActionBody(), ok({ termKey: 'other' }));
    await bad(termActionBody(), ok({ taxonomyId: OTHER_ID }));
    await bad(termActionBody(), ok({ parentId: TERM_ID }));
    await bad(termActionBody(), ok({ id: SURVIVOR_ID }));
  });

  it('binds a rename to a later version that is active or deprecated, keeping the requested parent', async () => {
    const rename = termActionBody({ action: 'rename', parentId: null });
    await good(rename, ok({ version: '2' }));
    await good(rename, ok({ version: '5', lifecycle: 'deprecated' }));
    await bad(rename, ok({ version: '1' }));
    await bad(
      rename,
      ok({ version: '2', lifecycle: 'merged', successorId: SURVIVOR_ID }),
    );
    await bad(rename, ok({ version: '2', parentId: TERM_ID }));
  });

  it('does not bind the stored parent of an alias, a deprecate or a merge', async () => {
    await good(
      termActionBody({ action: 'alias' }),
      ok({ version: '2', parentId: TERM_ID }),
    );
    await good(
      termActionBody({ action: 'deprecate' }),
      ok({ version: '2', lifecycle: 'deprecated', parentId: TERM_ID }),
    );
    await bad(termActionBody({ action: 'alias' }), ok({ version: '1' }));
    await bad(
      termActionBody({ action: 'alias' }),
      ok({ version: '2', lifecycle: 'merged', successorId: SURVIVOR_ID }),
    );
  });

  it('binds a deprecate to a deprecated term and a merge to a merged term redirecting to the survivor', async () => {
    const deprecate = termActionBody({ action: 'deprecate' });
    await bad(deprecate, ok({ version: '2' }));
    const merge = termActionBody({ action: 'merge', survivorId: SURVIVOR_ID });
    await good(
      merge,
      ok({ version: '3', lifecycle: 'merged', successorId: SURVIVOR_ID }),
    );
    await bad(
      merge,
      ok({ version: '3', lifecycle: 'merged', successorId: OTHER_ID }),
    );
    await bad(merge, ok({ version: '3', lifecycle: 'active' }));
    await bad(merge, ok({ version: '3', lifecycle: 'deprecated' }));
    await bad(
      termActionBody({ action: 'alias' }),
      ok({ version: '2', termKey: 'other' }),
    );
  });

  it('refuses an alias whose answer names a successor', async () => {
    await bad(
      termActionBody({ action: 'alias' }),
      ok({ version: '2', lifecycle: 'deprecated', successorId: SURVIVOR_ID }),
    );
  });

  const wire: ReadonlyArray<readonly [string, Response]> = [
    [
      'a 201 instead of 200',
      jsonResponse(201, termResourceFixture(), { etag: '"1"' }),
    ],
    ['an ETag that is not the version', ok({}, '"2"')],
    ['a missing ETag', jsonResponse(200, termResourceFixture())],
    ['a weak ETag', ok({}, 'W/"1"')],
    [
      'a body that is not the resource',
      jsonResponse(
        200,
        { ...termResourceFixture(), owner: 'x' },
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not JSON',
      new Response('nope', { status: 200, headers: { etag: '"1"' } }),
    ],
    ['a term whose id differs from its term id', ok({ id: SURVIVOR_ID })],
  ];
  it.each(wire)('is an unknown outcome for %s', async (_name, upstream) => {
    await bad(termActionBody(), upstream);
  });
});
