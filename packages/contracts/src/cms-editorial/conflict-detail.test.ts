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
  yours: { value: null, provenance: 'explicit_null', valueHash: hash },
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

const pathAt = (
  resource: Record<string, unknown>,
  index: number,
): Record<string, unknown> => asRecord((resource.paths as unknown[])[index]);

/** N complete divergent-path rows, so only the count bound is under test. */
const fieldPointer = (index: number): string =>
  `/fields/123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`;

const manyPaths = (count: number): (typeof validPath)[] =>
  Array.from({ length: count }, (_, index) => ({
    ...validPath,
    path: fieldPointer(index),
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
        ConflictDetailSideSchema.safeParse(
          provenance === 'missing'
            ? missingSide
            : provenance === 'explicit_null'
              ? { value: null, provenance, valueHash: null }
              : { ...authoredSide, provenance },
        ).success,
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
      (_, index) => fieldPointer(index),
    );
    atBound.paths = manyPaths(128);
    expect(ConflictDetailResourceSchema.safeParse(atBound).success).toBe(true);

    const overBound = cloneResource();
    asRecord(overBound.conflict).changedPaths = Array.from(
      { length: 129 },
      (_, index) => fieldPointer(index),
    );
    overBound.paths = manyPaths(128);
    expect(ConflictDetailResourceSchema.safeParse(overBound).success).toBe(
      false,
    );
  });

  it('addresses every path and changed path as /fields/{stableFieldId}', () => {
    for (const bad of ['/p/1', '/fields/title', '/blocks/hero', '/fields/']) {
      const badChanged = cloneResource();
      asRecord(badChanged.conflict).changedPaths = [bad];
      expect(ConflictDetailResourceSchema.safeParse(badChanged).success).toBe(
        false,
      );
      const badPath = cloneResource();
      badPath.paths = [{ ...validPath, path: bad }];
      expect(ConflictDetailResourceSchema.safeParse(badPath).success).toBe(
        false,
      );
    }
  });

  it('caps paths at 128 entries', () => {
    const atBound = cloneResource();
    asRecord(atBound.conflict).changedPaths = manyPaths(128).map(
      (path) => path.path,
    );
    atBound.paths = manyPaths(128);
    expect(ConflictDetailResourceSchema.safeParse(atBound).success).toBe(true);

    const overBound = cloneResource();
    asRecord(overBound.conflict).changedPaths = manyPaths(128).map(
      (path) => path.path,
    );
    overBound.paths = manyPaths(129);
    expect(ConflictDetailResourceSchema.safeParse(overBound).success).toBe(
      false,
    );
  });
});

/**
 * BE03b DEC-139 (spec lines 1139-1142, 1686, 2038): CMS-03B-12 serves a conflict
 * only while it is `open`, so every served resource has `conflict.state`
 * `open`, `resolvedRevisionId` null and a non-empty `paths`. A resolved or
 * superseded conflict is the same 404 as an absent one, so a payload carrying a
 * closed state is a server contract violation, never rendered as metadata.
 */
describe('conflict detail open-only rule (DEC-139)', () => {
  const issuesOf = (value: unknown): string[] => {
    const result = ConflictDetailResourceSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it('accepts only an open conflict with divergent paths and no resolved revision', () => {
    const withPaths = cloneResource();
    asRecord(withPaths.conflict).changedPaths = manyPaths(3).map(
      (path) => path.path,
    );
    withPaths.paths = manyPaths(3);
    expect(ConflictDetailResourceSchema.safeParse(withPaths).success).toBe(
      true,
    );
  });

  it('refuses a resolved or superseded conflict, with or without paths', () => {
    for (const state of ['resolved', 'superseded'] as const) {
      for (const paths of [[], [validPath]]) {
        const closed = cloneResource();
        asRecord(closed.conflict).state = state;
        closed.paths = paths;
        expect(issuesOf(closed), `${state} ${paths.length}`).toContain(
          'conflict_detail_requires_open_state',
        );
      }
    }
  });

  it('refuses an open conflict that names a resolved revision', () => {
    const resolved = cloneResource();
    asRecord(resolved).resolvedRevisionId =
      '70000000-0000-4000-8000-000000000007';
    expect(issuesOf(resolved)).toContain(
      'conflict_detail_open_requires_null_resolved_revision',
    );
  });

  it('refuses an open conflict with no divergent paths', () => {
    const empty = cloneResource();
    empty.paths = [];
    expect(issuesOf(empty)).toContain('conflict_detail_open_requires_paths');
  });
});

describe('conflict detail privacy', () => {
  const forbidden = ['resolvedByPersonId', 'ownerId', 'assigneeId'] as const;

  it('rejects each private identity or ownership key at every level', () => {
    for (const key of forbidden) {
      const atRoot = cloneResource();
      atRoot[key] = uuid;
      expect(ConflictDetailResourceSchema.safeParse(atRoot).success).toBe(
        false,
      );

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

/**
 * Codex final review (s10-final-4): the read envelope must be internally consistent, or an upstream
 * inconsistency becomes a disclosure or an ambiguous resolution.
 */
describe('conflict detail consistency (provenance/value, unique and equivalent paths)', () => {
  const issuesOf = (value: unknown): string[] => {
    const result = ConflictDetailResourceSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };
  const sideIssues = (side: unknown): string[] => {
    const result = ConflictDetailSideSchema.safeParse(side);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it('a missing side carries neither value nor hash', () => {
    expect(
      sideIssues({ value: 'hidden', provenance: 'missing', valueHash: null }),
    ).toContain('conflict_detail_side_absent_requires_null_value');
    expect(
      sideIssues({ value: null, provenance: 'missing', valueHash: hash }),
    ).toContain('conflict_detail_side_missing_requires_null_hash');
    expect(sideIssues(missingSide)).toEqual([]);
  });

  it('an explicit-null side carries a null value', () => {
    expect(
      sideIssues({ value: 1, provenance: 'explicit_null', valueHash: hash }),
    ).toContain('conflict_detail_side_absent_requires_null_value');
    expect(
      sideIssues({ value: null, provenance: 'explicit_null', valueHash: null }),
    ).toEqual([]);
    expect(
      sideIssues({ value: null, provenance: 'explicit_null', valueHash: hash }),
    ).toEqual([]);
  });

  it.each(['authored', 'default', 'inherited', 'localized_fallback'])(
    'a %s side carries a value (a JSON null is explicit_null)',
    (provenance) => {
      expect(
        sideIssues({ value: null, provenance, valueHash: hash }),
      ).toContain('conflict_detail_side_valued_requires_value');
      expect(
        sideIssues({ value: { a: 1 }, provenance, valueHash: hash }),
      ).toEqual([]);
    },
  );

  const withPaths = (changed: string[], paths: string[]) => {
    const resource = cloneResource();
    asRecord(resource.conflict).changedPaths = changed;
    resource.paths = paths.map((path) => ({
      ...validPath,
      path,
      yours: { value: null, provenance: 'explicit_null', valueHash: null },
    }));
    return resource;
  };

  it('requires unique paths and unique changed paths', () => {
    expect(
      issuesOf(
        withPaths([fieldPointer(1)], [fieldPointer(1), fieldPointer(1)]),
      ),
    ).toContain('conflict_detail_paths_must_be_unique');
    expect(
      issuesOf(
        withPaths([fieldPointer(1), fieldPointer(1)], [fieldPointer(1)]),
      ),
    ).toContain('conflict_detail_changed_paths_must_be_unique');
  });

  it('requires the paths to be exactly the changed paths', () => {
    expect(
      issuesOf(
        withPaths([fieldPointer(1), fieldPointer(2)], [fieldPointer(1)]),
      ),
    ).toContain('conflict_detail_paths_must_equal_changed_paths');
    expect(issuesOf(withPaths([fieldPointer(1)], [fieldPointer(2)]))).toContain(
      'conflict_detail_paths_must_equal_changed_paths',
    );
    // Order is the server's; equality is of the sets.
    expect(
      issuesOf(
        withPaths(
          [fieldPointer(1), fieldPointer(2)],
          [fieldPointer(2), fieldPointer(1)],
        ),
      ),
    ).toEqual([]);
  });
});
