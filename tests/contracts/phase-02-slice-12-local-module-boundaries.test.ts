import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

// SCOPE: Slice 12 local module boundaries only. Source-shape guards for
// .agents/rules/extensibility.md: a test file is at most 400 physical lines and
// the dependency graph is a DAG. The citation fixture graph is read from the
// TypeScript AST, so a type-only `import type` or re-export is a real edge and
// is never skipped. Structural guards only: no acceptance, clause coverage,
// evidence depth, receipt validity or runtime behaviour.

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const contractsDir = join(repositoryRoot, 'tests', 'contracts');

const physicalLineCount = (file: string): number => {
  const text = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  const lines = text.split('\n');
  // Only a trailing newline adds a final empty split; nothing else is dropped.
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
};

const CLUSTER_PREFIX = 'phase-02-slice-12-unit-citation-reconciliation-';
const CLUSTER_ENTRIES = [
  'phase-02-slice-12-unit-citation-reconciliation-fixtures.ts',
  'phase-02-slice-12-unit-citation-reconciliation-moved.ts',
];

const isClusterSpecifier = (specifier: string): boolean => {
  const stem = basename(specifier.replace(/\.(?:ts|tsx|js|mjs|cjs)$/u, ''));
  return specifier.startsWith('.') && stem.startsWith(CLUSTER_PREFIX);
};

const clusterModuleFile = (importer: string, specifier: string): string => {
  const base = resolve(dirname(importer), specifier);
  const extensions = ['.ts', '.tsx'];
  const candidates = extensions.map((extension) => base + extension);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) {
    throw new Error(`Missing cluster module ${specifier} from ${importer}`);
  }
  return found;
};

const moduleSpecifiers = (file: string): readonly string[] => {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (specifier !== undefined && ts.isStringLiteralLike(specifier)) {
        specifiers.push(specifier.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const clusterGraph = (): ReadonlyMap<string, readonly string[]> => {
  const graph = new Map<string, string[]>();
  const pending = CLUSTER_ENTRIES.map((entry) => join(contractsDir, entry));
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined) break;
    const key = relative(repositoryRoot, file).replaceAll('\\', '/');
    if (graph.has(key)) continue;
    const edges: string[] = [];
    graph.set(key, edges);
    for (const specifier of moduleSpecifiers(file)) {
      if (!isClusterSpecifier(specifier)) continue;
      const target = clusterModuleFile(file, specifier);
      const targetKey = relative(repositoryRoot, target).replaceAll('\\', '/');
      edges.push(targetKey);
      if (!graph.has(targetKey)) pending.push(target);
    }
  }
  for (const [node, edgeList] of graph) {
    graph.set(node, [...new Set(edgeList)].sort());
  }
  return graph;
};

const importCycles = (
  graph: ReadonlyMap<string, readonly string[]>,
): readonly (readonly string[])[] => {
  const nodes = [...graph.keys()].sort();
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const walk = (node: string): void => {
    visited.add(node);
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (onStack.has(next)) {
        cycles.push(stack.slice(stack.indexOf(next)));
      } else if (!visited.has(next)) {
        walk(next);
      }
    }
    stack.pop();
    onStack.delete(node);
  };
  for (const node of nodes) {
    if (!visited.has(node)) walk(node);
  }
  return cycles;
};

describe('Slice 12 local module boundaries', () => {
  it.each([
    'apps/worker/src/cms-composition/template-context-routes.test.ts',
    'apps/worker/src/cms-composition/template-detail-routes.test.ts',
  ])('%s stays within the 400-line test-file limit', (relativePath) => {
    const lineCount = physicalLineCount(join(repositoryRoot, relativePath));
    expect(lineCount).toBeLessThanOrEqual(400);
  });

  it('keeps the citation-reconciliation fixture module graph acyclic', () => {
    expect(importCycles(clusterGraph())).toEqual([]);
  });
});
