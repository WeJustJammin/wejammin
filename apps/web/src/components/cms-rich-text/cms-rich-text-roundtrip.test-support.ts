import { RichTextV1Schema } from '@wejammin/contracts';

import type { RichTextMark, RichTextSpan } from './cms-rich-text-contracts';

/** RFC 8785 style canonical JSON: sorted keys, no whitespace. */
export const jcs = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${jcs(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

/** Mulberry32: a small, seedable generator, so failures reproduce exactly. */
export const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Every character the markup treats specially, plus ordinary and astral text. */
export const NASTY_TEXT_ALPHABET: readonly string[] = [
  'a',
  'b',
  'Z',
  '1',
  ' ',
  ' ',
  '_',
  '*',
  '[',
  ']',
  '(',
  ')',
  '\\',
  '\u0060',
  '\n',
  '.',
  '-',
  '\u00e9',
  '\u{1F600}',
];

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

const text = (random: () => number, alphabet: readonly string[]): string => {
  const length = 1 + Math.floor(random() * 7);
  let out = '';
  for (let at = 0; at < length; at += 1) out += pick(random, alphabet);
  return out;
};

const MARK_SETS: readonly (readonly RichTextMark[])[] = [
  [],
  [],
  ['bold'],
  ['italic'],
  ['code'],
  ['bold', 'italic'],
  ['bold', 'code'],
  ['italic', 'code'],
  ['bold', 'italic', 'code'],
];

const linkFor = (random: () => number): RichTextSpan['link'] => {
  const kind = Math.floor(random() * 3);
  // Link targets exclude whitespace, and each kind its own forbidden members.
  const target = Array.from({ length: 1 + Math.floor(random() * 6) }, () =>
    pick(random, ['a', 'b', '_', '*', '[', ']', '(', ')', '\u0060', '1', '-']),
  ).join('');
  if (kind === 0)
    return { kind: 'https', href: `https://host.example/${target}\\${target}` };
  if (kind === 1) return { kind: 'mailto', address: `${target}@x.example` };
  return { kind: 'internal', route: `/${target}/${target}` };
};

const mergeKey = (span: RichTextSpan): string =>
  JSON.stringify([span.marks, span.link ?? null]);

export const randomSpans = (
  random: () => number,
  alphabet: readonly string[] = NASTY_TEXT_ALPHABET,
  max = 6,
): RichTextSpan[] => {
  const spans: RichTextSpan[] = [];
  const count = Math.floor(random() * (max + 1));
  for (let at = 0; at < count; at += 1) {
    const span: RichTextSpan = {
      text: text(random, alphabet),
      marks: [...pick(random, MARK_SETS)],
      ...(random() < 0.3 ? { link: linkFor(random) as never } : {}),
    };
    // A canonical block never holds two adjacent spans with the same marks and link.
    if (
      spans.length > 0 &&
      mergeKey(spans[spans.length - 1]!) === mergeKey(span)
    )
      continue;
    spans.push(span);
  }
  return spans;
};

/** A random block document that the shared schema accepts (others are skipped). */
export const randomDocument = (random: () => number): unknown | null => {
  const blocks: unknown[] = [];
  let previousList: 'bulleted' | 'numbered' | null = null;
  let previousDepth = 0;
  const count = 1 + Math.floor(random() * 5);
  for (let at = 0; at < count; at += 1) {
    const spans = randomSpans(random);
    const type = pick(random, ['paragraph', 'heading', 'quote', 'list_item']);
    if (type === 'list_item') {
      const list = pick(random, ['bulleted', 'numbered'] as const);
      const depth =
        previousList === list
          ? 1 + Math.floor(random() * Math.min(3, previousDepth + 1))
          : 1;
      blocks.push({ type, list, depth, spans });
      previousList = list;
      previousDepth = depth;
      continue;
    }
    previousList = null;
    previousDepth = 0;
    if (type === 'paragraph') blocks.push({ type, spans });
    else if (type === 'heading')
      blocks.push({ type, level: pick(random, [2, 3, 4] as const), spans });
    else blocks.push({ type, spans });
  }
  const document = { format: 'rich_text.v1', blocks };
  return RichTextV1Schema.safeParse(document).success ? document : null;
};
