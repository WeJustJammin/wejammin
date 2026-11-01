/**
 * The draft page reaches the locale variant pages (FE03 :1073; web-locale report request 1): the editor view carries
 * one Translate link per supported language of the draft's schema version except the source, from the verified
 * author-safe selection and nowhere else.
 */
import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { selectedType } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  ENTRY_ID,
  TITLE,
  draftDetail,
  editorFields,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryEditPage } from './load-entry-edit-page';

const contextFor = (supportedLocales: readonly string[]) =>
  new Response(
    JSON.stringify(
      AuthoringContextResourceSchema.parse({
        creatableTypes: [selectedType()],
        selectedType: { ...selectedType(), supportedLocales },
        fields: editorFields(),
      }),
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const links = async (supportedLocales: readonly string[]) => {
  const outcome = await loadEntryEditPage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/entries/${ENTRY_ID}`,
    ),
    entryId: ENTRY_ID,
    reads: {
      draftDetail: async () =>
        draftDetail({
          entryVersion: '4',
          revisionNumber: '2',
          values: { [TITLE]: 'Release notes' },
        } as never),
      authoringContext: async () => contextFor(supportedLocales),
    } as unknown as CmsEditorialPageReads,
  });
  if (outcome.kind !== 'view' || outcome.view.kind !== 'editor')
    throw new Error('expected the editor view');
  return outcome.view.translateLinks;
};

describe('loadEntryEditPage translate links', () => {
  it('links every supported language except the source, in the selection’s order', async () => {
    expect(await links(['en-US', 'fr-FR', 'de-DE'])).toEqual([
      {
        locale: 'fr-FR',
        href: `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/fr-FR`,
      },
      {
        locale: 'de-DE',
        href: `/app/cms-content-modeling/entries/${ENTRY_ID}/locales/de-DE`,
      },
    ]);
  });

  it('carries no link when the source is the only supported language', async () => {
    expect(await links(['en-US'])).toEqual([]);
  });
});
