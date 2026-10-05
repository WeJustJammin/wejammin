import { z } from 'zod';

import { JsonValueSchema } from '../api-error.ts';
import { CMS_FIELD_KEY_PATTERN } from './field-rules.ts';

/**
 * BE03b "structured value" grammar of the content schema registry.
 *
 * A definition field of kind 'scalar', 'enum' or 'rich_text' may carry a
 * structure: a flat list of typed properties, and 'rich_text' stores the single
 * canonical 'rich_text.v1' block document. The property object is strict, but
 * its 'constraints' are an open JSON record so the registry can carry
 * validator-specific options; both are bounded by the shared JSON value schema.
 */

export const ObjectPropertyKindSchema = z.enum(['scalar', 'enum', 'rich_text']);

export const ObjectPropertySchema = z
  .strictObject({
    key: z.string().regex(CMS_FIELD_KEY_PATTERN),
    kind: ObjectPropertyKindSchema,
    required: z.boolean(),
    constraints: z.record(z.string(), JsonValueSchema),
  })
  .superRefine((value, context) => {
    if (value.kind !== 'enum') return;
    const enumValues: unknown = value.constraints.enumValues;
    if (
      !Array.isArray(enumValues) ||
      enumValues.length === 0 ||
      !enumValues.every((entry) => typeof entry === 'string')
    )
      context.addIssue({
        code: 'custom',
        path: ['constraints', 'enumValues'],
        message: 'enum_kind_requires_enum_values',
      });
  });

export const ObjectStructureSchema = z
  .strictObject({
    properties: z.array(ObjectPropertySchema).max(32),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.properties.forEach((property, index) => {
      if (seen.has(property.key))
        context.addIssue({
          code: 'custom',
          path: ['properties', index, 'key'],
          message: 'duplicate_property_key',
        });
      seen.add(property.key);
    });
  });

export type ObjectStructure = z.infer<typeof ObjectStructureSchema>;

/**
 * A scalar property value is a JSON primitive only: null, string, boolean or a
 * finite number. Arrays and nested objects are never valid at depth 1.
 */
const isScalarPropertyValue = (
  value: unknown,
): value is null | string | number | boolean =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

/**
 * BE03b value contract for a DEC-133 depth-1 object structure. The value must
 * be a plain object whose keys are a subset of the declared properties; every
 * required property is present; a scalar property holds a JSON primitive; an
 * enum property holds a string contained in its declared set; and a rich_text
 * property holds a 'rich_text.v1' document. Unknown or nested values are
 * refused, so there is no untyped pass-through.
 */
export const isObjectValueForStructure = (
  structure: ObjectStructure,
  value: unknown,
): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length > structure.properties.length) return false;
  for (const key of keys)
    if (!structure.properties.some((property) => property.key === key))
      return false;
  for (const property of structure.properties) {
    if (!Object.hasOwn(record, property.key)) {
      if (property.required) return false;
      continue;
    }
    const propertyValue = record[property.key];
    if (property.kind === 'rich_text') {
      if (!isRichTextV1(propertyValue)) return false;
      continue;
    }
    if (property.kind === 'enum') {
      const enumValues: unknown = property.constraints.enumValues;
      if (typeof propertyValue !== 'string') return false;
      if (!Array.isArray(enumValues) || !enumValues.includes(propertyValue))
        return false;
      continue;
    }
    if (!isScalarPropertyValue(propertyValue)) return false;
  }
  return true;
};

/** The only rich-text document format the registry renders. */
export const CMS_RICH_TEXT_FORMATS = ['rich_text.v1'] as const;

const RICH_TEXT_FORMAT = 'rich_text.v1';
const SPAN_TEXT_MAX_CHARACTERS = 10_000;
const SPANS_PER_BLOCK_MAX = 128;
const BLOCKS_MAX = 128;
const HTTPS_HREF_MAX_CHARACTERS = 2048;
const MAILTO_ADDRESS_MIN_CHARACTERS = 3;
const MAILTO_ADDRESS_MAX_CHARACTERS = 254;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;
const HTTPS_HREF_PATTERN = /^https:\/\/[^\s@/]+(\/[^\s]*)?$/;
const MAILTO_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+$/;
const INTERNAL_ROUTE_PATTERN = /^\/(?!\/)[^\u0000-\u001f?#]{0,2047}$/;

const isNfc = (value: string): boolean => value.normalize('NFC') === value;

/**
 * Marks are an ordered set: bold, then italic, then code. A canonical array is
 * strictly increasing in that rank, which also makes it unique.
 */
const RICH_TEXT_MARKS = ['bold', 'italic', 'code'] as const;
const MarkSchema = z.enum(RICH_TEXT_MARKS);
const markRank = new Map<string, number>(
  RICH_TEXT_MARKS.map((mark, index) => [mark, index]),
);

const MarksSchema = z
  .array(MarkSchema)
  .max(3)
  .refine(
    (marks) =>
      marks.every(
        (mark, index) =>
          index === 0 || markRank.get(marks[index - 1]!)! < markRank.get(mark)!,
      ),
    'marks must be unique and in canonical bold, italic, code order',
  );

/**
 * The three exact link variants. 'https' is a bounded absolute https URL,
 * 'mailto' a bounded email address, and 'internal' an absolute in-app path
 * that cannot escape to a protocol-relative or query/fragment route.
 */
const RichTextLinkSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('https'),
    href: z
      .string()
      .max(HTTPS_HREF_MAX_CHARACTERS)
      .regex(HTTPS_HREF_PATTERN, 'href must be an absolute https URL'),
  }),
  z.strictObject({
    kind: z.literal('mailto'),
    address: z
      .string()
      .min(MAILTO_ADDRESS_MIN_CHARACTERS)
      .max(MAILTO_ADDRESS_MAX_CHARACTERS)
      .regex(MAILTO_ADDRESS_PATTERN, 'address must be an email address'),
  }),
  z.strictObject({
    kind: z.literal('internal'),
    route: z
      .string()
      .regex(INTERNAL_ROUTE_PATTERN, 'route must be an internal absolute path'),
  }),
]);

const RichTextSpanSchema = z.strictObject({
  text: z
    .string()
    .min(1)
    .max(SPAN_TEXT_MAX_CHARACTERS)
    .refine(isNfc, 'text must be NFC-normalized')
    .refine(
      (value) => !CONTROL_CHARACTER_PATTERN.test(value),
      'text must not contain control characters',
    ),
  marks: MarksSchema,
  link: RichTextLinkSchema.optional(),
});

type RichTextSpan = z.infer<typeof RichTextSpanSchema>;

const mergeKey = (span: RichTextSpan): string =>
  JSON.stringify([span.marks, span.link ?? null]);

const noAdjacentMergeEquivalents = (spans: readonly RichTextSpan[]): boolean =>
  spans.every(
    (span, index) => index === 0 || mergeKey(spans[index - 1]!) !== mergeKey(span),
  );

/** Paragraph and list items may be empty; headings and quotes may not. */
const OptionalSpansSchema = z
  .array(RichTextSpanSchema)
  .max(SPANS_PER_BLOCK_MAX)
  .refine(
    noAdjacentMergeEquivalents,
    'adjacent spans with equal marks and link must be merged',
  );

const RequiredSpansSchema = z
  .array(RichTextSpanSchema)
  .min(1)
  .max(SPANS_PER_BLOCK_MAX)
  .refine(
    noAdjacentMergeEquivalents,
    'adjacent spans with equal marks and link must be merged',
  );

const RichTextBlockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), spans: OptionalSpansSchema }),
  z.strictObject({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    spans: RequiredSpansSchema,
  }),
  z.strictObject({ type: z.literal('quote'), spans: RequiredSpansSchema }),
  z.strictObject({
    type: z.literal('list_item'),
    list: z.enum(['bulleted', 'numbered']),
    depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    spans: OptionalSpansSchema,
  }),
]);

export const RichTextV1Schema = z
  .strictObject({
    format: z.literal(RICH_TEXT_FORMAT),
    blocks: z.array(RichTextBlockSchema).min(1).max(BLOCKS_MAX),
  })
  .superRefine((value, context) => {
    let previousList: 'bulleted' | 'numbered' | null = null;
    let previousDepth = 0;
    value.blocks.forEach((block, index) => {
      if (block.type !== 'list_item') {
        previousList = null;
        previousDepth = 0;
        return;
      }
      const startsRun = previousList !== block.list;
      if (startsRun ? block.depth !== 1 : block.depth > previousDepth + 1)
        context.addIssue({
          code: 'custom',
          path: ['blocks', index, 'depth'],
          message: startsRun
            ? 'first list item of a run must start at depth 1'
            : 'list depth must not jump more than one',
        });
      previousList = block.list;
      previousDepth = block.depth;
    });
  });

export const isRichTextV1 = (value: unknown): boolean =>
  RichTextV1Schema.safeParse(value).success;
