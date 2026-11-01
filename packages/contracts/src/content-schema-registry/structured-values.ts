import { z } from 'zod';

import { CMS_FIELD_KEY_PATTERN } from './field-rules.ts';
import {
  BLOCKS_MAX,
  CONTROL_CHARACTER_PATTERN,
  HTTPS_HREF_MAX_CHARACTERS,
  HTTPS_HREF_PATTERN,
  INTERNAL_ROUTE_MAX_CHARACTERS,
  INTERNAL_ROUTE_PATTERN,
  MAILTO_ADDRESS_MAX_CHARACTERS,
  MAILTO_ADDRESS_MIN_CHARACTERS,
  MAILTO_ADDRESS_PATTERN,
  RICH_TEXT_FORMAT,
  RICH_TEXT_MARKS,
  RICH_TEXT_NOT_CANONICAL,
  SPANS_PER_BLOCK_MAX,
  SPAN_TEXT_MAX_CHARACTERS,
  hasNoAdjacentMergeEquivalents,
  hasNoDotSegment,
  isNfc,
  marksAreCanonical,
  noLinkControlCharacters,
  objectValueMatchesStructure,
  unicodeLength,
  utf16Bound,
  withinCharacters,
  type RichTextDecisions,
  type RichTextV1Document as RichTextV1DocumentShape,
} from './structured-values-rules.ts';
import { isWellFormedAuthoredString } from './structured-values-text.ts';

export { RICH_TEXT_MARKS };

export { isWellFormedAuthoredString } from './structured-values-text.ts';

/**
 * BE03b "structured value" grammar of the content schema registry.
 *
 * A definition field of kind 'scalar', 'enum' or 'rich_text' may carry a
 * structure: a flat list of typed properties, and 'rich_text' stores the single
 * canonical 'rich_text.v1' block document. The property object is strict and,
 * per DEC-144, so is its 'constraints' record: the vocabulary is closed per
 * property kind by mirroring the field-level members (scalar: minLength,
 * maxLength, minimum, maximum; enum: a required nonempty enumValues set plus
 * minLength, maxLength; rich_text: minLength, maxLength), and every value is
 * checked against the constraints its property declares. Mirrors
 * `platform_private.cms_object_property_constraints_valid`.
 */

export const ObjectPropertyKindSchema = z.enum(['scalar', 'enum', 'rich_text']);

/** The closed constraint vocabulary of each property kind (DEC-144). */
const PROPERTY_CONSTRAINT_MEMBERS = {
  scalar: ['minLength', 'maxLength', 'minimum', 'maximum'],
  enum: ['enumValues', 'minLength', 'maxLength'],
  rich_text: ['minLength', 'maxLength'],
} as const satisfies Record<
  z.infer<typeof ObjectPropertyKindSchema>,
  readonly string[]
>;

const LENGTH_MEMBER_MAX = 100_000;
const ENUM_VALUES_MAX = 256;
const ENUM_VALUE_MAX_CHARACTERS = 160;

const isLengthMember = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= LENGTH_MEMBER_MAX;

export const ObjectPropertySchema = z
  .strictObject({
    key: z.string().regex(CMS_FIELD_KEY_PATTERN),
    kind: ObjectPropertyKindSchema,
    required: z.boolean(),
    // An open record at the parse boundary on purpose: the closed per-kind
    // vocabulary below is the real schema, and the shared JSON value bound would
    // cap an `enumValues` array at 128 while DEC-144 (and PostgreSQL) admit 256.
    constraints: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, context) => {
    const constraints = value.constraints;
    const allowed: readonly string[] = PROPERTY_CONSTRAINT_MEMBERS[value.kind];
    const issue = (member: string, message: string): void =>
      context.addIssue({
        code: 'custom',
        path: ['constraints', member],
        message,
      });
    for (const member of Object.keys(constraints))
      if (!allowed.includes(member)) issue(member, 'unknown_constraint_member');
    for (const member of ['minLength', 'maxLength'] as const)
      if (member in constraints && !isLengthMember(constraints[member]))
        issue(member, 'length_member_must_be_integer_0_to_100000');
    for (const member of ['minimum', 'maximum'] as const)
      if (
        member in constraints &&
        !(
          typeof constraints[member] === 'number' &&
          Number.isFinite(constraints[member])
        )
      )
        issue(member, 'bound_member_must_be_finite_number');
    const minLength = constraints.minLength;
    const maxLength = constraints.maxLength;
    if (
      isLengthMember(minLength) &&
      isLengthMember(maxLength) &&
      minLength > maxLength
    )
      issue('minLength', 'min_length_exceeds_max_length');
    const minimum = constraints.minimum;
    const maximum = constraints.maximum;
    if (
      typeof minimum === 'number' &&
      typeof maximum === 'number' &&
      minimum > maximum
    )
      issue('minimum', 'minimum_exceeds_maximum');
    if (value.kind !== 'enum') return;
    const enumValues = constraints.enumValues;
    if (
      !Array.isArray(enumValues) ||
      enumValues.length < 1 ||
      enumValues.length > ENUM_VALUES_MAX ||
      !enumValues.every(
        (entry) =>
          typeof entry === 'string' &&
          isWellFormedAuthoredString(entry) &&
          Array.from(entry).length <= ENUM_VALUE_MAX_CHARACTERS,
      )
    )
      issue('enumValues', 'enum_kind_requires_enum_values');
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
 * The total NFC text across every span of every block, counted in Unicode
 * characters, as `platform_private.cms_rich_text_length_in_bounds` counts it
 * (03a minLength/maxLength bind the total text, never a single span).
 */
export const richTextTotalCharacters = (document: unknown): number => {
  const parsed = RichTextV1Schema.safeParse(document);
  if (!parsed.success) return 0;
  let total = 0;
  for (const block of parsed.data.blocks)
    for (const span of block.spans) total += unicodeLength(span.text);
  return total;
};

/** What a canonical rich_text.v1 document is, decided by the zod schema (the Worker's rules). */
const SCHEMA_RICH_TEXT: RichTextDecisions = {
  isDocument: (value) => isRichTextV1(value),
  characters: (document) => richTextTotalCharacters(document),
};

export const isObjectValueForStructure = (
  structure: ObjectStructure,
  value: unknown,
): boolean => objectValueMatchesStructure(structure, value, SCHEMA_RICH_TEXT);

/** The only rich-text document format the registry renders. */
export const CMS_RICH_TEXT_FORMATS = ['rich_text.v1'] as const;

/**
 * Shared refusal text of the PostgreSQL `jsonb` parity predicate
 * (`structured-values-text.ts`): a lone surrogate or a NUL cannot be stored.
 */
const WELL_FORMED_MESSAGE =
  'must be well-formed Unicode without a NUL or lone surrogate';

const MarkSchema = z.enum(RICH_TEXT_MARKS);

const MarksSchema = z
  .array(MarkSchema)
  .max(3)
  .refine(
    marksAreCanonical,
    'marks must be unique and in canonical bold, italic, code order',
  );

/**
 * The three exact link variants. 'https' is a bounded absolute https URL,
 * 'mailto' a bounded email address, and 'internal' an absolute in-app path
 * that cannot escape to a protocol-relative or query/fragment route.
 */
export const RichTextLinkSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('https'),
    href: z
      .string()
      .max(utf16Bound(HTTPS_HREF_MAX_CHARACTERS))
      .refine(
        withinCharacters(1, HTTPS_HREF_MAX_CHARACTERS),
        'href must be at most 2048 characters',
      )
      .regex(HTTPS_HREF_PATTERN, 'href must be an absolute https URL')
      .refine(
        noLinkControlCharacters,
        'href must not contain control characters',
      )
      .refine(isWellFormedAuthoredString, WELL_FORMED_MESSAGE),
  }),
  z.strictObject({
    kind: z.literal('mailto'),
    address: z
      .string()
      .max(utf16Bound(MAILTO_ADDRESS_MAX_CHARACTERS))
      .refine(
        withinCharacters(
          MAILTO_ADDRESS_MIN_CHARACTERS,
          MAILTO_ADDRESS_MAX_CHARACTERS,
        ),
        'address must be 3 to 254 characters',
      )
      .regex(MAILTO_ADDRESS_PATTERN, 'address must be an email address')
      .refine(
        noLinkControlCharacters,
        'address must not contain control characters',
      )
      .refine(isWellFormedAuthoredString, WELL_FORMED_MESSAGE),
  }),
  z.strictObject({
    kind: z.literal('internal'),
    route: z
      .string()
      .max(utf16Bound(INTERNAL_ROUTE_MAX_CHARACTERS))
      .refine(
        withinCharacters(1, INTERNAL_ROUTE_MAX_CHARACTERS),
        'route must be at most 2048 characters',
      )
      .regex(INTERNAL_ROUTE_PATTERN, 'route must be an internal absolute path')
      .refine(hasNoDotSegment, 'route must not contain dot segments')
      .refine(isWellFormedAuthoredString, WELL_FORMED_MESSAGE),
  }),
]);

export const RichTextSpanSchema = z.strictObject({
  text: z
    .string()
    .min(1)
    .max(utf16Bound(SPAN_TEXT_MAX_CHARACTERS))
    .refine(
      withinCharacters(1, SPAN_TEXT_MAX_CHARACTERS),
      'text must be at most 10000 characters',
    )
    .refine(isNfc, 'text must be NFC-normalized')
    .refine(
      (value) => !CONTROL_CHARACTER_PATTERN.test(value),
      'text must not contain control characters',
    )
    .refine(isWellFormedAuthoredString, WELL_FORMED_MESSAGE),
  marks: MarksSchema,
  link: RichTextLinkSchema.optional(),
});

/** Paragraph and list items may be empty; headings and quotes may not. */
const OptionalSpansSchema = z
  .array(RichTextSpanSchema)
  .max(SPANS_PER_BLOCK_MAX)
  .refine(
    hasNoAdjacentMergeEquivalents,
    'adjacent spans with equal marks and link must be merged',
  );

const RequiredSpansSchema = z
  .array(RichTextSpanSchema)
  .min(1)
  .max(SPANS_PER_BLOCK_MAX)
  .refine(
    hasNoAdjacentMergeEquivalents,
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

export { RICH_TEXT_NOT_CANONICAL };

export type RichTextV1Document = z.infer<typeof RichTextV1Schema>;

/**
 * Compile-time parity of the zod-free mirror (`structured-values-rules.ts`):
 * each document type is assignable to the other, so the browser walker and this
 * schema cannot describe different shapes. A mismatch makes `RichTextMirrorAgrees`
 * fail to type-check; nothing of this exists at runtime.
 */
type AssignableBothWays<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type MustBeTrue<T extends true> = T;
export type RichTextMirrorAgrees = MustBeTrue<
  AssignableBothWays<RichTextV1Document, RichTextV1DocumentShape>
>;

export type RichTextV1Verdict =
  | { readonly ok: true; readonly document: RichTextV1Document }
  | {
      readonly ok: false;
      readonly reason: typeof RICH_TEXT_NOT_CANONICAL;
      /** RFC 6901 pointers into the document (at most 50); never a value. */
      readonly pointers: readonly string[];
    };

const POINTER_ESCAPE = (segment: string | number | symbol): string =>
  String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
const SAFE_POINTER = /^(\/[A-Za-z0-9_~-]*)*$/u;
const POINTERS_MAX = 50;

/**
 * Validates a rich_text.v1 value and answers the typed verdict instead of a
 * boolean: a refusal carries the same reason token as the database and the
 * pointers of the offending locations, so an editor can surface it identically.
 */
export const validateRichTextV1 = (value: unknown): RichTextV1Verdict => {
  const parsed = RichTextV1Schema.safeParse(value);
  if (parsed.success) return { ok: true, document: parsed.data };
  const pointers: string[] = [];
  for (const issue of parsed.error.issues) {
    const pointer = issue.path
      .map((segment) => '/' + POINTER_ESCAPE(segment))
      .join('');
    if (SAFE_POINTER.test(pointer) && !pointers.includes(pointer))
      pointers.push(pointer);
    if (pointers.length === POINTERS_MAX) break;
  }
  return { ok: false, reason: RICH_TEXT_NOT_CANONICAL, pointers };
};
