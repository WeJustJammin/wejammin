/**
 * Fixtures for the Slice 12 conflict/taxonomy loader suite. Every builder is
 * parsed through the REAL generated contract (or the existing page/conflict
 * fixtures) so a fixture can never drift from the schema it stands for. Only the
 * `load-conflict-page.taxonomy` suite imports this module.
 */

import {
  AuthoringContextResourceSchema,
  type AuthoringContextField,
  type EntryWorkflowResource,
} from '@wejammin/contracts';

import {
  conflictDetailBody,
  type ConflictPathOptions,
} from '../cms-editorial/cms-editorial-conflict-fixtures.test-support';
import {
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  SCHEMA_VERSION_ID,
  TITLE,
  apiError,
  json,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  allKindFields,
  fieldUuid,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { workflowFixture } from '../cms-editorial-workflow/cms-workflow-fixtures.test-support';

export { CONFLICT_ID, ENTRY_ID, HASH, SCHEMA_VERSION_ID };

/** A UUID that is never the conflict's own entry, revision or schema version. */
export const OTHER_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf1ffff';
export const HASH_B = 'b'.repeat(64);
const INSTANT = '2026-10-08T12:00:00Z';

/** The conflict's own `theirs` revision reference (BE03b CMS-03B-12). */
export const THEIRS_REVISION_ID = fieldUuid(0x802);
export const THEIRS_REVISION_NUMBER = '3';
/** The conflict's divergent taxonomy field, and a non-taxonomy one. */
export const TOPICS = fieldUuid(13);
export const NON_TAXONOMY = TITLE;
/** The immutable revision locale: never the content type's default locale. */
export const REVISION_LOCALE = 'fr-FR';
/** The owning type key the server projects for the conflict's schema version. */
export const TYPE_KEY = selectedType().typeKey;

/** The definitions of the conflict schema version, without a taxonomy field. */
export const fieldsWithoutTaxonomy = (): readonly AuthoringContextField[] =>
  allKindFields().filter((field) => field.kind !== 'taxonomy');

/** The same definitions with the taxonomy field, whether or not it diverges. */
export const fieldsWithTaxonomy = (): readonly AuthoringContextField[] =>
  allKindFields();

export const definitionsResponse = (
  fields: readonly AuthoringContextField[] = fieldsWithTaxonomy(),
): Response =>
  json(
    200,
    AuthoringContextResourceSchema.parse({
      creatableTypes: [selectedType()],
      selectedType: selectedType(),
      fields,
    }),
  );

export const NON_TAXONOMY_PATH: ConflictPathOptions = {
  fieldId: NON_TAXONOMY,
  base: { value: 'a' },
  theirs: { value: 'b' },
  yours: { value: 'c' },
};

export const TAXONOMY_PATH: ConflictPathOptions = {
  fieldId: TOPICS,
  base: { value: null },
  theirs: { value: { termIds: [fieldUuid(0x501)] } },
  yours: { value: null },
};

export const conflictDetailResponse = (
  paths: readonly ConflictPathOptions[] = [NON_TAXONOMY_PATH, TAXONOMY_PATH],
): Response => json(200, conflictDetailBody({ paths }));

export const entry = (
  id: string = ENTRY_ID,
): Readonly<Record<string, unknown>> => ({
  id,
  version: '7',
  createdAt: INSTANT,
  updatedAt: INSTANT,
});

export const revision = (
  over: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> => ({
  id: THEIRS_REVISION_ID,
  revisionNumber: THEIRS_REVISION_NUMBER,
  locale: REVISION_LOCALE,
  schemaVersionId: SCHEMA_VERSION_ID,
  state: 'draft',
  contentHash: HASH,
  validationState: 'valid',
  isCurrentDraft: true,
  ...over,
});

/** A workflow bound to the conflict's theirs revision; `over` breaks one binding. */
export const workflow = (
  over: Readonly<Record<string, unknown>> = {},
): EntryWorkflowResource =>
  workflowFixture({ entry: entry(), revision: revision(), ...over });

export const workflowResponse = (resource: EntryWorkflowResource): Response =>
  json(200, resource);

export const workflowRefusal = (status: number): Response =>
  apiError(status, 'X');
