import { describe, expect, it } from 'vitest';

import { parsePatternSelectorQuery } from './pattern-selector-query';

/**
 * CMS-03C-13 strict query (BE00 step 6; BE03c 175, 398, 1266): `contentTypeId` is required and a UUID, `cursor` is an
 * opaque signed string of 1-512 characters passed through byte for byte, `limit` is 1-50 with default 25. An unknown,
 * duplicated, missing or empty key and an unusable value syntax are a bare 400; a canonical decimal integer outside
 * 1-50 is one class (422 with the `/limit` pointer, exactly as the SQL reader answers).
 */
const TYPE_ID = 'c0000000-0000-4000-8000-000000000001';
const parse = (query: string) =>
  parsePatternSelectorQuery(new URLSearchParams(query));
const bare400 = { ok: false, status: 400 };

describe('parsePatternSelectorQuery', () => {
  it('applies the default limit of 25 and sends no cursor', () => {
    expect(parse(`contentTypeId=${TYPE_ID}`)).toEqual({
      ok: true,
      value: { contentTypeId: TYPE_ID, limit: 25 },
    });
  });

  it('passes the cursor and the limit through', () => {
    const cursor = 'eyJxdWVyeUhhc2giOiJ4In0=.c2ln';
    expect(
      parse(
        `contentTypeId=${TYPE_ID}&limit=50&cursor=${encodeURIComponent(cursor)}`,
      ),
    ).toEqual({
      ok: true,
      value: { contentTypeId: TYPE_ID, limit: 50, cursor },
    });
    expect(parse(`contentTypeId=${TYPE_ID}&limit=1`)).toMatchObject({
      ok: true,
      value: { limit: 1 },
    });
  });

  it('accepts a cursor of exactly 512 characters and refuses 513', () => {
    expect(
      parse(`contentTypeId=${TYPE_ID}&cursor=${'a'.repeat(512)}`),
    ).toMatchObject({ ok: true });
    expect(
      parse(`contentTypeId=${TYPE_ID}&cursor=${'a'.repeat(513)}`),
    ).toMatchObject(bare400);
  });

  it.each([
    ['no query at all', ''],
    ['a missing contentTypeId', 'limit=5'],
    ['an empty contentTypeId', 'contentTypeId='],
    ['a malformed contentTypeId', 'contentTypeId=not-a-uuid'],
    ['an unknown key', `contentTypeId=${TYPE_ID}&x=1`],
    [
      'a duplicated contentTypeId',
      `contentTypeId=${TYPE_ID}&contentTypeId=${TYPE_ID}`,
    ],
    ['a duplicated cursor', `contentTypeId=${TYPE_ID}&cursor=a&cursor=b`],
    ['an empty cursor', `contentTypeId=${TYPE_ID}&cursor=`],
    ['an empty limit', `contentTypeId=${TYPE_ID}&limit=`],
    ['a non-numeric limit', `contentTypeId=${TYPE_ID}&limit=abc`],
    ['a fractional limit', `contentTypeId=${TYPE_ID}&limit=1.5`],
    ['a plus-signed limit', `contentTypeId=${TYPE_ID}&limit=%2B5`],
    ['a zero-padded limit', `contentTypeId=${TYPE_ID}&limit=007`],
    ['a negative zero limit', `contentTypeId=${TYPE_ID}&limit=-0`],
    [
      'a malformed id together with an out-of-range limit',
      'contentTypeId=x&limit=99',
    ],
  ])('%s is a bare 400', (_name, query) => {
    expect(parse(query)).toMatchObject(bare400);
    expect((parse(query) as { details?: unknown }).details).toEqual({});
  });

  it.each([
    ['zero', '0'],
    ['51', '51'],
    ['negative', '-1'],
    ['a large canonical integer', '1000000'],
    ['a 30-digit canonical integer', '9'.repeat(30)],
  ])(
    'a canonical limit outside 1-50 (%s) is a 422 naming /limit',
    (_n, limit) => {
      expect(parse(`contentTypeId=${TYPE_ID}&limit=${limit}`)).toEqual({
        ok: false,
        status: 422,
        code: 'COMPOSITION_VALIDATION_FAILED',
        message:
          'COMPOSITION_VALIDATION_FAILED: composition operation rejected or unavailable.',
        details: {
          violations: [
            {
              path: '/limit',
              code: 'invalid',
              message: 'The value is invalid.',
            },
          ],
        },
      });
    },
  );
});
