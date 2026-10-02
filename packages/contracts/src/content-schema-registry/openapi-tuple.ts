/** Keywords whose values are literal data, never schemas, so they are kept. */
const LITERAL_DATA_KEYS: ReadonlySet<string> = new Set([
  'const',
  'default',
  'enum',
  'example',
  'examples',
]);

/** Keywords mapping arbitrary names to subschemas; the names are not keywords. */
const SCHEMA_MAP_KEYS: ReadonlySet<string> = new Set([
  '$defs',
  'definitions',
  'patternProperties',
  'properties',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const pin = (schema: unknown, schemaMap: boolean): unknown => {
  if (Array.isArray(schema)) return schema.map((item) => pin(item, false));
  if (!isRecord(schema)) return schema;
  const copy = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      !schemaMap && LITERAL_DATA_KEYS.has(key)
        ? value
        : pin(value, !schemaMap && SCHEMA_MAP_KEYS.has(key)),
    ]),
  );
  if (schemaMap || !Array.isArray(copy.items)) return copy;
  const { items, ...rest } = copy;
  return {
    ...rest,
    prefixItems: items,
    items: false,
    minItems: items.length,
    maxItems: items.length,
  };
};

/**
 * Zod emits a fixed-length tuple as the draft-7 array form of `items`, which
 * pins neither the length nor the absence of extra elements and is not valid in
 * the OpenAPI 3.1 (JSON Schema 2020-12) dialect. Rewrites each such tuple to
 * `prefixItems` with `items: false` and `minItems`/`maxItems` equal to the
 * tuple length. Literal data and every other value are copied unchanged.
 */
export const pinTupleLengths = (schema: unknown): unknown => pin(schema, false);
