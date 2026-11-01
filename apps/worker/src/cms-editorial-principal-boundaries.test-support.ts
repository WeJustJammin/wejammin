import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  importersOfModule,
  shippedSourceFiles,
  type Importers,
} from './import-graph.test-support';

/*
 * DEC-156 / P2-S11-AC-113 / P2-S11-AC-118 (review B-03): the import-graph allow-lists of the two actorless
 * service-role seams that have no browser route. cms-editorial-principals.test.ts asserts them against the
 * real Worker tree; cms-editorial-principals-mutation.test.ts proves they bite by applying each way a
 * module can reach a protected port to a copy of that tree. The table lives here so both read ONE
 * statement of the boundary.
 */

const RECHECK = 'cms-editorial/review-recheck';

export type ImportBoundary = Readonly<{
  /** Why the module is a boundary. */
  reason: string;
  /** The module, relative to the Worker source root. */
  module: string;
  /** The only files that may import it at runtime. */
  value: readonly string[];
  /** The only files that may import it as an erased type. */
  typeOnly: readonly string[];
}>;

export const RECHECK_IMPORT_BOUNDARIES = {
  names: {
    reason: 'the actorless recheck RPC names',
    module: `${RECHECK}/rpc-names`,
    value: [`${RECHECK}/rpc.ts`],
    typeOnly: ['async-runtime-rpc-types.ts'],
  },
  ports: {
    reason: 'the recheck RPC wrappers (resolve_event and run)',
    module: `${RECHECK}/rpc`,
    value: [`${RECHECK}/production.ts`],
    typeOnly: [],
  },
  composition: {
    reason: 'the recheck production composition that builds the wrappers',
    module: `${RECHECK}/production`,
    value: ['production-async-entrypoint.ts'],
    typeOnly: [],
  },
  takedown: {
    reason:
      'the preview takedown port (no caller until its Shard 16 consumer exists)',
    module: 'cms-editorial-production-preview-takedown',
    value: [],
    typeOnly: [],
  },
} as const satisfies Readonly<Record<string, ImportBoundary>>;

/**
 * Identifiers a copy, an alias or a re-declaration would leave behind: the wrapper factory and the name
 * table appear in the files that define and compose them and nowhere else.
 */
export const RECHECK_IDENTIFIER_MENTIONS: Readonly<
  Record<string, readonly string[]>
> = {
  createReviewRecheckRpcPorts: [
    `${RECHECK}/production.ts`,
    `${RECHECK}/rpc.ts`,
  ],
  CMS_REVIEW_RECHECK_RPC: [`${RECHECK}/rpc-names.ts`, `${RECHECK}/rpc.ts`],
};

/**
 * The RPC literals themselves (quoted, as they would be written in a call): the names module holds the
 * recheck pair and the takedown port holds its own, so a module cannot call a service-role RPC by
 * spelling its name and skipping the import.
 */
export const PROTECTED_RPC_LITERALS: Readonly<
  Record<string, readonly string[]>
> = {
  cms_dependency_recheck_resolve_event: [`${RECHECK}/rpc-names.ts`],
  cms_dependency_recheck_run: [`${RECHECK}/rpc-names.ts`],
  cms_takedown_preview_tokens: ['cms-editorial-production-preview-takedown.ts'],
};

/** The shipped files of `root` that contain `identifier`, relative to `root`. */
export const mentionsOfIdentifier = (
  root: string,
  identifier: string,
): string[] =>
  shippedSourceFiles(root)
    .filter((file) => readFileSync(file, 'utf8').includes(identifier))
    .map((file) => relative(root, file).replaceAll('\\', '/'))
    .sort();

const sameFiles = (
  actual: readonly string[],
  allowed: readonly string[],
): boolean =>
  actual.length === allowed.length &&
  actual.every((file, index) => file === allowed[index]);

/** Every deviation of the tree under `root` from the boundary above; empty when it is honoured. */
export const recheckBoundaryViolations = (root: string): string[] => [
  ...Object.values(RECHECK_IMPORT_BOUNDARIES).flatMap(
    (boundary: ImportBoundary) => {
      const actual: Importers = importersOfModule(root, boundary.module);
      return [
        ...(sameFiles(actual.value, boundary.value)
          ? []
          : [
              `${boundary.module}: runtime importers [${actual.value.join(', ')}], allowed [${boundary.value.join(', ')}]`,
            ]),
        ...(sameFiles(actual.typeOnly, boundary.typeOnly)
          ? []
          : [
              `${boundary.module}: type-only importers [${actual.typeOnly.join(', ')}], allowed [${boundary.typeOnly.join(', ')}]`,
            ]),
      ];
    },
  ),
  ...Object.entries(PROTECTED_RPC_LITERALS).flatMap(([name, allowed]) => {
    const actual = mentionsOfIdentifier(root, `'${name}'`);
    return sameFiles(actual, allowed)
      ? []
      : [
          `'${name}': spelled in [${actual.join(', ')}], allowed [${allowed.join(', ')}]`,
        ];
  }),
  ...Object.entries(RECHECK_IDENTIFIER_MENTIONS).flatMap(
    ([identifier, allowed]) => {
      const actual = mentionsOfIdentifier(root, identifier);
      return sameFiles(actual, allowed)
        ? []
        : [
            `${identifier}: named in [${actual.join(', ')}], allowed [${allowed.join(', ')}]`,
          ];
    },
  ),
];
