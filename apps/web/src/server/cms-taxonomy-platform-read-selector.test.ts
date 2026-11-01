import { describe, expect, it } from 'vitest';
import { readCmsTaxonomySelector } from './cms-taxonomy-platform-read';
import {
  SELECTOR_PATH,
  SURVIVOR_ID,
  bindingFor,
  jsonResponse,
  readRequest,
  selectorPageFixture,
  taxonomyApiError,
} from './cms-taxonomy-platform.test-support';

const errorOf = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('CMS-03C-17 selector proxy', () => {
  const run = (request: Request, ...queue: (Response | Error)[]) => {
    const binding = bindingFor(...queue);
    return { binding, done: readCmsTaxonomySelector(request, binding) };
  };
  const query = '?typeKey=article&fieldKey=tags&locale=en';
  const served = (
    overrides: Readonly<Record<string, unknown>> = {},
    etag = '"7"',
  ) => jsonResponse(200, selectorPageFixture(overrides), { etag });

  it('forwards the typed query in one fixed order and returns the verified page', async () => {
    const { binding, done } = run(
      readRequest(
        SELECTOR_PATH,
        {},
        '?limit=20&locale=en-GB&fieldKey=tags&typeKey=article&cursor=c.1',
      ),
      served(),
    );
    const response = await done;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(selectorPageFixture());
    expect((binding.requests()[0] as Request).url).toBe(
      `https://platform-api.internal${SELECTOR_PATH}?typeKey=article&fieldKey=tags&locale=en-GB&cursor=c.1&limit=20`,
    );
  });

  const missingOrUnknown: ReadonlyArray<readonly [string, string]> = [
    ['no query', ''],
    ['a missing field key', '?typeKey=article&locale=en'],
    ['an unknown key', `${query}&x=1`],
    ['a duplicate key', `${query}&locale=fr`],
    ['an empty cursor', `${query}&cursor=`],
  ];
  it.each(missingOrUnknown)(
    'refuses %s with a 400 before the Worker',
    async (_name, search) => {
      const { binding, done } = run(readRequest(SELECTOR_PATH, {}, search));
      expect((await done).status).toBe(400);
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  const grammar: ReadonlyArray<readonly [string, string, string]> = [
    [
      'a type key outside the grammar',
      '?typeKey=Bad&fieldKey=tags&locale=en',
      '/typeKey',
    ],
    [
      'a field key outside the grammar',
      '?typeKey=article&fieldKey=Bad&locale=en',
      '/fieldKey',
    ],
    [
      'a malformed locale',
      '?typeKey=article&fieldKey=tags&locale=e',
      '/locale',
    ],
    ['a limit above 100', `${query}&limit=101`, '/limit'],
    ['a limit of zero', `${query}&limit=0`, '/limit'],
  ];
  it.each(grammar)(
    'answers %s with a 422 naming only the query member',
    async (_name, search, pointer) => {
      const { binding, done } = run(readRequest(SELECTOR_PATH, {}, search));
      const response = await done;
      expect(response.status).toBe(422);
      const body = await errorOf(response);
      expect(body.code).toBe('TAXONOMY_VALIDATION_FAILED');
      expect(body.details.violations).toEqual([
        { path: pointer, code: 'invalid', message: 'The value is invalid.' },
      ]);
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it('refuses an If-Match, a media type, a cross-origin read and a missing binding', async () => {
    for (const [request, status] of [
      [readRequest(SELECTOR_PATH, { 'if-match': '"1"' }, query), 400],
      [
        readRequest(SELECTOR_PATH, { 'content-type': 'text/plain' }, query),
        415,
      ],
      [readRequest(SELECTOR_PATH, { origin: 'https://evil.test' }, query), 403],
    ] as const) {
      const { binding, done } = run(request);
      expect((await done).status).toBe(status);
      expect(binding.fetch).not.toHaveBeenCalled();
    }
    expect(
      (
        await readCmsTaxonomySelector(
          readRequest(SELECTOR_PATH, {}, query),
          undefined,
        )
      ).status,
    ).toBe(503);
  });

  it('relays a typed capability refusal, a cursor conflict and a query refusal', async () => {
    const forbidden = await run(
      readRequest(SELECTOR_PATH, {}, query),
      jsonResponse(
        403,
        taxonomyApiError('CMS-03C-17', 403, {
          reasonCode: 'capability_missing',
        }),
      ),
    ).done;
    expect((await errorOf(forbidden)).details).toEqual({
      reasonCode: 'capability_missing',
    });
    expect(
      (
        await run(
          readRequest(SELECTOR_PATH, {}, query),
          jsonResponse(409, taxonomyApiError('CMS-03C-17', 409)),
        ).done
      ).status,
    ).toBe(409);
    const refused = await run(
      readRequest(SELECTOR_PATH, {}, query),
      jsonResponse(
        422,
        taxonomyApiError('CMS-03C-17', 422, {
          violations: [{ path: '/locale', code: 'x', message: 'm' }],
        }),
      ),
    ).done;
    expect(refused.status).toBe(422);
    expect((await errorOf(refused)).details.violations).toEqual([
      { path: '/locale', code: 'invalid', message: 'The value is invalid.' },
    ]);
  });

  const item = selectorPageFixture().items[0] as Record<string, unknown>;
  const unverifiable: ReadonlyArray<readonly [string, string, Response]> = [
    ['an ETag that is not the page version', query, served({}, '"8"')],
    [
      'more rows than the limit',
      `${query}&limit=1`,
      served({
        items: [item, { ...item, termId: SURVIVOR_ID, termKey: 'organ' }],
      }),
    ],
    ['a repeated term', query, served({ items: [item, item] })],
    [
      'an extra member',
      query,
      jsonResponse(
        200,
        { ...selectorPageFixture(), owner: 'x' },
        { etag: '"7"' },
      ),
    ],
    [
      'a flat term with a parent',
      query,
      jsonResponse(
        200,
        {
          ...selectorPageFixture(),
          items: [{ ...item, shape: 'flat', parentId: SURVIVOR_ID }],
        },
        { etag: '"7"' },
      ),
    ],
  ];
  it.each(unverifiable)(
    'answers a local 502 for %s',
    async (_name, search, upstream) => {
      const response = await run(
        readRequest(SELECTOR_PATH, {}, search),
        upstream,
      ).done;
      expect(response.status).toBe(502);
    },
  );
});
