import { describe, expect, it } from 'vitest';

import {
  Bcp47Schema,
  BoundedEntryValuesSchema,
  ChangedPathsSchema,
  CmsEditorialCapabilityModeSchema,
  EntryRevisionHeadersSchema,
  EntryRevisionPathParamsSchema,
  EntryRevisionRequestSchema,
  EntryRevisionResourceSchema,
  EntryRevisionStateSchema,
  FieldPointerSchema,
  JsonPointerSchema,
  cmsEditorialCapabilitiesSatisfied,
  fieldIdOfPointer,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const instant = '2026-09-26T00:00:00Z';
const contentHash = 'a'.repeat(64);

/** `nest(0)` is one object level, so `nest(n)` carries JSON depth `n + 1`. */
const nest = (levels: number): Record<string, unknown> =>
  levels === 0 ? { leaf: 1 } : { child: nest(levels - 1) };

const validRequest = {
  entryId: uuid,
  baseRevision: '3',
  changedPaths: [`/fields/${uuid2}`],
  values: { [uuid2]: nest(6) },
  locale: 'en-US',
  expectedVersion: '7',
} as const;

const validResource = {
  id: uuid,
  version: '4',
  entryVersion: '9',
  createdAt: instant,
  updatedAt: instant,
  state: 'draft',
  entryId: uuid,
  revisionNumber: '4',
  schemaVersionId: uuid2,
  templateVersionId: null,
  taxonomyVersionIds: [uuid2],
  locale: 'en-US',
  contentHash,
  parentRevisionIds: [uuid2],
  validationState: 'valid',
  conflictId: null,
} as const;

describe('cms editorial primitives', () => {
  it('accepts exactly the 256-character JSON Pointer grammar', () => {
    expect(JsonPointerSchema.safeParse('/fields/title').success).toBe(true);
    expect(JsonPointerSchema.safeParse(`/${'a'.repeat(255)}`).success).toBe(
      true,
    );
    expect(JsonPointerSchema.safeParse(`/${'a'.repeat(256)}`).success).toBe(
      false,
    );
    expect(JsonPointerSchema.safeParse('fields/title').success).toBe(false);
    expect(JsonPointerSchema.safeParse('').success).toBe(false);
    expect(JsonPointerSchema.safeParse('/bad\u0001pointer').success).toBe(
      false,
    );
  });

  it('bounds JSON Pointers by UTF-16 code units, matching the unflagged spec regex', () => {
    // A surrogate pair occupies two UTF-16 units, so each astral character
    // consumes two units and one ASCII character consumes one. A code-point
    // count would accept far longer pointers; the spec regex carries no `u`
    // flag, so it counts code units.
    const astral127 = `/${'\u{1D11E}'.repeat(127)}`;
    const astral128 = `/${'\u{1D11E}'.repeat(128)}`;
    const astralAtBound = `/${'\u{1D11E}'.repeat(127)}a`;
    expect(astral127.length).toBe(255);
    expect(astral128.length).toBe(257);
    expect(astralAtBound.length).toBe(256);
    expect(JsonPointerSchema.safeParse('/\u{1D11E}').success).toBe(true);
    expect(JsonPointerSchema.safeParse(astral127).success).toBe(true);
    expect(JsonPointerSchema.safeParse(astralAtBound).success).toBe(true);
    expect(JsonPointerSchema.safeParse(astral128).success).toBe(false);
    expect(JsonPointerSchema.safeParse(`${astralAtBound}a`).success).toBe(
      false,
    );
  });

  it('excludes only C0 controls, matching the unflagged spec character class', () => {
    expect(JsonPointerSchema.safeParse('/\u0000').success).toBe(false);
    expect(JsonPointerSchema.safeParse('/\u001f').success).toBe(false);
    expect(JsonPointerSchema.safeParse('/\u007f').success).toBe(true);
    expect(JsonPointerSchema.safeParse('/\u0085').success).toBe(true);
  });

  it('accepts BCP 47 subtags and rejects malformed locales', () => {
    expect(Bcp47Schema.safeParse('en').success).toBe(true);
    expect(Bcp47Schema.safeParse('en-US').success).toBe(true);
    expect(Bcp47Schema.safeParse('zh-Hant-TW').success).toBe(true);
    expect(Bcp47Schema.safeParse('e').success).toBe(false);
    expect(Bcp47Schema.safeParse('en_US').success).toBe(false);
    expect(Bcp47Schema.safeParse('english-').success).toBe(false);
  });

  it('bounds an editorial locale at 35 characters: 35 is accepted and 36 refused', () => {
    // en + three 8-letter subtags + one 5-letter subtag = 2 + 27 + 6 = 35.
    const at35 = 'en' + '-abcdefgh'.repeat(3) + '-abcde';
    expect(at35).toHaveLength(35);
    expect(Bcp47Schema.safeParse(at35).success).toBe(true);
    expect(Bcp47Schema.safeParse(at35 + 'f').success).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        locale: at35 + 'f',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({ ...validRequest, locale: at35 })
        .success,
    ).toBe(true);
  });

  const fieldPointer = (index: number): string =>
    `/fields/123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`;

  it('requires 1-128 unique /fields/{stableFieldId} pointers', () => {
    expect(
      ChangedPathsSchema.safeParse([fieldPointer(1), fieldPointer(2)]).success,
    ).toBe(true);
    expect(ChangedPathsSchema.safeParse([]).success).toBe(false);
    expect(
      ChangedPathsSchema.safeParse([fieldPointer(1), fieldPointer(1)]).success,
    ).toBe(false);
    expect(ChangedPathsSchema.safeParse(['not-a-pointer']).success).toBe(false);
    expect(
      ChangedPathsSchema.safeParse(
        Array.from({ length: 128 }, (_, index) => fieldPointer(index)),
      ).success,
    ).toBe(true);
    expect(
      ChangedPathsSchema.safeParse(
        Array.from({ length: 129 }, (_, index) => fieldPointer(index)),
      ).success,
    ).toBe(false);
  });

  it('refuses every pointer that is not /fields/{lowercase uuid}, as SQL does', () => {
    for (const bad of [
      '/a',
      '/fields/title',
      '/fields/',
      '/fields',
      '/blocks/hero',
      '/relations/123e4567-e89b-42d3-a456-426614174000/' + 'a'.repeat(64),
      '/fields/123E4567-E89B-42D3-A456-426614174000',
      '/fields/123e4567-e89b-42d3-a456-42661417400',
      '/fields/123e4567-e89b-42d3-a456-426614174000/extra',
      '/fields/123e4567-e89b-42d3-a456-426614174000 ',
      '/fields/123e4567-e89b-12d3-c456-426614174000',
      'fields/123e4567-e89b-42d3-a456-426614174000',
    ])
      expect(ChangedPathsSchema.safeParse([bad]).success, bad).toBe(false);
    expect(FieldPointerSchema.safeParse(fieldPointer(7)).success).toBe(true);
    expect(fieldIdOfPointer(fieldPointer(7))).toBe(
      '123e4567-e89b-42d3-a456-000000000007',
    );
  });

  it('bounds entry values by UUID keys, key count, and JSON depth', () => {
    expect(
      BoundedEntryValuesSchema.safeParse({ [uuid]: nest(6) }).success,
    ).toBe(true);
    expect(
      BoundedEntryValuesSchema.safeParse({ [uuid]: nest(7) }).success,
    ).toBe(false);
    expect(BoundedEntryValuesSchema.safeParse({ [uuid]: {} }).success).toBe(
      true,
    );
    expect(BoundedEntryValuesSchema.safeParse({ [uuid]: [1, 2] }).success).toBe(
      true,
    );
    expect(
      BoundedEntryValuesSchema.safeParse({ 'not-a-uuid': 1 }).success,
    ).toBe(false);
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [
        `123e4567-e89b-42d3-a456-42661417${String(index).padStart(4, '0')}`,
        1,
      ]),
    );
    expect(BoundedEntryValuesSchema.safeParse(tooManyKeys).success).toBe(false);
  });

  it('bounds serialized entry values to 256 KiB of UTF-8, not UTF-16 units', () => {
    const maxBytes = 262_144;
    const emptyBytes = new TextEncoder().encode(
      JSON.stringify({ [uuid]: '' }),
    ).byteLength;
    const exactLimit = {
      [uuid]: `${'a'.repeat(maxBytes - emptyBytes - 4)}🎵`,
    };
    expect(
      new TextEncoder().encode(JSON.stringify(exactLimit)).byteLength,
    ).toBe(maxBytes);
    expect(BoundedEntryValuesSchema.safeParse(exactLimit).success).toBe(true);
    const overLimit = { [uuid]: `${exactLimit[uuid]}a` };
    const over = BoundedEntryValuesSchema.safeParse(overLimit);
    expect(over.success).toBe(false);
    if (!over.success)
      expect(over.error.issues.map((issue) => issue.message)).toContain(
        'entry_values_max_bytes',
      );
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        values: overLimit,
      }).success,
    ).toBe(false);
  });

  it('bounds every nested object and array to 128 members', () => {
    const object128 = Object.fromEntries(
      Array.from({ length: 128 }, (_, index) => [`key${index}`, index]),
    );
    const object129 = { ...object128, key128: 128 };
    expect(
      BoundedEntryValuesSchema.safeParse({ [uuid]: object128 }).success,
    ).toBe(true);
    expect(
      BoundedEntryValuesSchema.safeParse({ [uuid]: object129 }).success,
    ).toBe(false);
    expect(
      BoundedEntryValuesSchema.safeParse({ [uuid]: Array(128).fill(0) })
        .success,
    ).toBe(true);
    expect(
      BoundedEntryValuesSchema.safeParse({ [uuid]: Array(129).fill(0) })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        values: { [uuid]: { nested: Array(129).fill(0) } },
      }).success,
    ).toBe(false);
  });

  it('locks the closed revision state enum', () => {
    expect(EntryRevisionStateSchema.options).toEqual([
      'draft',
      'submitted',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ]);
    expect(EntryRevisionStateSchema.safeParse('published').success).toBe(true);
    expect(EntryRevisionStateSchema.safeParse('archived').success).toBe(false);
  });
});

describe('cms editorial request shapes', () => {
  it('binds exactly one UUID path parameter', () => {
    expect(
      EntryRevisionPathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(true);
    expect(
      EntryRevisionPathParamsSchema.safeParse({ entryId: 'nope' }).success,
    ).toBe(false);
    expect(EntryRevisionPathParamsSchema.safeParse({}).success).toBe(false);
    expect(
      EntryRevisionPathParamsSchema.safeParse({ entryId: uuid, extra: 1 })
        .success,
    ).toBe(false);
  });

  it('requires JSON, an idempotency key, and an exact strong If-Match', () => {
    const headers = {
      contentType: 'application/json',
      idempotencyKey: 'abcdefgh',
      ifMatch: '"2"',
    };
    expect(EntryRevisionHeadersSchema.safeParse(headers).success).toBe(true);
    expect(
      EntryRevisionHeadersSchema.safeParse({
        ...headers,
        contentType: 'text/plain',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({
        ...headers,
        idempotencyKey: 'abcdefg',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({
        ...headers,
        idempotencyKey: ' abcdefgh',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({ ...headers, ifMatch: 'W/"2"' })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({ ...headers, ifMatch: '2' })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({ ...headers, ifMatch: '"0"' })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({
        ...headers,
        ifMatch: '"9223372036854775808"',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({ ...headers, extra: 'x' }).success,
    ).toBe(false);
    expect(
      EntryRevisionHeadersSchema.safeParse({
        contentType: 'application/json',
        ifMatch: '"2"',
      }).success,
    ).toBe(false);
  });

  it('accepts the canonical revision body and rejects unknown keys', () => {
    expect(EntryRevisionRequestSchema.safeParse(validRequest).success).toBe(
      true,
    );
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it('rejects zero, leading-zero, and overflow version assertions', () => {
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        baseRevision: '0',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        baseRevision: '01',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        expectedVersion: '9223372036854775808',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({ ...validRequest, entryId: 'nope' })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({ ...validRequest, locale: 'e' })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionRequestSchema.safeParse({
        ...validRequest,
        changedPaths: [],
      }).success,
    ).toBe(false);
  });
});

describe('cms editorial success resource', () => {
  it('exposes version plus the exact closed revision shape', () => {
    expect(EntryRevisionResourceSchema.safeParse(validResource).success).toBe(
      true,
    );
    expect(validResource.version).toBe('4');
    expect(
      EntryRevisionResourceSchema.safeParse({ ...validResource, unexpected: 1 })
        .success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        state: 'archived',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        validationState: 'maybe',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        contentHash: 'short',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        taxonomyVersionIds: Array.from({ length: 65 }, () => uuid),
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        parentRevisionIds: [uuid, uuid, uuid],
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({ ...validResource, version: '0' })
        .success,
    ).toBe(false);
  });

  it('carries the committed entry version beside the revision version: entryVersion is the only next CAS', () => {
    // `version` is the immutable revision snapshot's own envelope version; the
    // aggregate version a client must send next is `entryVersion`, so the two are
    // distinct members and entryVersion is mandatory (the audit's CAS ambiguity).
    const { entryVersion: _entryVersion, ...withoutEntryVersion } =
      validResource;
    void _entryVersion;
    expect(
      EntryRevisionResourceSchema.safeParse(withoutEntryVersion).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        entryVersion: '0',
      }).success,
    ).toBe(false);
    expect(
      EntryRevisionResourceSchema.safeParse({
        ...validResource,
        entryVersion: '01',
      }).success,
    ).toBe(false);
    const parsed = EntryRevisionResourceSchema.parse(validResource);
    expect(parsed.version).toBe('4');
    expect(parsed.entryVersion).toBe('9');
  });

  it('carries one strict resource meta with no duplicated contentHash', () => {
    expect(
      Object.keys(EntryRevisionResourceSchema.parse(validResource)).sort(),
    ).toEqual([
      'conflictId',
      'contentHash',
      'createdAt',
      'entryId',
      'entryVersion',
      'id',
      'locale',
      'parentRevisionIds',
      'revisionNumber',
      'schemaVersionId',
      'state',
      'taxonomyVersionIds',
      'templateVersionId',
      'updatedAt',
      'validationState',
      'version',
    ]);
  });
});

describe('cms editorial capability gate', () => {
  const authorOrEditor = ['cms.author', 'cms.editor'] as const;

  it('locks the capability mode vocabulary', () => {
    expect(CmsEditorialCapabilityModeSchema.options).toEqual([
      'any_of',
      'all_of',
    ]);
  });

  it('treats CMS-03B-01 as any-of author or editor', () => {
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'any_of', [
        'cms.author',
      ]),
    ).toBe(true);
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'any_of', [
        'cms.editor',
      ]),
    ).toBe(true);
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'any_of', [
        'cms.author',
        'cms.editor',
      ]),
    ).toBe(true);
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'any_of', []),
    ).toBe(false);
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'any_of', [
        'cms.publisher',
      ]),
    ).toBe(false);
  });

  it('requires every capability under all_of and fails closed on empty requirements', () => {
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'all_of', [
        'cms.author',
      ]),
    ).toBe(false);
    expect(
      cmsEditorialCapabilitiesSatisfied(authorOrEditor, 'all_of', [
        'cms.author',
        'cms.editor',
      ]),
    ).toBe(true);
    expect(cmsEditorialCapabilitiesSatisfied([], 'any_of', [])).toBe(false);
    expect(cmsEditorialCapabilitiesSatisfied([], 'all_of', [])).toBe(false);
  });
});
