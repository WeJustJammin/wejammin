import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * AC261 (FE03 Performance): the registry route starts at <=90 KB initial JS,
 * the workbench hydrated entry is <=35 KB, detail/editor modules are split and
 * nothing imports a barrel. The byte budgets are proven on the real build
 * (`pnpm bundle:check` and the production-built Chrome route); this test is
 * the source-level guard that explains a regression: it walks the island's
 * STATIC import closure (dynamic `import()` edges are the lazy chunks) and
 * names the module that dragged a forbidden dependency or a lazy view into the
 * initial graph.
 */

const ISLAND = resolve(
  import.meta.dirname,
  'ContentSchemaRegistryWorkbenchIsland.tsx',
);
const SRC_ROOT = resolve(import.meta.dirname, '../..');

const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu;

const resolveLocal = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

interface Closure {
  readonly files: readonly string[];
  /** Non-relative value imports as `<package> <- <importer>`. */
  readonly packages: readonly string[];
}

const staticClosure = (entry: string): Closure => {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(STATIC_IMPORT)) {
      if (match[1] !== undefined) continue;
      const specifier = match[2] as string;
      const local = resolveLocal(file, specifier);
      if (local !== null) pending.push(local);
      else if (!specifier.startsWith('.'))
        packages.add(`${specifier} <- ${relative(SRC_ROOT, file)}`);
    }
  }
  return {
    files: [...seen].map((file) => relative(SRC_ROOT, file)).sort(),
    packages: [...packages].sort(),
  };
};

const closure = staticClosure(ISLAND);

describe('[P2-S09-AC-261] registry island static import closure', () => {
  it('[P2-S09-AC-261] never reaches zod or the contracts barrel, so validation stays server-side or lazy', () => {
    const forbidden = closure.packages.filter(
      (entry) =>
        entry.startsWith('zod <-') ||
        entry.startsWith('@wejammin/contracts <-'),
    );
    expect(forbidden).toEqual([]);
  });

  it('[P2-S09-AC-261] keeps detail, review and editor modules out of the initial graph', () => {
    const lazyOnly = [
      'ContentSchemaRegistryDetail.tsx',
      'ContentSchemaRegistryReviewMode.tsx',
      'ContentSchemaRegistryReviewPanel.tsx',
      'ContentSchemaRegistryVersionCommands.tsx',
      'ContentSchemaRegistryActivationPreparation.tsx',
      'ContentSchemaRegistrySuccessorForm.tsx',
      'ContentSchemaRegistryFieldForm.tsx',
      'ContentSchemaRegistryRelationForm.tsx',
      'ContentSchemaRegistryActivationForm.tsx',
      'ContentSchemaRegistryReviewAssignmentForm.tsx',
      'ContentSchemaRegistryReviewDecisionForm.tsx',
    ];
    const reached = closure.files.filter((file) =>
      lazyOnly.some((name) => file.endsWith(`/${name}`)),
    );
    expect(reached).toEqual([]);
  });

  it('[P2-S09-AC-261] keeps job polling (a detail-only feature) out of the initial graph', () => {
    expect(
      closure.files.filter(
        (file) =>
          file.includes('infrastructure/jobs/') ||
          file.endsWith('lib/infrastructure-jobs.ts'),
      ),
    ).toEqual([]);
  });

  it('[P2-S09-AC-261] imports no barrel index module', () => {
    const barrels = closure.files.filter((file) =>
      /(^|\/)index\.tsx?$/u.test(file),
    );
    expect(barrels).toEqual([]);
    const interactionsBarrel = closure.files.filter((file) =>
      file.endsWith('ContentSchemaRegistryInteractions.tsx'),
    );
    expect(interactionsBarrel).toEqual([]);
  });
});
