import {
  CmsPreviewRouteSchema,
  CmsScheduleLocalDateTimeSchema,
  CmsScheduleTimezoneSchema,
  DecisionReasonSchema,
  ReviewAssignmentReasonSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

/*
 * The generated OpenAPI must never be looser than the runtime schema for the
 * custom refinements Zod cannot project: code-point limits, calendar ranges,
 * dot segments, route normalization and Unicode normalization. Each string
 * constraint the document publishes is evaluated here by a small JSON Schema
 * string evaluator (type, minLength and maxLength in code points, pattern, and
 * the `x-unicode-normalization` extension) and compared with the runtime
 * schema over an enumerated and a deterministic generated corpus, so the
 * published constraint is proven EQUAL to the runtime rule, not merely present.
 */

type JsonObject = Record<string, unknown>;
type Document = Readonly<{
  paths: Readonly<Record<string, Readonly<Record<string, JsonObject>>>>;
  components: Readonly<{ schemas: Readonly<Record<string, JsonObject>> }>;
}>;

const document = buildOpenApiDocument() as unknown as Document;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bodyOf = (path: string): JsonObject => {
  const operation = document.paths[path]?.post;
  const body = (
    (operation?.requestBody as JsonObject | undefined)?.content as
      JsonObject | undefined
  )?.['application/json'];
  const schema = isObject(body) ? body.schema : undefined;
  if (!isObject(schema)) throw new Error(`no request body for ${path}`);
  return schema;
};

/** The document's schema for one body member, resolved through a single $ref. */
const resolve = (schema: unknown): JsonObject => {
  if (!isObject(schema)) throw new Error('schema is not an object');
  const ref = schema.$ref;
  if (typeof ref !== 'string') return schema;
  const name = ref.replace('#/components/schemas/', '');
  const found = document.components.schemas[name];
  if (found === undefined) throw new Error(`unresolved ${ref}`);
  return found;
};

const memberOf = (body: JsonObject, name: string): JsonObject => {
  const properties = resolve(body).properties;
  if (!isObject(properties) || !isObject(properties[name]))
    throw new Error(`no member ${name}`);
  return resolve(properties[name]);
};

/** The evaluator of the string keywords of `schema` (the subset the document uses), compiled once. */
const evaluator = (schema: JsonObject): ((value: string) => boolean) => {
  const pattern =
    typeof schema.pattern === 'string' ? new RegExp(schema.pattern) : null;
  const nfc = schema['x-unicode-normalization'] === 'NFC';
  return (value) => {
    const length = Array.from(value).length;
    if (typeof schema.minLength === 'number' && length < schema.minLength)
      return false;
    if (typeof schema.maxLength === 'number' && length > schema.maxLength)
      return false;
    if (pattern !== null && !pattern.test(value)) return false;
    return !nfc || value === value.normalize('NFC');
  };
};

/** True when `value` satisfies the string keywords of `schema`. */
const satisfies = (schema: JsonObject, value: string): boolean =>
  evaluator(schema)(value);

/** A deterministic generator (LCG): the corpus is the same on every run. */
const generator = (seed: number) => {
  let state = seed;
  return (bound: number): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % bound;
  };
};

/** Every value on which the published constraint and the runtime schema disagree (must be none). */
const agree = (
  published: JsonObject,
  runtime: { safeParse: (value: unknown) => { success: boolean } },
  values: readonly string[],
): void => {
  expect(values.length).toBeGreaterThan(0);
  const publishedAccepts = evaluator(published);
  const disagreements = values
    .filter(
      (value) => publishedAccepts(value) !== runtime.safeParse(value).success,
    )
    .slice(0, 5)
    .map((value) => JSON.stringify(value));
  expect(disagreements).toEqual([]);
};

describe('[P2-S11-AC-017] publication-schedule localDateTime publishes its calendar and clock ranges', () => {
  const published = memberOf(
    bodyOf('/api/v1/cms/publication-schedules'),
    'localDateTime',
  );
  const pad = (value: number, width: number): string =>
    String(value).padStart(width, '0');

  it('is a plain string constraint with a pattern', () => {
    expect(published.type).toBe('string');
    expect(typeof published.pattern).toBe('string');
  });

  it('agrees with the runtime over every month and day of leap, century and ordinary years', () => {
    const values: string[] = [];
    for (const year of [0, 1, 4, 100, 400, 1900, 2000, 2023, 2024, 2100, 9999])
      for (let month = 0; month <= 13; month += 1)
        for (let day = 0; day <= 32; day += 1)
          values.push(`${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T12:30`);
    agree(published, CmsScheduleLocalDateTimeSchema, values);
    expect(satisfies(published, '2024-02-30T25:99')).toBe(false);
    expect(satisfies(published, '2024-02-29T23:59:59.999999999')).toBe(true);
    expect(satisfies(published, '2023-02-29T00:00')).toBe(false);
    expect(satisfies(published, '1900-02-29T00:00')).toBe(false);
    expect(satisfies(published, '2000-02-29T00:00')).toBe(true);
    expect(satisfies(published, '0000-01-01T00:00')).toBe(false);
  });

  it('agrees with the runtime over every hour, minute, second and fraction length', () => {
    const values: string[] = [];
    for (let hour = 0; hour <= 25; hour += 1)
      values.push(`2026-11-01T${pad(hour, 2)}:00`);
    for (let minute = 0; minute <= 61; minute += 1)
      values.push(`2026-11-01T09:${pad(minute, 2)}`);
    for (let second = 0; second <= 61; second += 1)
      values.push(`2026-11-01T09:30:${pad(second, 2)}`);
    for (let digits = 0; digits <= 11; digits += 1)
      values.push(`2026-11-01T09:30:15.${'1'.repeat(digits)}`);
    values.push(
      '2026-11-01 09:30',
      '2026-11-01t09:30',
      '2026-11-01T09:30Z',
      '2026-11-01T09:30+02:00',
      '2026-11-01T09',
      '2026-11-01T9:30',
      '26-11-01T09:30',
      '12026-11-01T09:30',
      '2026-11-01T09:30:5',
      '2026-11-01T09:30.5',
      '2026-11-01',
      '',
      ' 2026-11-01T09:30',
      '2026-11-01T09:30 ',
      '2026-11-01T09:30\n',
      '\u{ff12}\u{ff10}\u{ff12}\u{ff16}-11-01T09:30',
    );
    agree(published, CmsScheduleLocalDateTimeSchema, values);
  });
});

describe('[P2-S11-AC-017] publication-schedule timezone refuses dot segments in the published pattern', () => {
  const published = memberOf(
    bodyOf('/api/v1/cms/publication-schedules'),
    'timezone',
  );

  it('keeps the 1-64 length bound and agrees with the runtime over valid and dot-segment names', () => {
    expect(published.minLength).toBe(1);
    expect(published.maxLength).toBe(64);
    const values = [
      'UTC',
      'GMT',
      'Etc/GMT+5',
      'Etc/GMT-14',
      'America/New_York',
      'America/Argentina/Buenos_Aires',
      'America/Indiana/Indianapolis',
      'America/North_Dakota/Center',
      'Asia/Ho_Chi_Minh',
      'A/B/C',
      'a.b/c.d',
      'America/.hidden',
      'America/a.',
      'America/...x',
      'America/../New_York',
      'America/./New_York',
      'America/..',
      'America/.',
      'America/...',
      'America/New_York/..',
      'America/Argentina/..',
      'America/./.',
      '../etc',
      './etc',
      '.',
      '..',
      '...',
      '/America/New_York',
      'America/New_York/',
      'America//New_York',
      'A/B/C/D',
      'Ame rica',
      'Am\u{e9}rica/Nueva',
      '1America/New_York',
      '_America',
      '',
      'a'.repeat(64),
      'a'.repeat(65),
      `A/${'b'.repeat(61)}`,
      `A/${'b'.repeat(62)}`,
    ];
    agree(published, CmsScheduleTimezoneSchema, values);
    expect(satisfies(published, 'America/../New_York')).toBe(false);
  });
});

describe('[P2-S11-AC-023] preview route publishes its length, leading-slash and normalization rules', () => {
  const published = memberOf(bodyOf('/api/v1/cms/previews'), 'route');

  it('bounds the route at 2048 code points, not UTF-16 units', () => {
    expect(published.maxLength).toBe(2048);
    expect(satisfies(published, `/${'a'.repeat(2047)}`)).toBe(true);
    expect(satisfies(published, `/${'a'.repeat(2048)}`)).toBe(false);
    // 2,048 code points of astral characters are 4,096 UTF-16 units: still valid.
    const astral = `/${'\u{1f600}'.repeat(2047)}`;
    expect(Array.from(astral)).toHaveLength(2048);
    expect(CmsPreviewRouteSchema.safeParse(astral).success).toBe(true);
    expect(satisfies(published, astral)).toBe(true);
    expect(satisfies(published, `${astral}\u{1f600}`)).toBe(false);
    expect(CmsPreviewRouteSchema.safeParse(`${astral}\u{1f600}`).success).toBe(
      false,
    );
  });

  it('agrees with the runtime over enumerated normalization cases', () => {
    const values = [
      '/',
      '/a',
      '/a/',
      '/a/b',
      '/a/b/',
      '/music/artist/spring-2026-tour',
      '/.hidden',
      '/a/.hidden',
      '/a./b',
      '/...',
      '/a/.../b',
      '/\u{e9}/\u{fc}',
      '/\u{1f600}',
      '//evil',
      '//',
      '///',
      '/a//b',
      '/a///b',
      '//a/b',
      '',
      'a',
      'a/b',
      'https://evil.example/',
      'http:/x',
      '\\evil',
      '/a\\b',
      '/a?x=1',
      '/a#frag',
      '/?',
      '/#',
      '/.',
      '/..',
      '/./a',
      '/../a',
      '/a/.',
      '/a/..',
      '/a/./b',
      '/a/../b',
      '/%2e',
      '/%2E',
      '/%2e%2e/x',
      '/a%2fb',
      '/a%2Fb',
      '/a%5cb',
      '/a%5Cb',
      '/a%20b',
      '/a%2',
      '/a%2g',
      '/a\u0000b',
      '/a\u001fb',
      '/a\u007fb',
      '/a\u0080b',
      '/a\u009fb',
      '/a\u{a0}b',
      '/a\tb',
      '/a\nb',
      '/a\rb',
      '/a b',
      '/a\u{2028}b',
      '/a\u{202e}b',
      '/a\u{2028}%2e',
      '/a\u{2029}%2F/x',
      '/\u{2028}%5c',
      '/a\u{2028}/../b',
      '/a\u{2028}/./b',
    ];
    agree(published, CmsPreviewRouteSchema, values);
  });

  it('agrees with the runtime over a deterministic generated corpus of risky characters', () => {
    const alphabet = [
      '/',
      '/',
      '.',
      '.',
      'a',
      'b',
      '%',
      '2',
      'e',
      'F',
      '5',
      'c',
      'C',
      '\\',
      '?',
      '#',
      '\u0000',
      '\u0085',
      '\u007f',
      ' ',
      '-',
      '\u{e9}',
      '\u{1f600}',
    ];
    const next = generator(2_024);
    const values: string[] = [];
    for (let index = 0; index < 20_000; index += 1) {
      const length = next(9);
      let value = next(5) === 0 ? '' : '/';
      for (let position = 0; position < length; position += 1)
        value += alphabet[next(alphabet.length)];
      values.push(value);
    }
    agree(published, CmsPreviewRouteSchema, values);
  }, 60_000);
});

describe('[P2-S11-AC-011] decision reason publishes 2000 code points, NFC and its forbidden characters', () => {
  const published = memberOf(
    bodyOf('/api/v1/cms/reviews/{reviewId}/decision'),
    'reason',
  );

  it('bounds the reason at 1-2000 code points and states NFC', () => {
    expect(published.type).toBe('string');
    expect(published.minLength).toBe(1);
    expect(published.maxLength).toBe(2000);
    expect(published['x-unicode-normalization']).toBe('NFC');
  });

  it('agrees with the runtime over limits, normalization, control and bidi characters and markup', () => {
    const emoji = (count: number): string => '\u{1f600}'.repeat(count);
    const values = [
      '',
      'a',
      'a'.repeat(2000),
      'a'.repeat(2001),
      emoji(2000),
      emoji(2001),
      'e\u{301}',
      '\u{e9}',
      'A\u{30a}',
      '\u{c5}',
      'ok reason',
      'line\nbreak',
      'tab\there',
      'del\u007f',
      'c1\u0085',
      'c1\u009f',
      'nbsp\u{a0}ok',
      'ls\u{2028}x',
      'ps\u{2029}x',
      'lrm\u{200e}x',
      'rlm\u{200f}x',
      'alm\u{61c}x',
      'bidi\u{202a}x',
      'bidi\u{202e}x',
      'iso\u{2066}x',
      'iso\u{2069}x',
      'zwj\u{200d}ok',
      '<b>',
      'a>b',
      'curly{',
      '}curly',
      'a'.repeat(1999) + '\u{1f600}',
      'a'.repeat(2000) + '\u{1f600}',
    ];
    agree(published, DecisionReasonSchema, values);
  });
});

describe('[P2-S11-AC-067] assignment reason publishes 256 code points and NFC on both branches', () => {
  const body = bodyOf('/api/v1/cms/reviews/{reviewId}/assignments');
  const branches = (resolve(body).oneOf as readonly JsonObject[]).map(resolve);

  it('is a discriminated oneOf of exactly the create and the revoke branch', () => {
    expect(branches).toHaveLength(2);
    expect(branches.map((branch) => resolve(branch).type)).toEqual([
      'object',
      'object',
    ]);
    const actions = branches.map(
      (branch) => (memberOf(branch, 'action') as JsonObject).const,
    );
    expect(actions).toEqual(['create', 'revoke']);
  });

  it('declares exactly the documented properties, required members and strictness per branch', () => {
    const [create, revoke] = branches as [JsonObject, JsonObject];
    expect(Object.keys(create.properties as JsonObject)).toEqual([
      'action',
      'expectedVersion',
      'reviewerPersonId',
      'expiresAt',
      'reason',
    ]);
    expect(create.required).toEqual([
      'action',
      'expectedVersion',
      'reviewerPersonId',
      'expiresAt',
    ]);
    expect(create.additionalProperties).toBe(false);
    expect(Object.keys(revoke.properties as JsonObject)).toEqual([
      'action',
      'expectedVersion',
      'assignmentId',
      'reason',
    ]);
    expect(revoke.required).toEqual([
      'action',
      'expectedVersion',
      'assignmentId',
    ]);
    expect(revoke.additionalProperties).toBe(false);
  });

  it('constrains the reason of each branch to 1-256 code points in NFC, and the runtime agrees', () => {
    const emoji = (count: number): string => '\u{1f600}'.repeat(count);
    const values = [
      '',
      'a',
      'a'.repeat(256),
      'a'.repeat(257),
      emoji(256),
      emoji(257),
      'e\u{301}',
      '\u{e9}',
      'Covers the legal disclosure slot.',
      '<script>',
      'line\nbreak',
    ];
    for (const branch of branches) {
      const reason = memberOf(branch, 'reason');
      expect(reason.type).toBe('string');
      expect(reason.minLength).toBe(1);
      expect(reason.maxLength).toBe(256);
      expect(reason['x-unicode-normalization']).toBe('NFC');
      expect(reason.pattern).toBeUndefined();
      agree(reason, ReviewAssignmentReasonSchema, values);
    }
  });
});

describe('[P2-S11-AC-005][P2-S11-AC-049] a retryable 503 carries Retry-After and the rate headers', () => {
  const retryable = [
    ['POST', '/api/v1/cms/entries/{entryId}/reviews'],
    ['POST', '/api/v1/cms/reviews/{reviewId}/decision'],
    ['POST', '/api/v1/cms/publication-schedules'],
    ['POST', '/api/v1/cms/previews'],
    ['POST', '/api/v1/cms/publications'],
    ['GET', '/api/v1/cms/entries/{entryId}/workflow'],
    ['GET', '/api/v1/cms/reviews/{reviewId}'],
    ['GET', '/api/v1/cms/reviews'],
    ['POST', '/api/v1/cms/reviews/{reviewId}/assignments'],
  ] as const;
  const headerNames = (path: string, method: string, status: string) => {
    const response = (
      document.paths[path]?.[method.toLowerCase()]?.responses as JsonObject
    )[status] as JsonObject | undefined;
    return Object.keys((response?.headers as JsonObject | undefined) ?? {});
  };

  it('publishes Retry-After with the three RateLimit headers on 429 and on 503 of every Slice 11 route', () => {
    const expected = [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ];
    for (const [method, path] of retryable)
      for (const status of ['429', '503'])
        expect(
          [...headerNames(path, method, status)].sort(),
          `${method} ${path} ${status}`,
        ).toEqual(expected);
  });

  it('publishes no retry header on a 500 or a 502, which are never retryable', () => {
    for (const [method, path] of retryable)
      for (const status of ['500', '502'])
        expect(
          headerNames(path, method, status),
          `${method} ${path} ${status}`,
        ).toEqual([]);
  });
});
