import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WEB_SRC = import.meta.dirname;
const CONTRACTS = resolve(WEB_SRC, '../../../packages/contracts');
const CONSUMERS = [
  {
    name: 'related conflict review',
    file: 'components/cms-related-content/related-conflict-read.ts',
    validators: '@wejammin/contracts/cms-editorial/validators',
  },
  {
    name: 'effective configuration read',
    file: 'components/platform-configuration/settings-flags-runtime-controller-helpers.ts',
    validators: '@wejammin/contracts/platform-configuration/validators',
  },
] as const;

type Reference = Readonly<{ specifier: string; deferred: boolean }>;

const references = (source: string, file = 'boundary.ts'): Reference[] => {
  const references: Reference[] = [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const names = clause?.namedBindings;
      if (
        !clause?.isTypeOnly &&
        !(
          clause?.name === undefined &&
          names &&
          ts.isNamedImports(names) &&
          names.elements.length > 0 &&
          names.elements.every((name) => name.isTypeOnly)
        )
      )
        references.push({
          specifier: node.moduleSpecifier.text,
          deferred: false,
        });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        !node.isTypeOnly &&
        !(
          node.exportClause &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length > 0 &&
          node.exportClause.elements.every((name) => name.isTypeOnly)
        )
      )
        references.push({
          specifier: node.moduleSpecifier.text,
          deferred: false,
        });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument))
        references.push({ specifier: argument.text, deferred: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return references;
};

const sourceGraph = (entry: string, includeDeferred: boolean) => {
  const files = new Set<string>();
  const specifiers = new Set<string>();
  const barrelEdges: string[] = [];
  const unresolved: string[] = [];
  const pending = [entry];
  const manifest = JSON.parse(
    readFileSync(resolve(CONTRACTS, 'package.json'), 'utf8'),
  ) as {
    exports: Record<string, string>;
  };
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const reference of references(readFileSync(file, 'utf8'), file)) {
      if (reference.deferred && !includeDeferred) continue;
      const specifier = reference.specifier;
      specifiers.add(specifier);
      if (specifier === '@wejammin/contracts') {
        // This forbidden edge is sufficient proof; do not parse the entire server barrel.
        barrelEdges.push(file);
        continue;
      }
      let target: string | undefined;
      if (specifier.startsWith('.')) target = resolve(dirname(file), specifier);
      else if (specifier.startsWith('@wejammin/contracts/')) {
        const exported =
          manifest.exports[
            './' + specifier.slice('@wejammin/contracts/'.length)
          ];
        if (exported !== undefined) target = resolve(CONTRACTS, exported);
        else unresolved.push(`${file} -> ${specifier}`);
      }
      if (target === undefined) continue;
      const resolved = [
        target,
        `${target}.ts`,
        `${target}.tsx`,
        resolve(target, 'index.ts'),
      ].find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      if (resolved === undefined) unresolved.push(`${file} -> ${specifier}`);
      else pending.push(resolved);
    }
  }
  return { files, specifiers, barrelEdges, unresolved };
};

describe('browser consumers keep validator imports narrow and lazy', () => {
  it.each(CONSUMERS)(
    '[BROWSER-IMPORT-01] $name reaches only curated validators',
    ({ file, validators }) => {
      const graph = sourceGraph(resolve(WEB_SRC, file), true);
      expect(graph.barrelEdges).toEqual([]);
      expect(graph.unresolved).toEqual([]);
      expect(graph.specifiers.has(validators)).toBe(true);
      expect(
        [...graph.files].filter((path) =>
          path.startsWith(resolve(CONTRACTS, 'src/cms-delivery') + '/'),
        ),
      ).toEqual([]);
    },
  );

  it.each(CONSUMERS)(
    '[BROWSER-IMPORT-02] $name has no eager validator dependency',
    ({ file }) => {
      const graph = sourceGraph(resolve(WEB_SRC, file), false);
      expect(graph.barrelEdges).toEqual([]);
      expect(graph.unresolved).toEqual([]);
      expect(graph.specifiers.has('zod')).toBe(false);
      expect(
        [...graph.files].filter((path) => path.endsWith('/validators.ts')),
      ).toEqual([]);
      expect(
        [...graph.files].filter((path) =>
          path.startsWith(resolve(CONTRACTS, 'src/cms-delivery') + '/'),
        ),
      ).toEqual([]);
    },
  );

  it('[BROWSER-IMPORT-03] distinguishes runtime edges from type imports and import-like data', () => {
    expect(
      references(`
      import type * as Types from '@wejammin/contracts';
      import { type Shape } from '@wejammin/contracts';
      export type { Other } from '@wejammin/contracts';
      const decoy = "import('@wejammin/contracts')";
      // import('@wejammin/contracts')
      import { type Local, value } from './mixed';
      import {} from './side-effect';
      export { value } from './re-export';
      const lazy = () => import('@wejammin/contracts/cms-editorial/validators');
      type Module = typeof import('@wejammin/contracts');
    `),
    ).toEqual([
      { specifier: './mixed', deferred: false },
      { specifier: './side-effect', deferred: false },
      { specifier: './re-export', deferred: false },
      {
        specifier: '@wejammin/contracts/cms-editorial/validators',
        deferred: true,
      },
    ]);
  });
});
