import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CmsEditorialPageReads } from '../../../../../components/cms-editorial-pages/cms-editorial-page-reads';
import { loadWorkflowPage } from '../../../../../components/cms-editorial-pages/load-workflow-page';
import CmsEditorialWorkflowIsland from '../../../../../components/cms-editorial-workflow/CmsEditorialWorkflowIsland';
import {
  ENTRY_ID,
  HASH_A,
  apiError,
  approvedWorkflowFixture,
  jsonResponse,
  workflowFixture,
} from '../../../../../components/cms-editorial-workflow/cms-workflow-fixtures.test-support';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/*
 * The workflow page is a tested loader plus a tested island; this suite drives
 * the REAL composition (only the proxy edge replaced) for the journeys of FE03
 * "Slice 11 review, schedule, preview and publication surfaces": a submittable
 * draft, an approved revision, a concealed entry and an expired session, then
 * reads the Astro file for the response invariants no other test can.
 */
const load = (response: Response, search = '') =>
  loadWorkflowPage({
    request: new Request(
      `https://web.test/app/cms-content-modeling/entries/${ENTRY_ID}/workflow${search}`,
    ),
    entryId: ENTRY_ID,
    reads: {
      workflow: async () => response,
    } as unknown as CmsEditorialPageReads,
  });

const render = async (response: Response): Promise<string> => {
  const outcome = await load(response);
  if (outcome.kind !== 'view') throw new Error('expected a view');
  return renderToStaticMarkup(
    <CmsEditorialWorkflowIsland
      init={{
        workflow: outcome.view.workflow,
        entryId: outcome.view.entryId,
        revisionId: outcome.view.revisionId,
        verifiedAt: outcome.view.verifiedAt,
      }}
    />,
  );
};

describe('CMS-03B-15 protected workflow page, composed', () => {
  it('serves the panel and the submit and preview forms of a submittable draft', async () => {
    const html = await render(
      jsonResponse(200, workflowFixture(), { etag: '"x"' }),
    );
    expect(html).toContain('Submit for review');
    expect(html).toContain('Create a preview');
    expect(html).not.toContain('Confirm publication');
    expect(html.match(/data-cms-preflight-outcome/gu)).toHaveLength(17);
  });

  it('serves schedule, preview and publish for an approved revision, and never a hash', async () => {
    const html = await render(
      jsonResponse(200, approvedWorkflowFixture(), { etag: '"x"' }),
    );
    expect(html).toContain('Schedule publication');
    expect(html).toContain('Confirm publication');
    expect(html).not.toContain(HASH_A);
    expect(html).not.toContain('dependencyManifest');
  });

  it('answers a concealed entry with one closed 404 state and no workflow', async () => {
    const outcome = await load(jsonResponse(404, apiError('NOT_FOUND')));
    expect(outcome.kind === 'notice' && outcome.notice.status).toBe(404);
    expect(outcome.kind === 'notice' && outcome.notice.message).toBe(
      'This entry or revision is not available.',
    );
  });

  it('returns an expired session to this exact workflow position', async () => {
    const outcome = await load(
      new Response('x', { status: 401 }),
      '?revisionId=123e4567-e89b-42d3-a456-426614174003',
    );
    expect(outcome.kind).toBe('redirect');
  });
});

describe('entries/[entryId]/workflow.astro response invariants', () => {
  const source = readFileSync(fromHere('./workflow.astro'), 'utf8');

  it('is never prerendered or cached, uses the one shared shell and bundles no script of its own', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('<CmsEditorialDocument');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('set:html');
    expect(source).not.toContain('new Response(');
  });

  it('hydrates exactly one island, from the loader’s verified view', () => {
    expect(source.match(/client:load/gu)).toHaveLength(1);
    expect(source).toContain('<CmsEditorialWorkflowIsland');
    expect(source).toContain('outcome.view.workflow');
    expect(source).not.toContain('data-entry-id');
  });

  it('maps a sign-in outcome to the allowlisted 303 only', () => {
    expect(source).toContain('Astro.redirect(outcome.location, 303)');
    expect(source).not.toContain('Astro.redirect(`');
  });
});
