/**
 * CMS-03B-12 conflict page boundaries (Slice 12). FE03 `03-cms-content-modeling.md`
 * line 1064 defines the conflict route as `ConflictDetailQuery` accepting no keys:
 * the URL carries only the two immutable ids. The Astro page forwards the whole
 * request to `loadConflictPage` while `createCmsEditorialPageReads` strips the page
 * query before the upstream read, so this gap is page-local: the loader must
 * refuse any nonempty query with the existing 400 invalid-request notice before
 * either injected read, so a page-only key is never silently ignored.
 *
 * The same FE03 contract ties the field-definition read to the version it asked
 * for. The upstream proxy and Worker already enforce that binding; these tests
 * keep the loader's own injected-read boundary honest in defense in depth: it
 * asks for `conflict.theirs.schemaVersionId`, so the response it accepts must
 * satisfy the existing `AuthoringContextReadSchema` -- a non-null selection whose
 * `contentTypeVersionId` equals that requested version -- and not only the
 * standalone `AuthoringContextResourceSchema`. A projection that is
 * standalone-valid but unselected or of another version is the existing 502
 * unverified notice, never a form.
 *
 * Every negative fixture below is asserted to pass the standalone resource
 * contract first, so the refusal observed here can only come from the
 * query/resource binding, never from a fixture that already fails standalone.
 */

import {
  AuthoringContextReadSchema,
  AuthoringContextResourceSchema,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { conflictDetailBody } from '../cms-editorial/cms-editorial-conflict-fixtures.test-support';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  SCHEMA_VERSION_ID,
  TITLE,
  editorFields,
  json,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { selectedType } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadConflictPage } from './load-conflict-page';

const ADDRESS = `https://web.test/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`;

const page = (search = '') => new Request(`${ADDRESS}${search}`);

const reads = (parts: Partial<CmsEditorialPageReads>) =>
  parts as CmsEditorialPageReads;

const detail = () =>
  json(
    200,
    conflictDetailBody({
      paths: [
        {
          fieldId: TITLE,
          base: { value: 'a' },
          theirs: { value: 'b' },
          yours: { value: 'c' },
        },
        {
          fieldId: BLURB,
          base: { value: null },
          theirs: { value: 'd' },
          yours: { value: 'e' },
        },
      ],
    }),
  );

const definitionsBody = (fields = editorFields()) => ({
  creatableTypes: [selectedType()],
  selectedType: selectedType(),
  fields,
});

const definitions = (fields = editorFields()) =>
  json(200, AuthoringContextResourceSchema.parse(definitionsBody(fields)));

/** The requested version's own read: what the loader must build to bind a response. */
const requestedRead = (resource: unknown) => ({
  query: { contentTypeVersionId: SCHEMA_VERSION_ID },
  resource,
});

const OTHER_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf1ffff';

/** A standalone-valid resource whose selected type is a different version. */
const wrongVersionBody = () => {
  const selected = selectedType();
  return {
    creatableTypes: [selected],
    selectedType: {
      ...selected,
      contentTypeVersionId: OTHER_VERSION_ID,
      schemaArtifact: {
        ...selected.schemaArtifact,
        contentTypeVersionId: OTHER_VERSION_ID,
      },
    },
    fields: editorFields(),
  };
};

/** A standalone-valid resource that carries the known fields but no selection. */
const unselectedBody = () => ({
  creatableTypes: [selectedType()],
  selectedType: null,
  fields: editorFields(),
});

describe('loadConflictPage: query and definition boundaries', () => {
  it.each([
    ['an unknown key', '?unknownKey=value'],
    ['a declared-looking forbidden locale key', '?locale=fr-FR'],
    ['a repeated unknown key', '?locale=fr-FR&locale=fr-FR'],
  ])(
    'answers %s as the existing invalid request before either upstream read',
    async (_case, search) => {
      const conflictDetail = vi.fn(async () => detail());
      const authoringContext = vi.fn(async () => definitions());
      const outcome = await loadConflictPage({
        request: page(search),
        entryId: ENTRY_ID,
        conflictId: CONFLICT_ID,
        reads: reads({ conflictDetail, authoringContext }),
      });
      expect(conflictDetail).not.toHaveBeenCalled();
      expect(authoringContext).not.toHaveBeenCalled();
      expect(outcome.kind).toBe('notice');
      expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
        status: 400,
        title: 'Invalid request',
        heading: 'Invalid request',
        message:
          'This request could not be read. Check the address and try again.',
      });
    },
  );

  it.each([
    ['a selected type of another version', wrongVersionBody],
    ['no selected type at all', unselectedBody],
  ])(
    'refuses %s as the unverified state though the resource alone is the strict contract',
    async (_case, body) => {
      // The projection is exactly the standalone resource contract ...
      expect(AuthoringContextResourceSchema.safeParse(body()).success).toBe(
        true,
      );
      // ... and only the version binding refuses it.
      expect(
        AuthoringContextReadSchema.safeParse(requestedRead(body())).success,
      ).toBe(false);
      const outcome = await loadConflictPage({
        request: page(),
        entryId: ENTRY_ID,
        conflictId: CONFLICT_ID,
        reads: reads({
          conflictDetail: async () => detail(),
          authoringContext: async () => json(200, body()),
        }),
      });
      expect(outcome.kind).not.toBe('view');
      expect(outcome.kind === 'notice' && outcome.notice).toMatchObject({
        status: 502,
        heading: 'Temporarily unavailable',
      });
    },
  );

  it('renders the view only for the exact requested version and asks only for that version', async () => {
    const authoringContext = vi.fn(async () => definitions());
    const outcome = await loadConflictPage({
      request: page(),
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      reads: reads({ conflictDetail: async () => detail(), authoringContext }),
    });
    expect(
      AuthoringContextReadSchema.safeParse(requestedRead(definitionsBody()))
        .success,
    ).toBe(true);
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') throw new Error('expected a conflict view');
    expect(outcome.view.init.paths.map((path) => path.fieldId)).toEqual([
      TITLE,
      BLURB,
    ]);
    expect(authoringContext).toHaveBeenCalledTimes(1);
    expect(authoringContext).toHaveBeenCalledWith(
      expect.any(Request),
      SCHEMA_VERSION_ID,
    );
  });
});
