import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import * as ts from 'typescript';

/**
 * A static import graph of one source tree, for the principal-boundary tests.
 * It reads module specifiers with the TypeScript parser, so a comment, a string
 * or a template that merely contains `from './x'` is not an import, and every
 * way a module can reach another is an edge: `import`, `import type`,
 * `export ... from`, `export * from`, `import x = require()`, `require()` and a
 * dynamic `import()`. Only relative specifiers can name a module of the tree
 * (the Worker has no path aliases), so a package specifier is never an edge.
 */

/** One module specifier of one source file. */
export type ImportEdge = Readonly<{
  /** The importing file, relative to the scanned root, with its extension. */
  from: string;
  /** The imported module without extension (and without `/index`), relative to the root. */
  to: string;
  /** The specifier exactly as written. */
  specifier: string;
  /** True when the build erases the edge: `import type`, `export type`, `typeof import()`. */
  typeOnly: boolean;
}>;

export type Importers = Readonly<{
  /** Files with at least one runtime edge to the module. */
  value: readonly string[];
  /** Files whose every edge to the module is erased by the build. */
  typeOnly: readonly string[];
}>;

const SOURCE_FILE = /\.(ts|tsx|mts)$/u;
const TEST_FILE = /\.test(-support)?\.(ts|tsx|mts)$/u;

const listing = (path: string): string[] | null => {
  try {
    return readdirSync(path);
  } catch {
    return null;
  }
};

/** The shipped source files under `root` (tests and test support are not part of the Worker bundle). */
export const shippedSourceFiles = (root: string): string[] =>
  (listing(root) ?? []).flatMap((name) => {
    const path = join(root, name);
    if (listing(path) !== null) return shippedSourceFiles(path);
    return SOURCE_FILE.test(name) && !TEST_FILE.test(name) ? [path] : [];
  });

/** `a/b.ts`, `a/b.js`, `a/b` and `a/b/index.ts` are all the module `a/b`. */
export const moduleStem = (path: string): string =>
  path
    .replaceAll('\\', '/')
    .replace(/\?.*$/u, '')
    .replace(/\.(?:ts|tsx|mts|js|mjs)$/u, '')
    .replace(/\/index$/u, '');

const stringLiteral = (node: ts.Node | undefined): string | null =>
  node !== undefined && ts.isStringLiteralLike(node) ? node.text : null;

/** Every module specifier of a file, with whether the build erases it. */
const specifiersOf = (
  source: ts.SourceFile,
): { specifier: string; typeOnly: boolean }[] => {
  const found: { specifier: string; typeOnly: boolean }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named =
        clause?.namedBindings !== undefined &&
        ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements
          : null;
      const typeOnly =
        clause !== undefined &&
        (clause.phaseModifier === ts.SyntaxKind.TypeKeyword ||
          (clause.name === undefined &&
            named !== null &&
            named.length > 0 &&
            named.every((element) => element.isTypeOnly)));
      const specifier = stringLiteral(node.moduleSpecifier);
      if (specifier !== null) found.push({ specifier, typeOnly });
    } else if (ts.isExportDeclaration(node)) {
      const specifier = stringLiteral(node.moduleSpecifier);
      const named =
        node.exportClause !== undefined && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements
          : null;
      if (specifier !== null)
        found.push({
          specifier,
          typeOnly:
            node.isTypeOnly ||
            (named !== null &&
              named.length > 0 &&
              named.every((element) => element.isTypeOnly)),
        });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const specifier = stringLiteral(node.moduleReference.expression);
      if (specifier !== null)
        found.push({ specifier, typeOnly: node.isTypeOnly });
    } else if (ts.isCallExpression(node)) {
      const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const required =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const specifier = stringLiteral(node.arguments[0]);
      if ((dynamic || required) && specifier !== null)
        found.push({ specifier, typeOnly: false });
    } else if (ts.isImportTypeNode(node)) {
      const argument = ts.isLiteralTypeNode(node.argument)
        ? stringLiteral(node.argument.literal)
        : null;
      if (argument !== null)
        found.push({ specifier: argument, typeOnly: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/** Parsing the whole tree dominates the cost of a boundary test; a file whose text is unchanged is parsed once. */
const parsed = new Map<
  string,
  readonly { specifier: string; typeOnly: boolean }[]
>();

const specifiersOfFile = (
  file: string,
): readonly { specifier: string; typeOnly: boolean }[] => {
  const text = readFileSync(file, 'utf8');
  const key = `${file.endsWith('.tsx') ? 'tsx' : 'ts'}\u0000${text}`;
  const known = parsed.get(key);
  if (known !== undefined) return known;
  const found = specifiersOf(
    ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true),
  );
  parsed.set(key, found);
  return found;
};

/** Every relative import edge of every shipped source file under `root`. */
export const importEdges = (root: string): ImportEdge[] =>
  shippedSourceFiles(root).flatMap((file) =>
    specifiersOfFile(file)
      .filter(({ specifier }) => specifier.startsWith('.'))
      .map(({ specifier, typeOnly }) => ({
        from: relative(root, file).replaceAll('\\', '/'),
        to: moduleStem(relative(root, resolve(dirname(file), specifier))),
        specifier,
        typeOnly,
      })),
  );

/** The files that import the module `target` (a path relative to `root`, with or without extension). */
export const importersOfModule = (root: string, target: string): Importers => {
  const stem = moduleStem(target);
  const edges = importEdges(root).filter((edge) => edge.to === stem);
  const sorted = (files: Iterable<string>): string[] =>
    [...new Set(files)].sort();
  const value = sorted(
    edges.filter((edge) => !edge.typeOnly).map((edge) => edge.from),
  );
  return {
    value,
    typeOnly: sorted(
      edges
        .filter((edge) => edge.typeOnly && !value.includes(edge.from))
        .map((edge) => edge.from),
    ),
  };
};
