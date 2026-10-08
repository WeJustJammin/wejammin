import type { JsonValue } from '@wejammin/contracts';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  INSTANT,
  SCHEMA_VERSION_ID,
} from './cms-editorial-editor-fixtures.test-support';

export interface ConflictSideOptions {
  readonly value: JsonValue | null;
  readonly provenance?: string;
  readonly hash?: string | null;
}

const side = (options: ConflictSideOptions) => ({
  value: options.value,
  provenance:
    options.provenance ?? (options.value === null ? 'missing' : 'authored'),
  valueHash:
    options.hash === undefined
      ? options.value === null
        ? null
        : HASH
      : options.hash,
});

export interface ConflictPathOptions {
  readonly fieldId: string;
  readonly base: ConflictSideOptions;
  readonly theirs: ConflictSideOptions;
  readonly yours: ConflictSideOptions;
}

const DEFAULT_PATHS: readonly ConflictPathOptions[] = [
  {
    fieldId: fieldUuid(1),
    base: { value: 'Release notes' },
    theirs: { value: 'Release notes (theirs)' },
    yours: { value: 'Release notes (mine)' },
  },
];

export const conflictDetailBody = (
  options: {
    readonly conflictId?: string;
    readonly entryVersion?: string;
    readonly baseRevision?: string;
    readonly paths?: readonly ConflictPathOptions[];
  } = {},
) => {
  const paths = options.paths ?? DEFAULT_PATHS;
  return {
    conflict: {
      id: options.conflictId ?? CONFLICT_ID,
      version: '1',
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'open',
      changedPaths: paths.map((path) => `/fields/${path.fieldId}`),
      conflictHash: HASH,
    },
    entry: {
      id: ENTRY_ID,
      version: options.entryVersion ?? '6',
      createdAt: INSTANT,
      updatedAt: INSTANT,
    },
    base: {
      revisionId: fieldUuid(0x801),
      revisionNumber: options.baseRevision ?? '2',
      schemaVersionId: SCHEMA_VERSION_ID,
      contentHash: HASH,
    },
    theirs: {
      revisionId: fieldUuid(0x802),
      revisionNumber: '3',
      schemaVersionId: SCHEMA_VERSION_ID,
      contentHash: HASH,
    },
    yours: { source: 'proposed', revisionId: null, contentHash: HASH },
    paths: paths.map((path) => ({
      path: `/fields/${path.fieldId}`,
      base: side(path.base),
      theirs: side(path.theirs),
      yours: side(path.yours),
    })),
    resolvedRevisionId: null,
  };
};
