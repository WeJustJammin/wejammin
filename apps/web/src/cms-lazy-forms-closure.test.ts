import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SRC_ROOT, staticClosure } from './island-static-closure.test-support';

/**
 * FE03 "Performance budgets and loading strategy" (:1736-1745): an island stays within 35 KB
 * and its page within 90 KB of initial JavaScript. The governed review surfaces hydrate
 * beside a designer (pattern, taxonomy, template pages) or alone (definition review detail),
 * and their command forms carry the command machinery. A form loads the first time the server
 * offers its action, so that machinery is never in the island's STATIC closure; a reader who
 * is never offered the action never fetches it. `pnpm bundle:check` proves the bytes on the
 * real build; this guard names the module that dragged the machinery back in.
 */
const GOVERNED = resolve(SRC_ROOT, 'components/cms-governed-review');

const ENTRIES = [
  'CmsGovernedReviewDetailIsland.tsx',
  'CmsGovernedPatternPanel.tsx',
  'CmsGovernedTaxonomyPanel.tsx',
  'CmsGovernedTemplatePanel.tsx',
] as const;

/** The command machinery of the governed forms: only a lazily loaded form may import it. */
const COMMAND_MACHINERY = [
  'components/cms-governed-review/use-governed-review-command.ts',
  'components/cms-governed-review/governed-review-command-specs.ts',
  'components/cms-governed-review/governed-review-command-transport.ts',
  'components/cms-editorial-workflow/use-cms-workflow-command.ts',
  'components/cms-editorial-workflow/CmsWorkflowCommandFrame.tsx',
] as const;

/** A panel has one command; the polite announcer of its result loads with that form. */
const PANEL_ANNOUNCER = [
  'components/cms-editorial-workflow/use-cms-workflow-status.ts',
  'components/cms-editorial-workflow/CmsWorkflowStatusRegion.tsx',
] as const;

describe('governed review islands: command machinery is lazy', () => {
  it.each(ENTRIES)(
    '%s keeps the command machinery out of its static closure',
    (entry) => {
      const files = staticClosure(resolve(GOVERNED, entry)).files;
      expect(
        files.filter((file) => COMMAND_MACHINERY.includes(file as never)),
      ).toEqual([]);
    },
  );

  it.each(ENTRIES.filter((name) => name.endsWith('Panel.tsx')))(
    '%s loads the announcer of the submit result with the form',
    (entry) => {
      const files = staticClosure(resolve(GOVERNED, entry)).files;
      expect(
        files.filter((file) => PANEL_ANNOUNCER.includes(file as never)),
      ).toEqual([]);
    },
  );

  it('names real machinery modules', () => {
    const forms = staticClosure(
      resolve(GOVERNED, 'CmsGovernedDecisionForm.tsx'),
    ).files;
    for (const file of COMMAND_MACHINERY) {
      expect(existsSync(resolve(SRC_ROOT, file)), file).toBe(true);
      // The transport is a dynamic import of the form's hook (answer machinery): only the rest is static.
      if (!file.endsWith('governed-review-command-transport.ts'))
        expect(forms, file).toContain(file);
    }
  });

  it('keeps the panel submit form in a module of its own, reached only by a dynamic import', () => {
    const form = 'components/cms-governed-review/CmsGovernedSubmitForm.tsx';
    expect(existsSync(resolve(SRC_ROOT, form))).toBe(true);
    for (const entry of ENTRIES)
      expect(
        staticClosure(resolve(GOVERNED, entry)).files,
        entry,
      ).not.toContain(form);
  });

  it('keeps the read-only review view out of the panels, which only link to the queue', () => {
    const view = 'components/cms-governed-review/CmsGovernedReviewDetail.tsx';
    for (const entry of ENTRIES.filter((name) => name.endsWith('Panel.tsx')))
      expect(
        staticClosure(resolve(GOVERNED, entry)).files,
        entry,
      ).not.toContain(view);
  });

  it('reaches only the lifecycle labels, not the whole copy table of the review view', () => {
    const table = 'components/cms-governed-review/governed-review-labels.ts';
    for (const entry of ENTRIES.filter((name) => name.endsWith('Panel.tsx')))
      expect(
        staticClosure(resolve(GOVERNED, entry)).files,
        entry,
      ).not.toContain(table);
  });
});

describe('CMS workflow islands: command forms are lazy', () => {
  const WORKFLOW = resolve(SRC_ROOT, 'components/cms-editorial-workflow');
  const FORMS = [
    ['CmsEditorialReviewDetailIsland.tsx', 'CmsEditorialDecisionForm.tsx'],
    [
      'CmsEditorialReviewDetailIsland.tsx',
      'CmsEditorialReviewAssignmentForm.tsx',
    ],
  ] as const;

  it.each(FORMS)('%s keeps %s out of its static closure', (island, form) => {
    expect(existsSync(resolve(WORKFLOW, form)), form).toBe(true);
    const files = staticClosure(resolve(WORKFLOW, island)).files;
    expect(files).not.toContain(`components/cms-editorial-workflow/${form}`);
    expect(files).not.toContain(
      'components/cms-editorial-workflow/use-cms-workflow-command.ts',
    );
  });
});
