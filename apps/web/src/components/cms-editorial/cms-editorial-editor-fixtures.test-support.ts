import type { JsonValue } from '@wejammin/contracts';

import {
  RELATION_DEFINITION,
  authoringField,
  fieldUuid,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import type { CmsEditorialEntryEditorInit } from './cms-editorial-entry-editor-state';

export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const SCHEMA_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';
export const CONFLICT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132ee';
export const REVISION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d1';
export const HASH = 'a'.repeat(64);
export const INSTANT = '2026-10-05T00:00:00+00:00';

export const TITLE = fieldUuid(1);
export const BLURB = fieldUuid(2);
export const RATING = fieldUuid(3);
export const RELATED = fieldUuid(4);

export const editorFields = () => [
  authoringField({
    n: 1,
    key: 'title',
    kind: 'short_text',
    label: 'Title',
    required: true,
    constraints: { minLength: 2, maxLength: 40 },
  }),
  authoringField({ n: 2, key: 'blurb', kind: 'long_text', label: 'Blurb' }),
  authoringField({
    n: 3,
    key: 'rating',
    kind: 'integer',
    label: 'Rating',
    constraints: { minimum: 1, maximum: 10 },
  }),
  authoringField({
    n: 4,
    key: 'related',
    kind: 'relation',
    label: 'Related entries',
    relationDefinition: RELATION_DEFINITION,
  }),
];

export const editorInit = (
  overrides: Partial<CmsEditorialEntryEditorInit> = {},
): CmsEditorialEntryEditorInit => ({
  entryId: ENTRY_ID,
  entryVersion: '4',
  baseRevision: '2',
  locale: 'en-US',
  schemaVersionId: SCHEMA_VERSION_ID,
  lifecycle: 'active',
  state: 'draft',
  validationState: 'valid',
  openConflict: null,
  fields: editorFields(),
  values: {
    [TITLE]: 'Release notes',
    [BLURB]: null,
    [RATING]: null,
    [RELATED]: { targets: [] },
  },
  readOnlyNotices: {},
  provenance: {},
  ...overrides,
});

export const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const apiError = (
  status: number,
  code: string,
  details: unknown = {},
  headers: Record<string, string> = {},
): Response =>
  json(
    status,
    {
      code,
      message: 'Server text that must never be shown.',
      requestId: REQUEST_ID,
      details,
    },
    headers,
  );

/** The CMS-03B-01 201: `version` is the snapshot's own (1), `entryVersion` the CAS operand. */
export const revisionCreated = (input: {
  readonly revisionNumber: string;
  readonly entryVersion: string;
  readonly parents?: readonly string[];
}): Response =>
  json(
    201,
    {
      id: REVISION_ID,
      version: '1',
      entryVersion: input.entryVersion,
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'draft',
      entryId: ENTRY_ID,
      revisionNumber: input.revisionNumber,
      schemaVersionId: SCHEMA_VERSION_ID,
      templateVersionId: null,
      taxonomyVersionIds: [],
      locale: 'en-US',
      contentHash: HASH,
      parentRevisionIds: input.parents ?? [fieldUuid(0x700)],
      validationState: 'valid',
      conflictId: null,
    },
    {
      etag: `"${input.entryVersion}"`,
      'cache-control': 'no-store',
      location: `/api/v1/cms/entries/${ENTRY_ID}/revisions/${REVISION_ID}`,
    },
  );

export interface DraftDetailOptions {
  readonly entryVersion: string;
  readonly revisionNumber: string;
  readonly values: Readonly<Record<string, JsonValue | null>>;
  readonly openConflict?: { conflictId: string; version: string } | null;
  readonly revisionId?: string;
  /** Per-field provenance; a field with a value defaults to `authored`. */
  readonly provenance?: Readonly<Record<string, string>>;
}

/** A strict CMS-03B-11 200 with its strong, actor-bound ETag. */
export const draftDetail = (options: DraftDetailOptions): Response => {
  const revisionId = options.revisionId ?? REVISION_ID;
  return json(
    200,
    {
      entry: {
        id: ENTRY_ID,
        version: options.entryVersion,
        createdAt: INSTANT,
        updatedAt: INSTANT,
      },
      revision: {
        id: revisionId,
        version: '1',
        createdAt: INSTANT,
        updatedAt: INSTANT,
      },
      revisionNumber: options.revisionNumber,
      lifecycle: 'active',
      state: 'draft',
      locale: 'en-US',
      contentHash: HASH,
      schemaVersionId: SCHEMA_VERSION_ID,
      validationState: 'valid',
      openConflict:
        options.openConflict === undefined || options.openConflict === null
          ? null
          : { ...options.openConflict, conflictHash: HASH },
      fields: Object.entries(options.values)
        .filter(([, value]) => value !== null)
        .map(([fieldId, value]) => ({
          fieldId,
          fieldDefinitionId: fieldId,
          locale: 'en-US',
          value,
          provenance: options.provenance?.[fieldId] ?? 'authored',
          valueHash: HASH,
        })),
      relations: [],
    },
    {
      etag: `"${ENTRY_ID}:${options.entryVersion}:${revisionId}:1:${HASH}"`,
      'cache-control': 'no-store',
    },
  );
};
