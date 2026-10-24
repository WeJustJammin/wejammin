/**
 * The CMS-03B-11/03B-14 draft preparation and the CMS-03C-17 taxonomy selector:
 * `init.typeKey` must be the AUTHORITATIVE content type key of the selected type
 * of the DRAFT's own schema version (P2-S12-AC-135; FE03 Slice 12 taxonomy
 * surfaces). Nothing else may fill it -- not the label, not the content type id,
 * and not a caller/designer choice. The page fails closed whenever the projection
 * returns no selection while a version was requested, returns a selection for a
 * different version than the draft, or omits the key, because the field's selector
 * could not then be addressed truthfully.
 */

import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  allKindFields,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  ENTRY_ID,
  SCHEMA_VERSION_ID,
  TITLE,
  draftDetail,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryEditPage } from './load-entry-edit-page';

const TYPE_KEY = 'article';
const OTHER_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132ff';

/**
 * The selected type the server projects, carrying its authoritative type key. The
 * positive fixture binds BOTH the selection's version and its schema artifact to
 * the draft's own schema version, so a correct loader accepts it; a negative
 * overrides only `contentTypeVersionId`.
 */
const typeWithKey = (over: Readonly<Record<string, unknown>> = {}) => {
  const base = selectedType();
  return {
    ...base,
    typeKey: TYPE_KEY,
    contentTypeVersionId: SCHEMA_VERSION_ID,
    schemaArtifact: {
      ...base.schemaArtifact,
      contentTypeVersionId: SCHEMA_VERSION_ID,
    },
    ...over,
  };
};

const page = (path = `/app/cms-content-modeling/entries/${ENTRY_ID}`) =>
  new Request(`https://web.test${path}`);

const context = (
  selected: unknown,
  fields: readonly unknown[] = allKindFields(),
): Response =>
  new Response(
    JSON.stringify(
      AuthoringContextResourceSchema.parse({
        creatableTypes: [typeWithKey()],
        selectedType: selected,
        fields,
      }),
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const rawContext = (selected: Record<string, unknown>): Response =>
  new Response(
    JSON.stringify({
      creatableTypes: [typeWithKey()],
      selectedType: selected,
      fields: allKindFields(),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const reads = (parts: Partial<CmsEditorialPageReads>): CmsEditorialPageReads =>
  parts as CmsEditorialPageReads;

const detail = () =>
  draftDetail({
    entryVersion: '4',
    revisionNumber: '2',
    values: { [TITLE]: 'Release notes' },
  });

describe('loadEntryEditPage: the draft type key', () => {
  it('fills init.typeKey from the authoritative selected type of the draft schema version', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => context(typeWithKey()),
      }),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') throw new Error('expected an edit view');
    expect(outcome.view.kind).toBe('editor');
    if (outcome.view.kind !== 'editor')
      throw new Error('expected an editor view');
    const init = outcome.view.init;
    expect(init.schemaVersionId).toBe(SCHEMA_VERSION_ID);
    expect(init.typeKey).toBe(TYPE_KEY);
    expect(init.locale).toBe('en-US');
  });

  it('never derives the type key from the label or the content type id', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () =>
          context(typeWithKey({ label: 'Totally unrelated' })),
      }),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') throw new Error('expected an edit view');
    expect(outcome.view.kind).toBe('editor');
    if (outcome.view.kind !== 'editor')
      throw new Error('expected an editor view');
    const init = outcome.view.init;
    expect(init.typeKey).toBe(TYPE_KEY);
    expect(init.typeKey).not.toBe('Totally unrelated');
  });

  it('fails closed when the projection selects no type for the requested version', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => context(null, []),
      }),
    });
    expect(outcome.kind).toBe('notice');
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });

  it('fails closed when the selected type is a different version than the draft', async () => {
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () =>
          context(typeWithKey({ contentTypeVersionId: OTHER_VERSION_ID })),
      }),
    });
    expect(outcome.kind).toBe('notice');
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });

  it('fails closed when the selected type has no type key', async () => {
    const selected = typeWithKey() as Record<string, unknown>;
    delete selected.typeKey;
    const outcome = await loadEntryEditPage({
      request: page(),
      entryId: ENTRY_ID,
      reads: reads({
        draftDetail: async () => detail(),
        authoringContext: async () => rawContext(selected),
      }),
    });
    expect(outcome.kind).toBe('notice');
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});
