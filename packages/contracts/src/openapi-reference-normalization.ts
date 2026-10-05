const LOCAL_DEFINITION_PREFIX = '#/definitions/';
const LOCAL_REFERENCE_KEY = '$ref';

/** Keywords whose values are literal sample/annotation data, never schemas. */
const LITERAL_DATA_KEYS: ReadonlySet<string> = new Set([
  'const',
  'default',
  'enum',
  'example',
  'examples',
]);

/** Keywords that map arbitrary names to subschemas, so their keys are not keywords. */
const SCHEMA_MAP_KEYS: ReadonlySet<string> = new Set([
  '$defs',
  'definitions',
  'patternProperties',
  'properties',
]);

/**
 * Vendor extensions whose values are schemas, so local definitions references
 * inside them are structural and must be anchored. Every other `x-` extension
 * is opaque data and is preserved verbatim.
 */
const SCHEMA_EXTENSION_KEYS: ReadonlySet<string> = new Set([
  'x-request-schema',
]);

const isVendorExtensionKey = (key: string): boolean => key.startsWith('x-');

type TraversalContext = Readonly<{ literalData: boolean; schemaMap: boolean }>;

const SCHEMA_CONTEXT: TraversalContext = {
  literalData: false,
  schemaMap: false,
};
const LITERAL_DATA_CONTEXT: TraversalContext = {
  literalData: true,
  schemaMap: false,
};

// A child of a schema map is a schema position again, so the keyword context
// resets instead of inheriting the map's arbitrary-name keys.
const contextForChild = (
  key: string,
  context: TraversalContext,
): TraversalContext => {
  if (context.literalData) return LITERAL_DATA_CONTEXT;
  if (context.schemaMap) return SCHEMA_CONTEXT;
  return {
    literalData:
      LITERAL_DATA_KEYS.has(key) ||
      (isVendorExtensionKey(key) && !SCHEMA_EXTENSION_KEYS.has(key)),
    schemaMap: SCHEMA_MAP_KEYS.has(key),
  };
};

const pointerNameFor = (componentName: string): string =>
  componentName.replaceAll('~', '~0').replaceAll('/', '~1');

const isLocalDefinitionReference = (
  key: string,
  value: unknown,
  context: TraversalContext,
): value is string =>
  !context.literalData &&
  !context.schemaMap &&
  key === LOCAL_REFERENCE_KEY &&
  typeof value === 'string' &&
  value.startsWith(LOCAL_DEFINITION_PREFIX);

const anchorReferences = (
  pointerName: string,
  value: unknown,
  context: TraversalContext,
): unknown => {
  if (Array.isArray(value))
    return value.map((item) => anchorReferences(pointerName, item, context));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      anchorReferences(
        pointerName,
        isLocalDefinitionReference(key, nested, context)
          ? `#/components/schemas/${pointerName}/definitions/${nested.slice(LOCAL_DEFINITION_PREFIX.length)}`
          : nested,
        contextForChild(key, context),
      ),
    ]),
  );
};

/**
 * Draft-7 conversion emits definitions relative to its own schema root.
 * Once that schema is nested under OpenAPI components, local references must
 * point at that component's definitions from the document root. This also
 * keeps inlined request-body fragments bound to their component authority.
 *
 * Literal sample and annotation data is preserved verbatim: a `$ref` inside
 * `const`, `default`, `enum`, `example`, or `examples` is payload, not a
 * reference. Property names and definition entry names that happen to match
 * those keywords are still schema positions and are anchored normally.
 */
export const anchorOpenApiSchemaReferences = (
  componentName: string,
  value: unknown,
): unknown =>
  anchorReferences(pointerNameFor(componentName), value, SCHEMA_CONTEXT);

/** A structural local reference discovered while walking emitted schema JSON. */
export type OpenApiSchemaReference = Readonly<{
  path: string;
  reference: string;
}>;

/**
 * Collects structural local references from emitted schema JSON using the same
 * traversal rules as {@link anchorOpenApiSchemaReferences}. Literal sample and
 * annotation data is skipped, so reference-shaped example payloads never read
 * as dangling references.
 */
export const collectSchemaReferences = (
  value: unknown,
): readonly OpenApiSchemaReference[] => {
  const references: OpenApiSchemaReference[] = [];
  const visit = (
    node: unknown,
    path: string,
    context: TraversalContext,
  ): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}/${index}`, context));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, nested] of Object.entries(node)) {
      const childPath = `${path}/${key}`;
      if (!context.literalData && !context.schemaMap) {
        if (
          key === LOCAL_REFERENCE_KEY &&
          typeof nested === 'string' &&
          nested.length > 0
        ) {
          references.push({ path: childPath, reference: nested });
        }
      }
      visit(nested, childPath, contextForChild(key, context));
    }
  };
  visit(value, '', SCHEMA_CONTEXT);
  return references;
};
