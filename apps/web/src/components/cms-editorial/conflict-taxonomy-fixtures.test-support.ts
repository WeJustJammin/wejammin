import {
  ConflictDetailResourceSchema,
  type ConflictDetailResource,
} from '@wejammin/contracts';

import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import {
  authoringField,
  fieldUuid,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  taxonomyPage,
  termUid,
} from '../cms-editorial-fields/cms-taxonomy-field-fixtures.test-support';
import {
  conflictDetailBody,
  type ConflictPathOptions,
} from './cms-editorial-conflict-fixtures.test-support';
import {
  conflictInitFrom,
  type CmsEditorialConflictResolveInit,
} from './cms-editorial-conflict-state';
import {
  CONFLICT_ID,
  ENTRY_ID,
  HASH,
  INSTANT,
  TITLE,
  apiError,
  json,
} from './cms-editorial-editor-fixtures.test-support';

/**
 * Fixtures for the CMS-06 conflict form over a CMS-03C-17 taxonomy field
 * (BE03b CMS-03B-02 and CMS-03B-12; BE03c CMS-03C-17; FE03 "Slice 12 governed
 * definition, composition, taxonomy, locale and related-content surfaces").
 *
 * The conflict detail read carries no locale, so the host binds the selector
 * scope it read elsewhere: the server-derived type key, the exact conflict
 * locale and the stable field key, plus the four immutable revision reference
 * members of the server-read `theirs` revision. Every detail body is parsed
 * through the real `ConflictDetailResource` contract, so a fixture that drifts
 * from the server projection fails here instead of inside a render.
 */

export const SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';
/** The owning content type's stable key: the selector `typeKey`. */
export const TYPE_KEY = 'article';
/** The conflict revision's exact locale: the selector `locale`, never a default. */
export const LOCALE = 'fr-FR';
/** The taxonomy field's stable key: the selector `fieldKey`, never a DOM id. */
export const TAXONOMY_FIELD_KEY = 'topics';
export const TOPICS = fieldUuid(13);
export const GUITAR = termUid(1);

export const taxonomyFields = () => [
  authoringField({
    n: 1,
    key: 'title',
    kind: 'short_text',
    label: 'Title',
    required: true,
    constraints: { minLength: 2, maxLength: 40 },
  }),
  authoringField({
    n: 13,
    key: TAXONOMY_FIELD_KEY,
    kind: 'taxonomy',
    label: 'Topics',
  }),
];

/** The two divergent fields: a text field and the taxonomy field. */
export const taxonomyPaths: readonly ConflictPathOptions[] = [
  {
    fieldId: TITLE,
    base: { value: 'Base title' },
    theirs: { value: 'Their title' },
    yours: { value: 'My title' },
  },
  {
    fieldId: TOPICS,
    base: { value: null },
    theirs: { value: { termIds: [termUid(8)] } },
    yours: { value: { termIds: [termUid(9)] } },
  },
];

export interface ConflictDetailOptions {
  readonly paths?: readonly ConflictPathOptions[];
  readonly entryVersion?: string;
  readonly theirs?: Partial<ConflictDetailResource['theirs']>;
}

export const detailWith = (
  options: ConflictDetailOptions = {},
): ConflictDetailResource => {
  const body = conflictDetailBody({
    paths: options.paths ?? taxonomyPaths,
    ...(options.entryVersion === undefined
      ? {}
      : { entryVersion: options.entryVersion }),
  });
  return ConflictDetailResourceSchema.parse(
    options.theirs === undefined
      ? body
      : { ...body, theirs: { ...body.theirs, ...options.theirs } },
  );
};

/**
 * The conflict init the page would build once the workflow read supplied the
 * scope. `taxonomyContext` is an internal, JSON-only island input that the init
 * type does not yet declare: the cast keeps these tests compiling while the
 * behavior they pin is the one under test.
 */
export const taxonomyInit = (
  options: ConflictDetailOptions = {},
): CmsEditorialConflictResolveInit => {
  const detail = detailWith(options);
  return {
    ...conflictInitFrom(detail, describeCmsAuthoringFields(taxonomyFields())),
    taxonomyContext: {
      typeKey: TYPE_KEY,
      locale: LOCALE,
      theirs: detail.theirs,
    },
  } as unknown as CmsEditorialConflictResolveInit;
};

export const selectorResponse = (): Response =>
  json(200, taxonomyPage([{ n: 1, termKey: 'guitar', label: 'Guitar' }]), {
    etag: '"7"',
    'cache-control': 'no-store',
  });

export const detailResponse = (options: ConflictDetailOptions = {}): Response =>
  json(200, detailWith(options), { 'cache-control': 'no-store' });

const termViolation = (): Array<Record<string, string>> => [
  { path: '/choices/1/value', code: 'invalid_value', message: 'x' },
];

/** A verified 422 whose reason token says a selected term is gone. */
export const termUnavailable = (): Response =>
  apiError(422, 'VALIDATION_FAILED', {
    reasonCode: 'term_unavailable',
    violations: termViolation(),
  });

/** A verified refusal of any status whose token still names the term. */
export const namedTermRefusal = (status: number, code: string): Response =>
  apiError(status, code, {
    reasonCode: 'term_unavailable',
    violations: termViolation(),
  });

/** A verified 422 that names another reason: it must not refresh the selector. */
export const unrelatedRefusal = (): Response =>
  apiError(422, 'VALIDATION_FAILED', {
    reasonCode: 'rich_text_not_canonical',
    violations: termViolation(),
  });

/** The CMS-03B-02 201: a distinct two-parent revision for this entry and conflict. */
export const resolved = (): Response =>
  json(
    201,
    {
      id: fieldUuid(0x703),
      version: '1',
      entryVersion: '7',
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'draft',
      entryId: ENTRY_ID,
      revisionNumber: '4',
      schemaVersionId: fieldUuid(0x710),
      templateVersionId: null,
      taxonomyVersionIds: [],
      locale: LOCALE,
      contentHash: HASH,
      parentRevisionIds: [fieldUuid(0x701), fieldUuid(0x702)],
      validationState: 'valid',
      conflictId: CONFLICT_ID,
    },
    { etag: '"7"', 'cache-control': 'no-store' },
  );
