import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * P2-S11-AC-098: `cms.a11y.structural` is "an in-process pure TypeScript Worker
 * module with no network provider, DOM or Browser Rendering provider" (BE05c
 * runtime row). This architecture test reads every non-test source of the
 * directory, and every local module they import, as a TypeScript syntax tree
 * and fails when any of them names a network, DOM, Browser Rendering or
 * environment binding, or imports a package outside a closed allow-list. It
 * reads identifiers and import specifiers, not text, so a comment or a message
 * string that mentions "document" or "fetch" is not a violation, and a call
 * hidden in a template expression is.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** Identifiers a pure module can have no reason to name. */
const FORBIDDEN_IDENTIFIERS = new Set([
  // network
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'WebTransport',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'sendBeacon',
  // DOM
  'document',
  'window',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'DOMParser',
  'HTMLElement',
  // Browser Rendering and headless browsers
  'puppeteer',
  'playwright',
  'BROWSER',
  'Browser',
  'axe',
  // environment and bindings
  'process',
  'env',
  'globalThis',
  'self',
  'caches',
  'D1Database',
  'KVNamespace',
  'R2Bucket',
  'DurableObjectNamespace',
  'Queue',
  'Fetcher',
]);

/** Packages a pure module may import; everything else must be a local file. */
const ALLOWED_PACKAGES = new Set(['@wejammin/contracts', 'zod']);

const isTestFile = (name: string): boolean =>
  /\.test(-support)?\.ts$/u.test(name);

const productionSources = (): string[] =>
  readdirSync(here)
    .filter((name) => name.endsWith('.ts') && !isTestFile(name))
    .map((name) => join(here, name))
    .sort();

type Facts = Readonly<{
  specifiers: string[];
  identifiers: string[];
  hasImportMeta: boolean;
}>;

/**
 * True when the identifier reads or declares a binding. A member name is not a
 * reference: `field.document` and `{ document: parsed }` are data members of
 * the checker, not the DOM global.
 */
const isReference = (node: ts.Identifier): boolean => {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(parent)) return parent.name !== node;
  if (ts.isQualifiedName(parent)) return parent.right !== node;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  return !(
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === node
  );
};

const factsOfText = (name: string, text: string): Facts => {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.ESNext, true);
  const specifiers: string[] = [];
  const identifiers: string[] = [];
  let hasImportMeta = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      const [argument] = node.arguments;
      specifiers.push(
        argument !== undefined && ts.isStringLiteralLike(argument)
          ? argument.text
          : '<dynamic>',
      );
    }
    if (ts.isIdentifier(node) && isReference(node)) identifiers.push(node.text);
    if (ts.isMetaProperty(node)) hasImportMeta = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { specifiers, identifiers, hasImportMeta };
};

const factsOf = (file: string): Facts =>
  factsOfText(file, readFileSync(file, 'utf8'));

const forbiddenIn = (identifiers: readonly string[]): string[] =>
  identifiers.filter((identifier) => FORBIDDEN_IDENTIFIERS.has(identifier));

const isFile = (path: string): boolean => {
  try {
    readFileSync(path, 'utf8');
    return true;
  } catch {
    return false;
  }
};

/** The local file a relative specifier names, or null for a package. */
const resolveLocal = (from: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts'), base])
    if (candidate.endsWith('.ts') && isFile(candidate)) return candidate;
  throw new Error(`cannot resolve ${specifier} from ${from}`);
};

/** Every module reachable from the directory's production sources through local imports. */
const closure = (): string[] => {
  const seen = new Set<string>();
  const pending = [...productionSources()];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of factsOf(file).specifiers) {
      const local = resolveLocal(file, specifier);
      if (local !== null) pending.push(local);
    }
  }
  return [...seen].sort();
};

const relative = (file: string): string => file.slice(here.length + 1);

describe('cms.a11y.structural has no network, DOM, Browser Rendering or environment dependency (P2-S11-AC-098)', () => {
  it('reads the production sources of the directory and the local modules they reach', () => {
    const sources = productionSources().map(relative);
    for (const name of [
      'checker.ts',
      'gate.ts',
      'input-schema.ts',
      'hashes.ts',
      'evidence.ts',
      'rules-link.ts',
    ])
      expect(sources).toContain(name);
    expect(sources.some((name) => isTestFile(name))).toBe(false);
    // the JCS module sits outside this directory and is judged like the rest
    expect(
      closure().some((file) => file.endsWith('/migration-transform-jcs.ts')),
    ).toBe(true);
  });

  it.each(closure().map((file) => [file.replace(`${here}/`, ''), file]))(
    '%s names no forbidden global, binding or import.meta',
    (_name, file) => {
      const facts = factsOf(file as string);
      expect(forbiddenIn([...new Set(facts.identifiers)])).toEqual([]);
      expect(facts.hasImportMeta).toBe(false);
    },
  );

  it.each(closure().map((file) => [file.replace(`${here}/`, ''), file]))(
    '%s imports only local files, the contracts package and zod',
    (_name, file) => {
      const packages = factsOf(file as string).specifiers.filter(
        (specifier) => !specifier.startsWith('.'),
      );
      expect(packages.filter((name) => !ALLOWED_PACKAGES.has(name))).toEqual(
        [],
      );
    },
  );

  it('imports zod only through the zod-runtime seam', () => {
    const importers = productionSources().filter((file) =>
      factsOf(file).specifiers.includes('zod'),
    );
    expect(importers.map(relative)).toEqual(['zod-runtime.ts']);
  });

  it('detects what it forbids: a fixture that fetches, reads the DOM or reaches an env binding is flagged', () => {
    const flagged = (code: string): string[] =>
      forbiddenIn(factsOfText('fixture.ts', code).identifiers);
    expect(flagged('await fetch("https://example.org")')).toEqual(['fetch']);
    expect(flagged('const t = `${document.title}`')).toEqual(['document']);
    expect(flagged('export const run = (env: Env) => env.BROWSER')).toEqual([
      'env',
      'env',
    ]);
    expect(flagged('void puppeteer.launch(); new WebSocket(u)')).toEqual([
      'puppeteer',
      'WebSocket',
    ]);
    // comments, message strings and member names are not references
    expect(flagged('// fetch the document\nconst m = "window"')).toEqual([]);
    expect(
      flagged('const a = { document: 1 }; a.document; type T = { env: 1 }'),
    ).toEqual([]);
  });
});
