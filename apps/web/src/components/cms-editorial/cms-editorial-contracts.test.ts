import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_CONTRACTS_SOURCE,
  CmsEditorialBoundedEntryValuesSchema,
  CmsEditorialChangedPathsSchema,
  CmsEditorialEntryRevisionRequestSchema,
  CmsEditorialEntryRevisionResourceSchema,
  CmsEditorialJsonPointerSchema,
  CmsEditorialRevisionHistoryPageSchema,
  CmsEditorialRevisionHistoryQuerySchema,
  CmsEditorialVersionSchema,
} from './cms-editorial-contracts';
import { safeCmsEditorialErrorMessage } from './cms-editorial-types';

let uuidCounter = 0;

/**
 * Distinct, format-valid UUIDs. The web tsconfig carries no Node types, so the
 * fixtures avoid `node:crypto`; the contracts only require the UUID shape.
 */
const uuid = (): string => {
  uuidCounter += 1;
  return (
    '018f0c45-73fe-7dc2-9c09-' + uuidCounter.toString(16).padStart(12, '0')
  );
};

const I64_MAX = '9223372036854775807';

const validRequest = () => ({
  entryId: uuid(),
  baseRevision: '3',
  changedPaths: ['/values/' + uuid()],
  values: { [uuid()]: 'body text' },
  locale: 'en-US',
  expectedVersion: '12',
});

describe('cms-editorial contracts source anchor', () => {
  it('names the shared module that will replace the interim mirror', () => {
    expect(CMS_EDITORIAL_CONTRACTS_SOURCE.source).toBe(
      'packages/contracts/src/cms-editorial',
    );
    expect(CMS_EDITORIAL_CONTRACTS_SOURCE.interim).toBe(
      'apps/web/src/components/cms-editorial/cms-editorial-contracts.ts',
    );
  });

  it('records which shared primitives are reused and which stay local', () => {
    expect(CMS_EDITORIAL_CONTRACTS_SOURCE.reusedShared).toContain(
      'ChangedPathsSchema',
    );
    expect(CMS_EDITORIAL_CONTRACTS_SOURCE.browserLocalGuards).toEqual([
      'CmsEditorialVersionSchema',
    ]);
  });
});

describe('CmsEditorialVersionSchema (BE03b CAS version)', () => {
  it('accepts canonical positive decimal versions up to i64 max', () => {
    for (const version of ['1', '12', '9', I64_MAX]) {
      expect(CmsEditorialVersionSchema.safeParse(version).success).toBe(true);
    }
  });

  it('rejects zero, leading zeros, fractions, and non-decimal text', () => {
    for (const version of ['0', '01', '1.5', '-1', '', 'abc', '1 ']) {
      expect(CmsEditorialVersionSchema.safeParse(version).success).toBe(false);
    }
  });

  it('rejects a value above the signed 64-bit ceiling', () => {
    expect(
      CmsEditorialVersionSchema.safeParse('9223372036854775808').success,
    ).toBe(false);
  });

  it('fails closed instead of throwing on a non-numeric version', () => {
    for (const version of ['1.5', 'abc', '1e3', '+1', '\u0660']) {
      expect(() => CmsEditorialVersionSchema.safeParse(version)).not.toThrow();
      expect(CmsEditorialVersionSchema.safeParse(version).success).toBe(false);
    }
  });
});

describe('CmsEditorialJsonPointerSchema', () => {
  it('accepts an absolute pointer', () => {
    expect(CmsEditorialJsonPointerSchema.safeParse('/values/abc').success).toBe(
      true,
    );
    expect(CmsEditorialJsonPointerSchema.safeParse('/').success).toBe(true);
  });

  it('rejects a relative pointer, empty string, and control characters', () => {
    for (const pointer of ['values/abc', '', '/a\u0001b', '/a\nb']) {
      expect(CmsEditorialJsonPointerSchema.safeParse(pointer).success).toBe(
        false,
      );
    }
  });

  it('rejects a pointer longer than 256 characters', () => {
    const within = '/' + 'a'.repeat(255);
    expect(CmsEditorialJsonPointerSchema.safeParse(within).success).toBe(true);
    expect(CmsEditorialJsonPointerSchema.safeParse(within + 'a').success).toBe(
      false,
    );
  });
});

describe('CmsEditorialChangedPathsSchema (BE03b:172 1-128 unique)', () => {
  it('accepts a single pointer and a full set of 128', () => {
    expect(CmsEditorialChangedPathsSchema.safeParse(['/a']).success).toBe(true);
    const many = Array.from({ length: 128 }, (_, index) => '/p' + index);
    expect(CmsEditorialChangedPathsSchema.safeParse(many).success).toBe(true);
  });

  it('rejects an empty list and a list of 129', () => {
    expect(CmsEditorialChangedPathsSchema.safeParse([]).success).toBe(false);
    const tooMany = Array.from({ length: 129 }, (_, index) => '/p' + index);
    expect(CmsEditorialChangedPathsSchema.safeParse(tooMany).success).toBe(
      false,
    );
  });

  it('rejects duplicate pointers so a field is not saved twice', () => {
    expect(CmsEditorialChangedPathsSchema.safeParse(['/a', '/a']).success).toBe(
      false,
    );
  });
});

describe('CmsEditorialBoundedEntryValuesSchema (BE03b:173)', () => {
  it('accepts stable UUID field ids', () => {
    expect(
      CmsEditorialBoundedEntryValuesSchema.safeParse({ [uuid()]: 1 }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID field key', () => {
    expect(
      CmsEditorialBoundedEntryValuesSchema.safeParse({ title: 'x' }).success,
    ).toBe(false);
  });

  it('rejects more than 128 keys', () => {
    const atLimit: Record<string, number> = {};
    for (let index = 0; index < 128; index += 1) atLimit[uuid()] = index;
    expect(
      CmsEditorialBoundedEntryValuesSchema.safeParse(atLimit).success,
    ).toBe(true);
    atLimit[uuid()] = 129;
    expect(
      CmsEditorialBoundedEntryValuesSchema.safeParse(atLimit).success,
    ).toBe(false);
  });

  it('rejects values nested deeper than the JSON depth limit', () => {
    const nested = (depth: number): unknown =>
      depth === 0 ? 'leaf' : { child: nested(depth - 1) };
    const shallow = { [uuid()]: nested(7) };
    expect(
      CmsEditorialBoundedEntryValuesSchema.safeParse(shallow).success,
    ).toBe(true);
    const deep = { [uuid()]: nested(9) };
    expect(CmsEditorialBoundedEntryValuesSchema.safeParse(deep).success).toBe(
      false,
    );
  });
});

describe('CmsEditorialEntryRevisionRequestSchema (CMS-03B-01 CAS body)', () => {
  it('accepts the locked request shape', () => {
    expect(
      CmsEditorialEntryRevisionRequestSchema.safeParse(validRequest()).success,
    ).toBe(true);
  });

  it('rejects unknown keys instead of silently forwarding them', () => {
    const request = { ...validRequest(), published: true };
    expect(
      CmsEditorialEntryRevisionRequestSchema.safeParse(request).success,
    ).toBe(false);
  });

  it('requires the base and expected versions for optimistic concurrency', () => {
    const withoutBase: Record<string, unknown> = { ...validRequest() };
    delete withoutBase.baseRevision;
    expect(
      CmsEditorialEntryRevisionRequestSchema.safeParse(withoutBase).success,
    ).toBe(false);
    const withoutExpected: Record<string, unknown> = { ...validRequest() };
    delete withoutExpected.expectedVersion;
    expect(
      CmsEditorialEntryRevisionRequestSchema.safeParse(withoutExpected).success,
    ).toBe(false);
  });

  it('refuses an empty changed-path set', () => {
    const request = { ...validRequest(), changedPaths: [] };
    expect(
      CmsEditorialEntryRevisionRequestSchema.safeParse(request).success,
    ).toBe(false);
  });
});

describe('CmsEditorialEntryRevisionResourceSchema (201 response)', () => {
  const resource = () => ({
    id: uuid(),
    version: '13',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
    state: 'draft',
    entryId: uuid(),
    revisionNumber: '4',
    schemaVersionId: uuid(),
    templateVersionId: null,
    taxonomyVersionIds: [],
    locale: 'en-US',
    contentHash: 'a'.repeat(64),
    parentRevisionIds: [],
    validationState: 'valid',
    conflictId: null,
  });

  it('accepts a draft revision with nullable provenance fields', () => {
    expect(
      CmsEditorialEntryRevisionResourceSchema.safeParse(resource()).success,
    ).toBe(true);
  });

  it('rejects a revision state outside the locked enum', () => {
    expect(
      CmsEditorialEntryRevisionResourceSchema.safeParse({
        ...resource(),
        state: 'archived',
      }).success,
    ).toBe(false);
  });

  it('caps taxonomy versions at 64 and parent revisions at 2', () => {
    expect(
      CmsEditorialEntryRevisionResourceSchema.safeParse({
        ...resource(),
        taxonomyVersionIds: Array.from({ length: 65 }, () => uuid()),
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialEntryRevisionResourceSchema.safeParse({
        ...resource(),
        parentRevisionIds: Array.from({ length: 3 }, () => uuid()),
      }).success,
    ).toBe(false);
  });

  it('requires a full 64-character lowercase hex content hash', () => {
    expect(
      CmsEditorialEntryRevisionResourceSchema.safeParse({
        ...resource(),
        contentHash: 'A'.repeat(64),
      }).success,
    ).toBe(false);
  });
});

describe('revision history query and page (CMS-03B-03)', () => {
  it('defaults the page size to 25 and bounds it to 50', () => {
    const parsed = CmsEditorialRevisionHistoryQuerySchema.safeParse({
      entryId: uuid(),
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.limit : null).toBe(25);
    expect(
      CmsEditorialRevisionHistoryQuerySchema.safeParse({
        entryId: uuid(),
        limit: 51,
      }).success,
    ).toBe(false);
    expect(
      CmsEditorialRevisionHistoryQuerySchema.safeParse({
        entryId: uuid(),
        limit: 0,
      }).success,
    ).toBe(false);
  });

  it('accepts a page with no comparison', () => {
    expect(
      CmsEditorialRevisionHistoryPageSchema.safeParse({
        items: [],
        nextCursor: null,
        pageVersion: '7',
        compare: null,
      }).success,
    ).toBe(true);
  });

  it('bounds a comparison change list to 512 entries', () => {
    const change = {
      path: '/a',
      kind: 'changed',
      leftHash: null,
      rightHash: null,
    };
    expect(
      CmsEditorialRevisionHistoryPageSchema.safeParse({
        items: [],
        nextCursor: null,
        pageVersion: '7',
        compare: {
          leftRevisionId: uuid(),
          rightRevisionId: uuid(),
          changes: Array.from({ length: 513 }, () => change),
        },
      }).success,
    ).toBe(false);
  });
});

describe('safeCmsEditorialErrorMessage', () => {
  it('returns the exact approved copy for a known code', () => {
    expect(safeCmsEditorialErrorMessage('CONFLICT')).toBe(
      'This entry changed elsewhere. Review the current version before saving again.',
    );
    expect(safeCmsEditorialErrorMessage('FORBIDDEN')).toContain(
      'Your unsent edits are kept in this browser only.',
    );
  });

  it('falls back to internal copy and never echoes the raw code', () => {
    const message = safeCmsEditorialErrorMessage('SOMETHING_LEAKY_42');
    expect(message).toBe(
      'Saving failed unexpectedly. Check the current version before retrying.',
    );
    expect(message).not.toContain('SOMETHING_LEAKY_42');
  });
});
