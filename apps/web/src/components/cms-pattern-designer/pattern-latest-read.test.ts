import { CMS_DEFINITION_VERSION_STATES } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  jsonResponse,
  patternDetailFixture,
} from '../../server/cms-pattern-platform.test-support';
import {
  PATTERN_LIFECYCLE_STATES,
  readLatestPatternVersion,
} from './pattern-latest-fetch';

const served = (overrides: Readonly<Record<string, unknown>> = {}) =>
  jsonResponse(200, patternDetailFixture(overrides), { etag: '"1"' });
const read = async (response: Response | Error, key = 'profile-hero') => {
  const fetcher = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return {
    result: await readLatestPatternVersion(
      key,
      fetcher as unknown as typeof fetch,
    ),
    fetcher,
  };
};

describe('readLatestPatternVersion', () => {
  it('reads the no-store latest version of the key and returns the verified facts', async () => {
    const { result, fetcher } = await read(served());
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/patterns/profile-hero');
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    const fixture = patternDetailFixture();
    expect(result).toEqual({
      kind: 'loaded',
      detail: {
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
      },
    });
  });

  it.each([401, 403, 404, 429])('reports a %i as rejected', async (status) => {
    expect((await read(new Response(null, { status }))).result).toEqual({
      kind: 'rejected',
      status,
    });
  });

  it.each([
    ['a 500', new Response(null, { status: 500 })],
    ['a network failure', new Error('offline')],
    [
      'a body that is not JSON',
      new Response('x', { status: 200, headers: { etag: '"1"' } }),
    ],
    ['another key', served({ patternKey: 'other-key' })],
    ['a version that is not its number', served({ patternVersion: 2 })],
    ['a missing ETag', jsonResponse(200, patternDetailFixture())],
    [
      'a wrong ETag',
      jsonResponse(200, patternDetailFixture(), { etag: '"2"' }),
    ],
    [
      'a registry digest that is not a hash',
      jsonResponse(
        200,
        { ...patternDetailFixture(), blockRegistryDigest: 'nope' },
        { etag: '"1"' },
      ),
    ],
    [
      'a tree that breaks the rules',
      jsonResponse(
        200,
        { ...patternDetailFixture(), blockTree: [] },
        { etag: '"1"' },
      ),
    ],
    [
      'a state outside the lifecycle',
      jsonResponse(
        200,
        { ...patternDetailFixture(), state: 'published' },
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not the detail',
      jsonResponse(200, { id: 'x' }, { etag: '"1"' }),
    ],
  ])('is unavailable for %s', async (_name, response) => {
    expect((await read(response)).result).toEqual({ kind: 'unavailable' });
  });

  it('never reads a malformed or reserved key', async () => {
    for (const key of ['Bad_Key', 'selector', 'new', '']) {
      const { result, fetcher } = await read(served(), key);
      expect(result).toEqual({ kind: 'unavailable' });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
});

describe('lifecycle vocabulary', () => {
  it('equals the contract lifecycle', () => {
    expect([...PATTERN_LIFECYCLE_STATES]).toEqual([
      ...CMS_DEFINITION_VERSION_STATES,
    ]);
  });
});
