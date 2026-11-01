/**
 * The CMS-03B-14 create preparation and the CMS-03C-17 taxonomy selector: the
 * create view must carry the AUTHORITATIVE content type key of the selected type
 * (P2-S12-AC-135; FE03 Slice 12 taxonomy surfaces). The key is the server's
 * `selectedType.typeKey` and nothing else: it is never derived from the label, the
 * content type id, or any designer input. A projection whose selected type omits
 * its key is not the strict contract, so the page fails closed instead of
 * rendering a form whose selector could not be addressed.
 */

import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  allKindFields,
  selectedType,
} from '../cms-editorial-fields/cms-field-fixtures.test-support';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import { loadEntryCreatePage } from './load-entry-create-page';

const TYPE_KEY = 'article';

/** The selected type the server projects, carrying its authoritative type key. */
const typeWithKey = (over: Readonly<Record<string, unknown>> = {}) => ({
  ...selectedType(),
  typeKey: TYPE_KEY,
  ...over,
});

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const reads = (authoringContext: CmsEditorialPageReads['authoringContext']) =>
  ({ authoringContext }) as unknown as CmsEditorialPageReads;

const page = (search = '') =>
  new Request(`https://web.test/app/cms-content-modeling/entries/new${search}`);

const selectedVersionId = selectedType().contentTypeVersionId;
const pageWithVersion = () =>
  page(`?contentTypeVersionId=${selectedVersionId}`);

describe('loadEntryCreatePage: the content type key', () => {
  it('carries the authoritative type key of the selected type into the create view', async () => {
    const resource = AuthoringContextResourceSchema.parse({
      creatableTypes: [typeWithKey()],
      selectedType: typeWithKey(),
      fields: allKindFields(),
    });
    const outcome = await loadEntryCreatePage({
      request: pageWithVersion(),
      reads: reads(async () => json(200, resource)),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') throw new Error('expected a create view');
    expect(outcome.view.selected).not.toBeNull();
    if (outcome.view.selected === null)
      throw new Error('expected a selected type');
    expect(outcome.view.selected.typeKey).toBe(TYPE_KEY);
    expect(outcome.view.types[0]?.typeKey).toBe(TYPE_KEY);
  });

  it('never derives the type key from the label or the content type id', async () => {
    const resource = AuthoringContextResourceSchema.parse({
      creatableTypes: [typeWithKey()],
      selectedType: typeWithKey({ label: 'Totally unrelated' }),
      fields: allKindFields(),
    });
    const outcome = await loadEntryCreatePage({
      request: pageWithVersion(),
      reads: reads(async () => json(200, resource)),
    });
    expect(outcome.kind).toBe('view');
    if (outcome.kind !== 'view') throw new Error('expected a create view');
    const selected = outcome.view.selected;
    expect(selected).not.toBeNull();
    if (selected === null) throw new Error('expected a selected type');
    expect(selected.typeKey).toBe(TYPE_KEY);
    expect(selected.typeKey).not.toBe(selected.label);
    expect(selected.typeKey).not.toBe(selected.contentTypeId);
  });

  it('refuses a projection whose selected type lacks its type key instead of rendering a form', async () => {
    const raw = JSON.parse(
      JSON.stringify({
        creatableTypes: [typeWithKey()],
        selectedType: typeWithKey(),
        fields: allKindFields(),
      }),
    ) as { selectedType: Record<string, unknown> };
    delete raw.selectedType.typeKey;
    const outcome = await loadEntryCreatePage({
      request: pageWithVersion(),
      reads: reads(async () => json(200, raw)),
    });
    expect(outcome.kind).toBe('notice');
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(502);
  });
});
