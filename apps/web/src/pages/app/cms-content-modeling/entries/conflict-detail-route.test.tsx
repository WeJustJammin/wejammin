import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AuthoringContextResourceSchema } from '@wejammin/contracts';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialConflictResolveIsland from '../../../../components/cms-editorial/CmsEditorialConflictResolveIsland';
import { conflictDetailBody } from '../../../../components/cms-editorial/cms-editorial-conflict-fixtures.test-support';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  TITLE,
  editorFields,
  json,
} from '../../../../components/cms-editorial/cms-editorial-editor-fixtures.test-support';
import { selectedType } from '../../../../components/cms-editorial-fields/cms-field-fixtures.test-support';
import type { CmsEditorialPageReads } from '../../../../components/cms-editorial-pages/cms-editorial-page-reads';
import { loadConflictPage } from '../../../../components/cms-editorial-pages/load-conflict-page';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * The conflict page is composed of a tested loader and a tested island; this
 * suite drives the REAL composition (loader -> verified view -> server-rendered
 * island) with only the proxy edge replaced, and asserts what a reader gets:
 * the three named preimages per divergent field, a real radio per choice, no
 * ownership identifier and no JSON. It replaces a suite that grepped the page
 * source for the words base, theirs and yours.
 */
const reads = {
  conflictDetail: async () =>
    json(
      200,
      conflictDetailBody({
        paths: [
          {
            fieldId: TITLE,
            base: { value: 'Base title' },
            theirs: { value: 'Their title' },
            yours: { value: 'My title' },
          },
          {
            fieldId: BLURB,
            base: { value: null },
            theirs: { value: 'Their blurb' },
            yours: { value: 'My blurb' },
          },
        ],
      }),
    ),
  authoringContext: async () =>
    json(
      200,
      AuthoringContextResourceSchema.parse({
        creatableTypes: [selectedType()],
        selectedType: selectedType(),
        fields: editorFields(),
      }),
    ),
} as unknown as CmsEditorialPageReads;

const render = async (): Promise<string> => {
  const outcome = await loadConflictPage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
    ),
    entryId: ENTRY_ID,
    conflictId: CONFLICT_ID,
    reads,
  });
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return renderToStaticMarkup(
    <CmsEditorialConflictResolveIsland init={outcome.view.init} />,
  );
};

describe('CMS-03B-12 protected conflict-detail page, composed', () => {
  it('renders the three named preimages and a radio choice for every divergent field', async () => {
    const html = await render();
    for (const name of ['Base', 'Their version', 'Your version'])
      expect(
        html.match(new RegExp(`role="group" aria-label="${name}"`, 'gu')),
      ).toHaveLength(2);
    for (const text of [
      'Base title',
      'Their title',
      'My title',
      'Their blurb',
      'My blurb',
    ])
      expect(html).toContain(text);
    expect(html.match(/type="radio"/gu)).toHaveLength(8);
    expect(html).toContain('Keep your version');
    expect(html).toContain('Use a new value');
    expect(html).toContain('Resolve conflict');
    // Nothing preselected, so no winner is inferred.
    expect(html).not.toContain('checked');
  });

  it('exposes no ownership or resolver identifier and no JSON', async () => {
    const html = await render();
    for (const name of [
      'resolvedByPersonId',
      'ownerId',
      'assigneeId',
      'conflictHash',
    ])
      expect(html).not.toContain(name);
    expect(html).not.toContain('{&quot;');
    expect(html).not.toContain('{"');
  });
});

describe('[conflictId].astro response invariants', () => {
  const source = readFileSync(
    fromHere('./[entryId]/conflicts/[conflictId].astro'),
    'utf8',
  );
  const shell = readFileSync(
    fromHere('../../../../components/cms-editorial/CmsEditorialDocument.astro'),
    'utf8',
  );

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('new Response(');
    expect(shell).toContain('id="page-title"');
    expect(shell).toContain('id="cms-editorial-main"');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
  });
});
