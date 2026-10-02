import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildContentSchemaRegistryBrowserOpenApiDocument,
  buildContentSchemaRegistryOpenApiDocument,
  buildProfilePortfolioOpenApiDocument,
  collectSchemaReferences,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');

const resolveLocalReference = (
  document: unknown,
  reference: string,
): unknown => {
  if (!reference.startsWith('#/')) return undefined;
  return reference
    .slice(2)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>((value, segment) => {
      if (
        typeof value !== 'object' ||
        value === null ||
        !Object.hasOwn(value, segment)
      )
        return undefined;
      return (value as Record<string, unknown>)[segment];
    }, document);
};

// Traversal lives in the contracts package so this test and the anchoring
// rewrite can never disagree about which `$ref` values are structural. Literal
// sample and annotation data, plus opaque vendor extensions, are skipped.
const findDanglingReferences = (document: unknown): readonly string[] =>
  collectSchemaReferences(document)
    .filter(
      ({ reference }) =>
        resolveLocalReference(document, reference) === undefined,
    )
    .map(({ path, reference }) => `${path}: ${reference}`);

const findUnanchoredDefinitionsReferences = (
  document: unknown,
): readonly string[] =>
  collectSchemaReferences(document)
    .filter(({ reference }) => reference.startsWith('#/definitions/'))
    .map(({ path, reference }) => `${path}: ${reference}`);

const generatedDocuments: ReadonlyArray<
  readonly [name: string, buildDocument: () => unknown]
> = [
  [
    'the published document',
    () =>
      JSON.parse(
        readFileSync(
          resolve(repositoryRoot, 'docs/openapi/openapi.json'),
          'utf8',
        ),
      ) as unknown,
  ],
  [
    'the content schema registry internal document',
    buildContentSchemaRegistryOpenApiDocument,
  ],
  [
    'the content schema registry browser document',
    buildContentSchemaRegistryBrowserOpenApiDocument,
  ],
  [
    'the profile portfolio active document',
    () => buildProfilePortfolioOpenApiDocument(),
  ],
  [
    'the profile portfolio deferred document',
    () => buildProfilePortfolioOpenApiDocument({ includeDeferred: true }),
  ],
];

describe('generated OpenAPI reference integrity', () => {
  it.each(generatedDocuments)(
    'resolves every local reference in %s from its document root',
    (_name, buildDocument) => {
      expect(findDanglingReferences(buildDocument())).toEqual([]);
    },
  );

  it.each(generatedDocuments)(
    'exposes local references in %s so the assertions cannot pass vacuously',
    (_name, buildDocument) => {
      expect(collectSchemaReferences(buildDocument()).length).toBeGreaterThan(
        0,
      );
    },
  );

  it.each(generatedDocuments)(
    'anchors every draft-7 definitions reference in %s to its emitting component',
    (_name, buildDocument) => {
      expect(findUnanchoredDefinitionsReferences(buildDocument())).toEqual([]);
    },
  );

  it('ignores reference-shaped literal data that does not resolve', () => {
    const document = {
      components: {
        schemas: {
          Present: { type: 'string' },
          Example: {
            example: { $ref: '#/definitions/absent' },
            'x-custom': { $ref: '#/definitions/absent' },
            properties: { value: { $ref: '#/components/schemas/Present' } },
          },
        },
      },
    };

    expect(findDanglingReferences(document)).toEqual([]);
    expect(collectSchemaReferences(document).map(({ path }) => path)).toEqual([
      '/components/schemas/Example/properties/value/$ref',
    ]);
  });
});
