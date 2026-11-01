import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import * as barrel from './index.ts';
import * as cmsValidators from './cms-editorial/validators.ts';

const CONTRACTS_SRC = import.meta.dirname;
const PLATFORM_ENTRY = resolve(
  CONTRACTS_SRC,
  'platform-configuration/validators.ts',
);
const PRIVATE_EXPORTS = [
  'RouteManifestVersionStorageSchema',
  'PublicationProjectionStorageSchema',
  'RouteManifestVersionStorageStateSchema',
  'PublicationProjectionStorageStateSchema',
];

const valueSpecifiers = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];
  for (const node of source.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const names = clause?.namedBindings;
      if (
        clause?.isTypeOnly ||
        (clause?.name === undefined &&
          names &&
          ts.isNamedImports(names) &&
          names.elements.length > 0 &&
          names.elements.every((name) => name.isTypeOnly))
      )
        continue;
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        node.isTypeOnly ||
        (node.exportClause &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length > 0 &&
          node.exportClause.elements.every((name) => name.isTypeOnly))
      )
        continue;
      specifiers.push(node.moduleSpecifier.text);
    }
  }
  return specifiers;
};

const runtimeClosure = (entry: string) => {
  const files = new Set<string>();
  const active = new Set<string>();
  const external = new Set<string>();
  const cycles: string[] = [];
  const visit = (file: string): void => {
    if (active.has(file)) {
      cycles.push(file);
      return;
    }
    if (files.has(file)) return;
    active.add(file);
    for (const specifier of valueSpecifiers(file)) {
      if (!specifier.startsWith('.')) {
        external.add(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier);
      expect(existsSync(target), `${file} -> ${specifier}`).toBe(true);
      expect(statSync(target).isFile(), target).toBe(true);
      visit(target);
    }
    active.delete(file);
    files.add(file);
  };
  visit(entry);
  return { files, cycles, external };
};

const expectPrivateFreeClosure = (entry: string): void => {
  const graph = runtimeClosure(entry);
  expect(graph.cycles).toEqual([]);
  expect([...graph.external].sort()).toEqual(['zod']);
  expect(graph.files.has(resolve(CONTRACTS_SRC, 'index.ts'))).toBe(false);
  expect(
    [...graph.files].filter((file) =>
      file.startsWith(resolve(CONTRACTS_SRC, 'cms-delivery') + '/'),
    ),
  ).toEqual([]);
};

describe('narrow browser validator entries', () => {
  it('[BROWSER-VALIDATOR-01] exposes the original related rule read schema', () => {
    expect(
      (cmsValidators as Record<string, unknown>).RelatedContentRuleReadSchema,
    ).toBe(barrel.RelatedContentRuleReadSchema);
  });

  it('[BROWSER-VALIDATOR-02] exposes the original entry-binding predicate', () => {
    expect(
      (cmsValidators as Record<string, unknown>).relatedRuleReadAnswersEntry,
    ).toBe(barrel.relatedRuleReadAnswersEntry);
  });

  it('[BROWSER-VALIDATOR-03] registers the narrow platform package subpath', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(CONTRACTS_SRC, '../package.json'), 'utf8'),
    ) as {
      exports: Record<string, string>;
    };
    expect(manifest.exports['./platform-configuration/validators']).toBe(
      './src/platform-configuration/validators.ts',
    );
  });

  it('[BROWSER-VALIDATOR-04] exposes only the identical effective response schema', async () => {
    // Guard inside the case: an absent future entry is assertion RED, not an import abort.
    expect(existsSync(PLATFORM_ENTRY), PLATFORM_ENTRY).toBe(true);
    if (!existsSync(PLATFORM_ENTRY)) return;
    const validators: Record<string, unknown> = await import(
      /* @vite-ignore */ PLATFORM_ENTRY
    );
    expect(Object.keys(validators)).toEqual([
      'Cfg05a02EffectiveValueResponseSchema',
    ]);
    expect(validators.Cfg05a02EffectiveValueResponseSchema).toBe(
      barrel.Cfg05a02EffectiveValueResponseSchema,
    );
    for (const name of PRIVATE_EXPORTS)
      expect(validators).not.toHaveProperty(name);
  });

  it('[BROWSER-VALIDATOR-05] keeps the entire CMS entry acyclic and private-free', () => {
    expectPrivateFreeClosure(
      resolve(CONTRACTS_SRC, 'cms-editorial/validators.ts'),
    );
    for (const name of PRIVATE_EXPORTS)
      expect(cmsValidators).not.toHaveProperty(name);
  });

  it('[BROWSER-VALIDATOR-06] keeps the entire platform entry acyclic and private-free', () => {
    expect(existsSync(PLATFORM_ENTRY), PLATFORM_ENTRY).toBe(true);
    if (!existsSync(PLATFORM_ENTRY)) return;
    expectPrivateFreeClosure(PLATFORM_ENTRY);
  });
});
