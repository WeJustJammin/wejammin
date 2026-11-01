import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SRC_ROOT, staticClosure } from './island-static-closure.test-support';

/**
 * The entry editor is charged for what its island imports (P2-S11-AC-106, FE03 "Performance
 * budgets": editor modules load on explicit entry). The save flow, its outcome and stale-base
 * handling and the request support run only after the author has edited, so they load with the
 * first save instead of with the page.
 */
describe('entry editor island: the save flow loads with the first save', () => {
  const EDITOR = 'components/cms-editorial/CmsEditorialEntryEditorIsland.tsx';

  it.each([
    'cms-editorial-entry-editor-save.ts',
    'cms-editorial-entry-editor-stale-base.ts',
    'cms-editorial-entry-editor-outcomes.ts',
    'cms-editorial-request-support.ts',
  ])('keeps %s out of its static closure', (name) => {
    const module = `components/cms-editorial/${name}`;
    expect(existsSync(resolve(SRC_ROOT, module)), module).toBe(true);
    expect(staticClosure(resolve(SRC_ROOT, EDITOR)).files).not.toContain(
      module,
    );
  });

  it('loads the save flow through a dynamic import of the controller', () => {
    expect(
      readFileSync(
        resolve(
          SRC_ROOT,
          'components/cms-editorial/cms-editorial-entry-editor-controller.ts',
        ),
        'utf8',
      ),
    ).toMatch(/import\(\s*'\.\/cms-editorial-entry-editor-save'\s*\)/u);
  });
});

/**
 * The locale variant page is charged for what its form imports: the save and the source refresh run
 * only after the person acts (a save, a 409 review), so they load then.
 */
describe('locale variant form: the save and the source refresh load when used', () => {
  const FORM = 'components/cms-locale/CmsLocaleVariantForm.tsx';

  it.each(['locale-variant-submit.ts', 'locale-source-refresh.ts'])(
    'keeps %s out of its static closure',
    (name) => {
      const module = `components/cms-locale/${name}`;
      expect(existsSync(resolve(SRC_ROOT, module)), module).toBe(true);
      expect(staticClosure(resolve(SRC_ROOT, FORM)).files).not.toContain(
        module,
      );
    },
  );
});

/**
 * The vocabulary pages are charged for what their islands import: the writes (a version, a term
 * action) and the unknown-outcome check run only after the person acts.
 */
describe('taxonomy islands: the writes load when the person acts', () => {
  it.each([
    [
      'components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx',
      'components/cms-taxonomy-designer/taxonomy-designer-submit.ts',
    ],
    [
      'components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.tsx',
      'components/cms-taxonomy-designer/taxonomy-outcome-reconcile.ts',
    ],
    [
      'components/cms-taxonomy-terms/CmsTaxonomyTermForm.tsx',
      'components/cms-taxonomy-terms/term-action-submit.ts',
    ],
  ] as const)('%s keeps %s out of its static closure', (entry, module) => {
    expect(existsSync(resolve(SRC_ROOT, module)), module).toBe(true);
    expect(staticClosure(resolve(SRC_ROOT, entry)).files).not.toContain(module);
  });
});

/**
 * The field editors validate rich text synchronously and show one fixed sentence for a document
 * that is not canonical. That sentence lives in a module of its own so the editor, the locale
 * variant and the conflict pages do not load the whole refusal-copy table with it.
 */
describe('field editors: the refusal-copy table is not part of the cold load', () => {
  it.each([
    'components/cms-editorial-fields/CmsFieldEditor.tsx',
    'components/cms-rich-text/CmsRichTextEditor.tsx',
  ])(
    '%s keeps cms-editorial-reason-copy.ts out of its static closure',
    (entry) => {
      expect(staticClosure(resolve(SRC_ROOT, entry)).files).not.toContain(
        'components/cms-editorial/cms-editorial-reason-copy.ts',
      );
    },
  );
});

/**
 * The document shell loads on every CMS route (AC-106). Recovering a kept restore confirmation is
 * only needed on a page that holds a restore form (the revision history), so the recovery and the
 * step-up draft store behind it load there and nowhere else.
 */
describe('document shell: the restore recovery loads only on a page with a restore form', () => {
  const SHELL = 'lib/cms-editorial-page-actions.ts';

  it.each(['lib/cms-editorial-restore-draft.ts'])(
    'keeps %s out of the static closure of the shell script',
    (module) => {
      expect(existsSync(resolve(SRC_ROOT, module)), module).toBe(true);
      expect(staticClosure(resolve(SRC_ROOT, SHELL)).files).not.toContain(
        module,
      );
    },
  );

  it('imports the recovery dynamically, behind the restore form selector', () => {
    const core = readFileSync(
      resolve(SRC_ROOT, 'lib/cms-editorial-page-actions-core.ts'),
      'utf8',
    );
    // The import sits behind the `restoreDraftImporters` seam (a test replaces it to fail the load).
    const dom = readFileSync(
      resolve(SRC_ROOT, 'lib/cms-editorial-page-actions-dom.ts'),
      'utf8',
    );
    expect(dom).toMatch(/import\(\s*'\.\/cms-editorial-restore-draft'\s*\)/u);
    expect(core).toContain('restoreDraftImporters');
    expect(core).toContain('form[data-cms-editorial-restore]');
  });
});

/**
 * The page that follows create, resolve and restore shows the result of the command without the
 * person doing anything, so the editor island holds the reader of the result and the panel (the
 * bundle gate would charge the route for them as a lazy chunk anyway, V11 M4). What stays out of
 * the editor's static closure is the writer, which only the producers load when a command commits.
 */
describe('entry editor island: the result reader is in the island, the writer is not', () => {
  const EDITOR = 'components/cms-editorial/CmsEditorialEntryEditorIsland.tsx';

  it.each([
    'components/cms-editorial/cms-editorial-result-take.ts',
    'components/cms-editorial/CmsEditorialResultPanel.tsx',
    'components/identity-authority/step-up-mfa/step-up-draft.ts',
  ])('holds %s in its static closure', (module) => {
    expect(existsSync(resolve(SRC_ROOT, module)), module).toBe(true);
    expect(staticClosure(resolve(SRC_ROOT, EDITOR)).files).toContain(module);
  });

  it.each([
    'components/cms-editorial/cms-editorial-result-save.ts',
    'components/cms-editorial/cms-editorial-result-handoff.ts',
  ])('keeps %s out of its static closure', (module) => {
    expect(existsSync(resolve(SRC_ROOT, module)), module).toBe(true);
    expect(staticClosure(resolve(SRC_ROOT, EDITOR)).files).not.toContain(
      module,
    );
  });
});

/** The conflict and create pages leave the result for the editor only after a command committed. */
describe('conflict and create islands: the result handoff loads when a command commits', () => {
  it.each([
    'components/cms-editorial/CmsEditorialConflictResolveIsland.tsx',
    'components/cms-editorial/CmsEditorialEntryCreateIsland.tsx',
  ])(
    '%s keeps the handoff and the step-up draft store out of its static closure',
    (entry) => {
      const closure = staticClosure(resolve(SRC_ROOT, entry)).files;
      for (const module of [
        'components/cms-editorial/cms-editorial-result-take.ts',
        'components/cms-editorial/cms-editorial-result-save.ts',
        'components/cms-editorial/cms-editorial-result-handoff.ts',
        'components/identity-authority/step-up-mfa/step-up-draft.ts',
      ])
        expect(closure, module).not.toContain(module);
    },
  );
});
