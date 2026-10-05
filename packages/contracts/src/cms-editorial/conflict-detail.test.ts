import { describe, expect, it } from 'vitest';

import {
  ConflictDetailPathParamsSchema,
  ConflictDetailPathSchema,
  ConflictDetailQuerySchema,
  ConflictDetailResourceSchema,
  ConflictDetailSideSchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const pointer = `/fields/${uuid3}`;

const authoredSide = {
  value: { title: 'Hello' },
  provenance: 'authored',
  valueHash: hash,
} as const;

const missingSide = {
  value: null,
  provenance: 'missing',
  valueHash: null,
} as const;

const validPath = {
  path: pointer,
  base: authoredSide,
  theirs: missingSide,
  yours: { value: 1, provenance: 'explicit_null', valueHash: hash },
} as const;

const validResource = {
  conflict: {
    id: uuid,
    version: '4',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    changedPaths: [pointer],
    conflictHash: hash,
  },
  entry: { id: uuid2, version: '2', createdAt: instant, updatedAt: instant },
  base: {
    revisionId: uuid,
    revisionNumber: '3',
    schemaVersionId: uuid2,
    contentHash: hash,
  },
  theirs: {
    revisionId: uuid2,
    revisionNumber: '4',
    schemaVersionId: uuid3,
    contentHash: hash,
  },
  yours: { source: 'revision', revisionId: uuid3, contentHash: hash },
  paths: [validPath],
  resolvedRevisionId: null,
} as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  value as Record<string, unknown>;

/** Deep clone so an injected key can never leak into the shared fixture. */
const cloneResource = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(validResource)) as Record<string, unknown>;

const pathAt = (resource: Record<string, unknown>, index: number): Record<
  string,
  unknown
> => asRecord((resource.paths as unknown[])[index]);

/** N complete divergent-path rows, so only the count bound is under test. */
const manyPaths = (count: number): typeof validPath[] =>
  Array.from({ length: count }, (_, index) => ({
    ...validPath,
    path: `/p/${index}`,
  }));

describe('conflict detail addressing', () => {
  it('accepts an empty query and rejects every unknown query key', () => {
    expect(ConflictDetailQuerySchema.safeParse({}).success).toBe(true);
    expect(
      ConflictDetailQuerySchema.safeParse({ include: 'values' }).success,
    ).toBe(false);
  });

  it('binds exactly the entry and conflict UUID path parameters', () => {
    expect(
      ConflictDetailPathParamsSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
      }).success,
    ).toBe(true);
    expect(
      ConflictDetailPathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(false);
    expect(
      ConflictDetailPathParamsSchema.safeParse({
        entryId: uuid,
        conflictId: 'nope',
      }).success,
    ).toBe(false);
    expect(
      ConflictDetailPathParamsSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
        extra: 1,
      }).success,
    ).toBe(false);
  });
});

describe('conflict detail side', () => {
  it('accepts a nullable value, the closed provenance, and a nullable hash', () => {
    expect(ConflictDetailSideSchema.safeParse(authoredSide).success).toBe(true);
    expect(ConflictDetailSideSchema.safeParse(missingSide).success).toBe(true);
  });

  it('locks the provenance vocabulary', () => {
    for (const provenance of [
      'authored',
      'default',
      'inherited',
      'localized_fallback',
      'explicit_null',
      'missing',
    ])
      expect(
        ConflictDetailSideSchema.safeParse({ ...authoredSide, provenance })
          .success,
      ).toBe(true);
    expect(
      ConflictDetailSideSchema.safeParse({
        ...authoredSide,
        provenance: 'observed',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key or a missing key', () => {
    expect(
      ConflictDetailSideSchema.safeParse({ ...authoredSide, locale: 'en-US' })
        .success,
    ).toBe(false);
    const withoutHash = { ...authoredSide } as Record<string, unknown>;
    delete withoutHash.valueHash;
    expect(ConflictDetailSideSchema.safeParse(withoutHash).success).toBe(false);
  });
});

describe('conflict detail path', () => {
  it('accepts a pointer with all three conflict sides', () => {
    expect(ConflictDetailPathSchema.safeParse(validPath).success).toBe(true);
  });

  it('requires every side and a valid JSON Pointer', () => {
    expect(
      ConflictDetailPathSchema.safeParse({ ...validPath, path: 'fields/1' })
        .success,
    ).toBe(false);
    for (const side of ['base', 'theirs', 'yours'] as const) {
      const missing = { ...validPath } as Record<string, unknown>;
      delete missing[side];
      expect(ConflictDetailPathSchema.safeParse(missing).success).toBe(false);
    }
  });

  it('rejects unknown keys at the path and at each side', () => {
    expect(
      ConflictDetailPathSchema.safeParse({ ...validPath, fieldId: uuid })
        .success,
    ).toBe(false);
    expect(
      ConflictDetailPathSchema.safeParse({
        ...validPath,
        base: { ...authoredSide, fieldDefinitionId: uuid },
      }).success,
    ).toBe(false);
  });
});

describe('conflict detail resource envelope', () => {
  it('accepts the canonical open conflict', () => {
    expect(ConflictDetailResourceSchema.safeParse(validResource).success).toBe(
      true,
    );
  });

  it('keeps the conflict envelope at meta, state, changedPaths, and hash', () => {
    const extra = cloneResource();
    asRecord(extra.conflict).entryId = uuid;
    expect(ConflictDetailResourceSchema.safeParse(extra).success).toBe(false);

    const missing = cloneResource();
    delete asRecord(missing.conflict).conflictHash;
    expect(ConflictDetailResourceSchema.safeParse(missing).success).toBe(false);

    const badState = cloneResource();
    asRecord(badState.conflict).state = 'pending';
    expect(ConflictDetailResourceSchema.safeParse(badState).success).toBe(
      false,
    );
  });

  it('keeps the entry envelope at the strict resource meta', () => {
    const extra = cloneResource();
    asRecord(extra.entry).state = 'draft';
    expect(ConflictDetailResourceSchema.safeParse(extra).success).toBe(false);

    const missing = cloneResource();
    delete asRecord(missing.entry).version;
    expect(ConflictDetailResourceSchema.safeParse(missing).success).toBe(false);
  });

  it('keeps base and theirs at revision id, number, schema version, and hash', () => {
    for (const side of ['base', 'theirs'] as const) {
      const badNumber = cloneResource();
      asRecord(badNumber[side]).revisionNumber = '0';
      expect(ConflictDetailResourceSchema.safeParse(badNumber).success).toBe(
        false,
      );

      const extra = cloneResource();
      asRecord(extra[side]).yoursSource = 'revision';
      expect(ConflictDetailResourceSchema.safeParse(extra).success).toBe(false);

      const missing = cloneResource();
      delete asRecord(missing[side]).contentHash;
      expect(ConflictDetailResourceSchema.safeParse(missing).success).toBe(
        false,
      );
    }
  });

  it('keeps yours at source, nullable revision id, and hash', () => {
    const proposed = cloneResource();
    asRecord(proposed.yours).source = 'proposed';
    asRecord(proposed.yours).revisionId = null;
    expect(ConflictDetailResourceSchema.safeParse(proposed).success).toBe(true);

    const badSource = cloneResource();
    asRecord(badSource.yours).source = 'local';
    expect(ConflictDetailResourceSchema.safeParse(badSource).success).toBe(
      false,
    );

    const extra = cloneResource();
    asRecord(extra.yours).proposedValuesHash = hash;
    expect(ConflictDetailResourceSchema.safeParse(extra).success).toBe(false);
  });

  it('rejects an unknown or missing key at the root', () => {
    const extra = cloneResource();
    extra.entryVersion = '2';
    expect(ConflictDetailResourceSchema.safeParse(extra).success).toBe(false);

    const missing = cloneResource();
    delete missing.resolvedRevisionId;
    expect(ConflictDetailResourceSchema.safeParse(missing).success).toBe(false);
  });

  it('bounds changedPaths at 1-128 unique entries', () => {
    const empty = cloneResource();
    asRecord(empty.conflict).changedPaths = [];
    expect(ConflictDetailResourceSchema.safeParse(empty).success).toBe(false);

    const atBound = cloneResource();
    asRecord(atBound.conflict).changedPaths = Array.from(
      { length: 128 },
      (_, index) => `/fields/${index}`,
    );
    expect(ConflictDetailResourceSchema.safeParse(atBound).success).toBe(true);

    const overBound = cloneResource();
    asRecord(overBound.conflict).changedPaths = Array.from(
      { length: 129 },
      (_, index) => `/fields/${index}`,
    );
    expect(ConflictDetailResourceSchema.safeParse(overBound).success).toBe(
      false,
    );
  });

  it('caps paths at 128 entries', () => {
    const atBound = cloneResource();
    atBound.paths = manyPaths(128);
    expect(ConflictDetailResourceSchema.safeParse(atBound).success).toBe(true);

    const overBound = cloneResource();
    overBound.paths = manyPaths(129);
    expect(ConflictDetailResourceSchema.safeParse(overBound).success).toBe(
      false,
    );
  });
});

describe('conflict detail state rule', () => {
  it('permits paths while the conflict is open', () => {
    const withPaths = cloneResource();
    withPaths.paths = manyPaths(3);
    expect(ConflictDetailResourceSchema.safeParse(withPaths).success).toBe(true);

    const withoutPaths = cloneResource();
    withoutPaths.paths = [];
    expect(ConflictDetailResourceSchema.safeParse(withoutPaths).success).toBe(
      true,
    );
  });

  it('requires empty paths once the conflict is resolved or superseded', () => {
    for (const state of ['resolved', 'superseded'] as const) {
      const closed = cloneResource();
      asRecord(closed.conflict).state = state;
      closed.paths = [];
      expect(ConflictDetailResourceSchema.safeParse(closed).success).toBe(true);

      const divergent = cloneResource();
      asRecord(divergent.conflict).state = state;
      divergent.paths = [validPath];
      const result = ConflictDetailResourceSchema.safeParse(divergent);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues.map((issue) => issue.message)).toContain(
          'conflict_detail_closed_state_requires_empty_paths',
        );
    }
  });
});

describe('conflict detail privacy', () => {
  const forbidden = ['resolvedByPersonId', 'ownerId', 'assigneeId'] as const;

  it('rejects each private identity or ownership key at every level', () => {
    for (const key of forbidden) {
      const atRoot = cloneResource();
      atRoot[key] = uuid;
      expect(ConflictDetailResourceSchema.safeParse(atRoot).success).toBe(false);

      const inConflict = cloneResource();
      asRecord(inConflict.conflict)[key] = uuid;
      expect(ConflictDetailResourceSchema.safeParse(inConflict).success).toBe(
        false,
      );

      const inEntry = cloneResource();
      asRecord(inEntry.entry)[key] = uuid;
      expect(ConflictDetailResourceSchema.safeParse(inEntry).success).toBe(
        false,
      );

      for (const side of ['base', 'theirs', 'yours'] as const) {
        const inSide = cloneResource();
        asRecord(inSide[side])[key] = uuid;
        expect(ConflictDetailResourceSchema.safeParse(inSide).success).toBe(
          false,
        );
      }

      const inPath = cloneResource();
      pathAt(inPath, 0)[key] = uuid;
      expect(ConflictDetailResourceSchema.safeParse(inPath).success).toBe(
        false,
      );

      const inPathSide = cloneResource();
      asRecord(pathAt(inPathSide, 0).base)[key] = uuid;
      expect(ConflictDetailResourceSchema.safeParse(inPathSide).success).toBe(
        false,
      );

      expect(
        ConflictDetailSideSchema.safeParse({ ...authoredSide, [key]: uuid })
          .success,
      ).toBe(false);
    }
  });
});
