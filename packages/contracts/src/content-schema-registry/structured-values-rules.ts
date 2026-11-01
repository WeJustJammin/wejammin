import type { ObjectStructure } from './structured-values.ts';
import { isWellFormedAuthoredString } from './structured-values-text.ts';

/*
 * Zod-free rules of the structured field values: the rich_text.v1 grammar and
 * the depth-1 object value contract (BE03b value encodings, DEC-112, DEC-133,
 * DEC-146).
 *
 * `structured-values.ts` expresses the same grammar as zod schemas for the
 * Worker, the generated OpenAPI and the registry. The browser editors cannot
 * ship zod (FE03 "Performance budgets and loading strategy", AC-106), so they
 * validate with the walkers below. Every LEAF rule (bounds, patterns, NFC,
 * control characters, marks order, merge equivalence) is defined once, here, and
 * the schema imports it; only the structure walk (strict objects, unions,
 * arrays) is written twice, and `structured-values-rules.test.ts` proves the two
 * agree over a corpus and a deterministic mutation sweep.
 */

export const RICH_TEXT_FORMAT = 'rich_text.v1';

/**
 * The typed reason of a refused rich_text value: the token PostgreSQL
 * `cms_rich_text_v1_valid` emits (the Worker publishes it as 422
 * `details.reasonCode`), so every layer names a refusal the same way (BE03b
 * rich_text.v1, DEC-146; AC-084).
 */
export const RICH_TEXT_NOT_CANONICAL = 'rich_text_not_canonical' as const;
export const SPAN_TEXT_MAX_CHARACTERS = 10_000;
export const SPANS_PER_BLOCK_MAX = 128;
export const BLOCKS_MAX = 128;
export const HTTPS_HREF_MAX_CHARACTERS = 2048;
export const INTERNAL_ROUTE_MAX_CHARACTERS = 2048;
export const MAILTO_ADDRESS_MIN_CHARACTERS = 3;
export const MAILTO_ADDRESS_MAX_CHARACTERS = 254;

// The rich-text grammar intentionally matches, and below excludes, control
// characters, so these control-character classes are deliberate.
/* eslint-disable no-control-regex */
export const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;
/* eslint-enable no-control-regex */
export const HTTPS_HREF_PATTERN = /^https:\/\/[^\s@/]+(\/[^\s]*)?$/;
export const MAILTO_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+$/;
// An absolute normalised path: one leading slash (never protocol-relative), and
// no C0/DEL/C1 character, query, fragment or backslash anywhere. A browser reads
// `/\host` as `//host`, so a backslash is refused outright. The 2048-character
// bound and the dot-segment refusal are separate rules below.
/* eslint-disable no-control-regex */
export const INTERNAL_ROUTE_PATTERN =
  /^\/(?!\/)[^\u0000-\u001f\u007f-\u009f?#\\]*$/;
/* eslint-enable no-control-regex */
// Link targets carry no C0, DEL or C1 control character (parity with the SQL
// grammar). JavaScript `\s` is the whitespace class the SQL side spells out.
// eslint-disable-next-line no-control-regex
const LINK_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
// A `.` or `..` path segment would let a route escape its directory.
const DOT_SEGMENT_PATTERN = /(^|\/)\.\.?(\/|$)/;

export const isNfc = (value: string): boolean =>
  value.normalize('NFC') === value;

/**
 * Every rich_text.v1 length bound counts Unicode characters (code points), the
 * BE03a "Unicode characters" unit and the unit PostgreSQL `length()` counts in
 * `platform_private.cms_rich_text_v1_valid`, never UTF-16 code units. A code
 * point is at most two UTF-16 units, so the cheap `max(2 * bound)` string
 * bound runs first and the exact code-point count only ever sees bounded input.
 */
export const unicodeLength = (value: string): number =>
  Array.from(value).length;
export const utf16Bound = (characters: number): number => characters * 2;
export const withinCharacters =
  (min: number, max: number) =>
  (value: string): boolean => {
    const length = unicodeLength(value);
    return length >= min && length <= max;
  };
export const noLinkControlCharacters = (value: string): boolean =>
  !LINK_CONTROL_CHARACTER_PATTERN.test(value);
export const hasNoDotSegment = (route: string): boolean =>
  !DOT_SEGMENT_PATTERN.test(route);

/**
 * Marks are an ordered set: bold, then italic, then code. A canonical array is
 * strictly increasing in that rank, which also makes it unique.
 */
export const RICH_TEXT_MARKS = ['bold', 'italic', 'code'] as const;
export type RichTextMark = (typeof RICH_TEXT_MARKS)[number];
const markRank = new Map<string, number>(
  RICH_TEXT_MARKS.map((mark, index) => [mark, index]),
);
export const marksAreCanonical = (marks: readonly string[]): boolean =>
  marks.every(
    (mark, index) =>
      index === 0 || markRank.get(marks[index - 1]!)! < markRank.get(mark)!,
  );

export type RichTextLink =
  | { kind: 'https'; href: string }
  | { kind: 'mailto'; address: string }
  | { kind: 'internal'; route: string };

export interface RichTextSpan {
  text: string;
  marks: RichTextMark[];
  link?: RichTextLink | undefined;
}

export type RichTextBlock =
  | { type: 'paragraph'; spans: RichTextSpan[] }
  | { type: 'heading'; level: 2 | 3 | 4; spans: RichTextSpan[] }
  | { type: 'quote'; spans: RichTextSpan[] }
  | {
      type: 'list_item';
      list: 'bulleted' | 'numbered';
      depth: 1 | 2 | 3;
      spans: RichTextSpan[];
    };

export interface RichTextV1Document {
  format: typeof RICH_TEXT_FORMAT;
  blocks: RichTextBlock[];
}

/** A plain JSON object (not an array, not null), as a strict zod object requires. */
const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** True when `value` has exactly the `required` keys plus any of the `optional` ones. */
const hasExactKeys = (
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean =>
  required.every((key) => record[key] !== undefined) &&
  Object.keys(record).every(
    (key) => required.includes(key) || optional.includes(key),
  );

const isBoundedString = (
  value: unknown,
  characters: { readonly min: number; readonly max: number },
): value is string =>
  typeof value === 'string' &&
  value.length <= utf16Bound(characters.max) &&
  withinCharacters(characters.min, characters.max)(value) &&
  isWellFormedAuthoredString(value);

/** The `rich_text.v1` link variants: bounded https URL, email address, internal path. */
export const isRichTextLink = (value: unknown): value is RichTextLink => {
  if (!isPlainRecord(value)) return false;
  if (value.kind === 'https')
    return (
      hasExactKeys(value, ['kind', 'href']) &&
      isBoundedString(value.href, {
        min: 1,
        max: HTTPS_HREF_MAX_CHARACTERS,
      }) &&
      HTTPS_HREF_PATTERN.test(value.href) &&
      noLinkControlCharacters(value.href)
    );
  if (value.kind === 'mailto')
    return (
      hasExactKeys(value, ['kind', 'address']) &&
      isBoundedString(value.address, {
        min: MAILTO_ADDRESS_MIN_CHARACTERS,
        max: MAILTO_ADDRESS_MAX_CHARACTERS,
      }) &&
      MAILTO_ADDRESS_PATTERN.test(value.address) &&
      noLinkControlCharacters(value.address)
    );
  if (value.kind === 'internal')
    return (
      hasExactKeys(value, ['kind', 'route']) &&
      isBoundedString(value.route, {
        min: 1,
        max: INTERNAL_ROUTE_MAX_CHARACTERS,
      }) &&
      INTERNAL_ROUTE_PATTERN.test(value.route) &&
      hasNoDotSegment(value.route)
    );
  return false;
};

/** The text of one span: 1 to 10000 characters, NFC, no control character, storable. */
export const isRichTextSpanText = (value: unknown): value is string =>
  isBoundedString(value, { min: 1, max: SPAN_TEXT_MAX_CHARACTERS }) &&
  isNfc(value) &&
  !CONTROL_CHARACTER_PATTERN.test(value);

export const isRichTextSpan = (value: unknown): value is RichTextSpan => {
  if (!isPlainRecord(value)) return false;
  if (!hasExactKeys(value, ['text', 'marks'], ['link'])) return false;
  const { text, marks, link } = value;
  return (
    isRichTextSpanText(text) &&
    Array.isArray(marks) &&
    marks.length <= RICH_TEXT_MARKS.length &&
    marks.every((mark) => RICH_TEXT_MARKS.some((known) => known === mark)) &&
    marksAreCanonical(marks as string[]) &&
    (link === undefined || isRichTextLink(link))
  );
};

const sameLink = (
  left: RichTextLink | undefined,
  right: RichTextLink | undefined,
): boolean => {
  if (left === undefined || right === undefined) return left === right;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'https') return left.href === (right as typeof left).href;
  if (left.kind === 'mailto')
    return left.address === (right as typeof left).address;
  return left.route === (right as typeof left).route;
};

/** Adjacent spans with equal marks and link must be one span. */
export const hasNoAdjacentMergeEquivalents = (
  spans: readonly RichTextSpan[],
): boolean =>
  spans.every((span, index) => {
    if (index === 0) return true;
    const previous = spans[index - 1]!;
    return !(
      previous.marks.length === span.marks.length &&
      previous.marks.every((mark, position) => mark === span.marks[position]) &&
      sameLink(previous.link, span.link)
    );
  });

const areSpans = (value: unknown, min: number): value is RichTextSpan[] =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= SPANS_PER_BLOCK_MAX &&
  value.every(isRichTextSpan) &&
  hasNoAdjacentMergeEquivalents(value);

const isBlock = (value: unknown): value is RichTextBlock => {
  if (!isPlainRecord(value)) return false;
  if (value.type === 'paragraph')
    return hasExactKeys(value, ['type', 'spans']) && areSpans(value.spans, 0);
  if (value.type === 'heading')
    return (
      hasExactKeys(value, ['type', 'level', 'spans']) &&
      (value.level === 2 || value.level === 3 || value.level === 4) &&
      areSpans(value.spans, 1)
    );
  if (value.type === 'quote')
    return hasExactKeys(value, ['type', 'spans']) && areSpans(value.spans, 1);
  if (value.type === 'list_item')
    return (
      hasExactKeys(value, ['type', 'list', 'depth', 'spans']) &&
      (value.list === 'bulleted' || value.list === 'numbered') &&
      (value.depth === 1 || value.depth === 2 || value.depth === 3) &&
      areSpans(value.spans, 0)
    );
  return false;
};

/** A list run starts at depth 1 and never deepens by more than one level. */
const hasCanonicalListDepths = (blocks: readonly RichTextBlock[]): boolean => {
  let previousList: 'bulleted' | 'numbered' | null = null;
  let previousDepth = 0;
  for (const block of blocks) {
    if (block.type !== 'list_item') {
      previousList = null;
      previousDepth = 0;
      continue;
    }
    const startsRun = previousList !== block.list;
    if (startsRun ? block.depth !== 1 : block.depth > previousDepth + 1)
      return false;
    previousList = block.list;
    previousDepth = block.depth;
  }
  return true;
};

/**
 * True for a canonical `rich_text.v1` document: the same verdict as
 * `RichTextV1Schema.safeParse(value).success`.
 */
export const isRichTextDocument = (
  value: unknown,
): value is RichTextV1Document => {
  if (!isPlainRecord(value)) return false;
  if (!hasExactKeys(value, ['format', 'blocks'])) return false;
  const { format, blocks } = value;
  return (
    format === RICH_TEXT_FORMAT &&
    Array.isArray(blocks) &&
    blocks.length >= 1 &&
    blocks.length <= BLOCKS_MAX &&
    blocks.every(isBlock) &&
    hasCanonicalListDepths(blocks)
  );
};

/**
 * The total NFC text across every span of every block, counted in Unicode
 * characters, as `platform_private.cms_rich_text_length_in_bounds` counts it
 * (03a minLength/maxLength bind the total text, never a single span). A value
 * that is not a canonical document counts 0.
 */
export const richTextDocumentCharacters = (document: unknown): number => {
  if (!isRichTextDocument(document)) return 0;
  let total = 0;
  for (const block of document.blocks)
    for (const span of block.spans) total += unicodeLength(span.text);
  return total;
};

/** The two rich-text decisions the object value contract needs. */
export interface RichTextDecisions {
  readonly isDocument: (value: unknown) => boolean;
  readonly characters: (document: unknown) => number;
}

/** The zod-free decisions of this module. */
export const RICH_TEXT_RULES: RichTextDecisions = {
  isDocument: isRichTextDocument,
  characters: richTextDocumentCharacters,
};

/**
 * A scalar property value is a JSON primitive: a string, a boolean or a finite
 * number. BE03a "Field kind structure": `scalar` covers the scalar field kinds,
 * none of which admits an authored JSON null as a value (an absent value is the
 * missing state; an explicit null is a field-level provenance state, never a
 * value shape), and the `required` flag is the only presence control, so a null
 * can neither satisfy a required property nor stand in for an optional one.
 * Arrays and nested objects are never valid at depth 1. Mirrors
 * `platform_private.cms_object_value_valid`.
 */
const isScalarPropertyValue = (
  value: unknown,
): value is string | number | boolean =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const boundedBy = (
  constraints: Readonly<Record<string, unknown>>,
  minMember: string,
  maxMember: string,
  measure: number,
): boolean => {
  const minimum = constraints[minMember];
  const maximum = constraints[maxMember];
  if (typeof minimum === 'number' && measure < minimum) return false;
  if (typeof maximum === 'number' && measure > maximum) return false;
  return true;
};

/**
 * BE03b value contract for a DEC-133 depth-1 object structure. The value must
 * be a plain object whose keys are a subset of the declared properties; every
 * required property is present; a scalar property holds a JSON primitive; an
 * enum property holds a string contained in its declared set; and a rich_text
 * property holds a 'rich_text.v1' document. Unknown or nested values are
 * refused, so there is no untyped pass-through. `richText` decides what a
 * canonical document is: the zod schema on the Worker, this module's walker in
 * the browser.
 */
export const objectValueMatchesStructure = (
  structure: ObjectStructure,
  value: unknown,
  richText: RichTextDecisions,
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
      if (!richText.isDocument(propertyValue)) return false;
      if (
        !boundedBy(
          property.constraints,
          'minLength',
          'maxLength',
          richText.characters(propertyValue),
        )
      )
        return false;
      continue;
    }
    if (property.kind === 'enum') {
      const enumValues: unknown = property.constraints.enumValues;
      if (typeof propertyValue !== 'string') return false;
      if (!isWellFormedAuthoredString(propertyValue)) return false;
      if (!Array.isArray(enumValues) || !enumValues.includes(propertyValue))
        return false;
      if (
        !boundedBy(
          property.constraints,
          'minLength',
          'maxLength',
          unicodeLength(propertyValue),
        )
      )
        return false;
      continue;
    }
    if (!isScalarPropertyValue(propertyValue)) return false;
    if (
      typeof propertyValue === 'string' &&
      !isWellFormedAuthoredString(propertyValue)
    )
      return false;
    // A string honours minLength/maxLength and a number minimum/maximum; a
    // boolean is constrained by neither family (DEC-144).
    if (
      typeof propertyValue === 'string' &&
      !boundedBy(
        property.constraints,
        'minLength',
        'maxLength',
        unicodeLength(propertyValue),
      )
    )
      return false;
    if (
      typeof propertyValue === 'number' &&
      !boundedBy(property.constraints, 'minimum', 'maximum', propertyValue)
    )
      return false;
  }
  return true;
};

/** `objectValueMatchesStructure` with the zod-free rich-text rules of this module. */
export const isObjectValueForStructureZodFree = (
  structure: ObjectStructure,
  value: unknown,
): boolean => objectValueMatchesStructure(structure, value, RICH_TEXT_RULES);
