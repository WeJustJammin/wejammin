import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SRC_ROOT, staticClosure } from './island-static-closure.test-support';

/**
 * FE03 "Performance budgets and loading strategy" (AC261, AC-106): the CMS
 * editorial islands hydrate on every route of their surface, so zod, the
 * contract barrel and the lazy validators are never in their STATIC import
 * closure. `pnpm bundle:check` proves the byte budgets on the real build; this
 * is the source-level guard that names the module which dragged a forbidden
 * dependency into an island. Dynamic `import()` edges are the lazy chunks and
 * are not followed; `import type` is erased and not counted.
 */

const COMPONENTS = resolve(SRC_ROOT, 'components');

/** Every browser entry of the CMS content-modeling surface that hydrates or runs at load. */
const ENTRIES: readonly string[] = [
  'cms-editorial/CmsEditorialEntryEditorIsland.tsx',
  'cms-editorial/CmsEditorialEntryCreateIsland.tsx',
  'cms-editorial/CmsEditorialConflictResolveIsland.tsx',
  'cms-editorial-workflow/CmsEditorialWorkflowIsland.tsx',
  'cms-editorial-workflow/CmsEditorialReviewDetailIsland.tsx',
  'cms-capability-grants/CmsCapabilityGrantConsoleIsland.tsx',
  'cms-composition/CmsTemplateDesigner.tsx',
  'cms-composition/CmsTemplateEditDesigner.tsx',
  'cms-governed-review/CmsGovernedReviewDetailIsland.tsx',
  'cms-governed-review/CmsGovernedTemplatePanel.tsx',
  'cms-governed-review/CmsGovernedPatternPanel.tsx',
].map((entry) => resolve(COMPONENTS, entry));

/** The document shell scripts every CMS editorial page loads. */
const DOCUMENT_SCRIPTS: readonly string[] = [
  'lib/cms-editorial-page-actions.ts',
  'lib/route-heading-focus.ts',
  'lib/auth-scope-sync.ts',
].map((entry) => resolve(SRC_ROOT, entry));

const FORBIDDEN = [
  'zod <-',
  '@wejammin/contracts <-',
  '@wejammin/contracts/cms-editorial/validators <-',
  '@wejammin/contracts/content-schema-registry/validators <-',
  '@wejammin/contracts/time-authority <-',
];

describe('CMS editorial islands: static import closure', () => {
  it('names real entries', () => {
    for (const entry of [...ENTRIES, ...DOCUMENT_SCRIPTS])
      expect(existsSync(entry), entry).toBe(true);
  });

  it.each(
    [...ENTRIES, ...DOCUMENT_SCRIPTS].map(
      (entry) => [relative(SRC_ROOT, entry), entry] as const,
    ),
  )(
    '%s never reaches zod, the contract barrel or a lazy entry statically',
    (_name, entry) => {
      const forbidden = staticClosure(entry).packages.filter((imported) =>
        FORBIDDEN.some((prefix) => imported.startsWith(prefix)),
      );
      expect(forbidden).toEqual([]);
    },
  );

  it('keeps the zod-free browser entry as the only contracts import of an island', () => {
    for (const entry of ENTRIES) {
      const contracts = staticClosure(entry).packages.filter((imported) =>
        imported.startsWith('@wejammin/contracts'),
      );
      for (const imported of contracts)
        expect(imported, relative(SRC_ROOT, entry)).toMatch(
          /^@wejammin\/contracts\/client <-/u,
        );
    }
  });

  it('keeps the lazy validators behind the lazy loader only', () => {
    const loader = readFileSync(
      resolve(SRC_ROOT, 'lib/cms-contract-validators.ts'),
      'utf8',
    );
    expect(loader).toMatch(
      /import\('@wejammin\/contracts\/cms-editorial\/validators'\)/u,
    );
    expect(loader).not.toMatch(
      /^\s*import\s+(?!type\b)[^;]*@wejammin\/contracts/mu,
    );
  });
});
