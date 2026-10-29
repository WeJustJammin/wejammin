import { describe, expect, it } from 'vitest';

import { parsePatternNestableQuery } from './pattern-nestable-query';

/**
 * cmsPatternNestableRead strict query admission (BE03c 413, `PatternNestableQuery`): `contentTypeId` is REPEATED 1-64
 * times (unique UUIDs), an optional signed cursor passes through byte for byte, `limit` 1-50 defaults to 25 here so the
 * database binds every page of a listing to one page size; no other key. Malformed is a bare 400; a count or a limit out
 * of its bounds is the 422 whose violations name the member (`/contentTypeId`, `/limit`).
 */
const id = (n: number): string =>
  `a9120000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const parse = (query: string) =>
  parsePatternNestableQuery(new URLSearchParams(query));
const repeated = (count: number): string =>
  Array.from(
    { length: count },
    (_unused, index) => `contentTypeId=${id(index + 1)}`,
  ).join('&');

describe('parsePatternNestableQuery', () => {
  it('collects the repeated content type ids in request order and applies the default limit', () => {
    expect(parse(`contentTypeId=${id(2)}&contentTypeId=${id(1)}`)).toEqual({
      ok: true,
      value: { contentTypeId: [id(2), id(1)], limit: 25 },
    });
    expect(parse(`contentTypeId=${id(1)}`)).toEqual({
      ok: true,
      value: { contentTypeId: [id(1)], limit: 25 },
    });
  });

  it('passes a cursor and a limit through', () => {
    expect(parse(`contentTypeId=${id(1)}&limit=7&cursor=abc.def`)).toEqual({
      ok: true,
      value: { contentTypeId: [id(1)], limit: 7, cursor: 'abc.def' },
    });
  });

  it('accepts exactly 64 types and a 512-character cursor', () => {
    const sixtyFour = parse(repeated(64));
    expect(sixtyFour.ok && sixtyFour.value.contentTypeId).toHaveLength(64);
    expect(parse(`${repeated(1)}&cursor=${'a'.repeat(512)}`).ok).toBe(true);
  });

  it.each([
    ['no query', ''],
    ['only a limit', 'limit=5'],
    ['a non-UUID id', 'contentTypeId=nope'],
    ['one bad id among good ones', `contentTypeId=${id(1)}&contentTypeId=nope`],
    ['an empty id', 'contentTypeId='],
    ['a duplicate id', `contentTypeId=${id(1)}&contentTypeId=${id(1)}`],
    [
      'a duplicate id in another case',
      `contentTypeId=${id(1)}&contentTypeId=${id(1).toUpperCase()}`,
    ],
    ['an unknown key', `contentTypeId=${id(1)}&x=1`],
    ['the singular key of CMS-03C-13 misspelled', `contentTypeIds=${id(1)}`],
    ['a duplicated cursor', `contentTypeId=${id(1)}&cursor=a&cursor=b`],
    ['an empty cursor', `contentTypeId=${id(1)}&cursor=`],
    ['an oversize cursor', `contentTypeId=${id(1)}&cursor=${'a'.repeat(513)}`],
    ['a duplicated limit', `contentTypeId=${id(1)}&limit=1&limit=2`],
    ['a non-numeric limit', `contentTypeId=${id(1)}&limit=abc`],
    ['a padded limit', `contentTypeId=${id(1)}&limit=05`],
    ['a fractional limit', `contentTypeId=${id(1)}&limit=2.5`],
  ])('%s is a bare 400', (_name, query) => {
    expect(parse(query)).toMatchObject({ ok: false, status: 400 });
  });

  it.each([
    ['65 types', repeated(65), '/contentTypeId'],
    ['a limit of zero', `${repeated(1)}&limit=0`, '/limit'],
    ['a limit above the maximum', `${repeated(1)}&limit=51`, '/limit'],
    ['a negative limit', `${repeated(1)}&limit=-3`, '/limit'],
    [
      'a limit of any digit count',
      `${repeated(1)}&limit=${'9'.repeat(40)}`,
      '/limit',
    ],
  ])('%s is the 422 naming the member', (_name, query, path) => {
    expect(parse(query)).toMatchObject({
      ok: false,
      status: 422,
      details: {
        violations: [
          { path, code: 'invalid', message: 'The value is invalid.' },
        ],
      },
    });
  });

  it('a malformed id wins over a count out of bounds', () => {
    expect(parse(`${repeated(65)}&contentTypeId=nope`)).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
