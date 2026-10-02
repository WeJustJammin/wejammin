/**
 * Bounded, case-insensitive scanner that extracts the single canonical
 * WorkbenchIsland props attribute from a refetch HTML response. It never uses
 * DOMParser (parsing the second document would evaluate its inline style under
 * the current document policy). Tag-like text inside quoted attributes,
 * comments, and raw-text elements is skipped; duplicate attributes, duplicate
 * target tags, and unterminated tags fail closed.
 */

const ISLAND_BASENAME = 'ContentSchemaRegistryWorkbenchIsland.';
const MAX_MARKUP_LENGTH = 2_000_000;
const RAW_TEXT_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'iframe',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'noscript',
]);

const isSpace = (character: string | undefined): boolean =>
  character === ' ' ||
  character === '\t' ||
  character === '\n' ||
  character === '\r' ||
  character === '\f';

export const decodeHtmlEntities = (value: string): string => {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    const amp = value.indexOf('&', cursor);
    if (amp === -1) {
      output += value.slice(cursor);
      break;
    }
    output += value.slice(cursor, amp);
    const semi = value.indexOf(';', amp + 1);
    if (semi === -1 || semi - amp > 8) {
      output += '&';
      cursor = amp + 1;
      continue;
    }
    const entity = value.slice(amp + 1, semi);
    if (entity === 'amp') output += '&';
    else if (entity === 'lt') output += '<';
    else if (entity === 'gt') output += '>';
    else if (entity === 'quot') output += '"';
    else if (entity === 'apos') output += "'";
    else if (entity === '#39' || entity === '#x27') output += "'";
    else output += value.slice(amp, semi + 1);
    cursor = semi + 1;
  }
  return output;
};

/** Find the end of an opening tag while respecting quoted attribute values. */
const findTagEnd = (html: string, start: number): number => {
  let quote = '';
  let index = start;
  while (index < html.length) {
    const character = html[index];
    if (quote !== '') {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
    index += 1;
  }
  return -1;
};

export interface AttributeScan {
  readonly value: string | null;
  readonly duplicates: boolean;
}

/** Read one attribute value (case-insensitive) with quote awareness. */
export const scanAttribute = (
  tag: string,
  attribute: string,
): AttributeScan => {
  const lower = tag.toLowerCase();
  const needle = attribute.toLowerCase();
  let cursor = 0;
  let found = 0;
  let value: string | null = null;
  while (cursor < lower.length) {
    const at = lower.indexOf(needle, cursor);
    if (at === -1) break;
    const before = at === 0 ? ' ' : (lower[at - 1] ?? ' ');
    const after = lower[at + needle.length];
    if (isSpace(before) && (after === '=' || isSpace(after))) {
      let eq = at + needle.length;
      while (eq < lower.length && isSpace(lower[eq])) eq += 1;
      if (lower[eq] === '=') {
        let valueStart = eq + 1;
        while (valueStart < lower.length && isSpace(lower[valueStart]))
          valueStart += 1;
        const quote = tag[valueStart];
        let read: string | null;
        if (quote === '"' || quote === "'") {
          const end = tag.indexOf(quote, valueStart + 1);
          read = end === -1 ? null : tag.slice(valueStart + 1, end);
        } else {
          let valueEnd = valueStart;
          while (
            valueEnd < tag.length &&
            !isSpace(tag[valueEnd]) &&
            tag[valueEnd] !== '>'
          )
            valueEnd += 1;
          read = tag.slice(valueStart, valueEnd);
        }
        found += 1;
        if (found === 1) value = read;
      }
    }
    cursor = at + needle.length;
  }
  return { value, duplicates: found > 1 };
};

export const readAttribute = (tag: string, attribute: string): string | null =>
  scanAttribute(tag, attribute).value;

const isWorkbenchIsland = (tag: string): boolean => {
  const componentUrl = readAttribute(tag, 'component-url') ?? '';
  const exportName = readAttribute(tag, 'component-export') ?? '';
  const base = componentUrl.slice(componentUrl.lastIndexOf('/') + 1);
  return (
    base.startsWith(ISLAND_BASENAME) &&
    base.endsWith('.js') &&
    exportName === 'default'
  );
};

export interface IslandScan {
  readonly props: string | null;
  readonly count: number;
  readonly ambiguous: boolean;
}

export const scanCanonicalWorkbenchIsland = (html: string): IslandScan => {
  if (html.length === 0 || html.length > MAX_MARKUP_LENGTH)
    return { props: null, count: 0, ambiguous: false };
  const lower = html.toLowerCase();
  let cursor = 0;
  let props: string | null = null;
  let count = 0;
  let ambiguous = false;
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) break;
    if (html.startsWith('<!--', open)) {
      const close = html.indexOf('-->', open + 4);
      cursor = close === -1 ? html.length : close + 3;
      continue;
    }
    const tagEnd = findTagEnd(html, open + 1);
    if (tagEnd === -1) break;
    const tag = html.slice(open, tagEnd + 1);
    let nameEnd = open + 1;
    while (nameEnd < tagEnd && /[a-zA-Z0-9-]/.test(html[nameEnd] ?? ''))
      nameEnd += 1;
    const name = html.slice(open + 1, nameEnd).toLowerCase();
    if (name === 'astro-island' && isWorkbenchIsland(tag)) {
      count += 1;
      const propsScan = scanAttribute(tag, 'props');
      const urlScan = scanAttribute(tag, 'component-url');
      const exportScan = scanAttribute(tag, 'component-export');
      if (propsScan.duplicates || urlScan.duplicates || exportScan.duplicates)
        ambiguous = true;
      if (count === 1)
        props =
          propsScan.value === null ? null : decodeHtmlEntities(propsScan.value);
    }
    if (RAW_TEXT_TAGS.has(name)) {
      const close = lower.indexOf('</' + name, tagEnd + 1);
      cursor = close === -1 ? html.length : close;
      continue;
    }
    cursor = tagEnd + 1;
  }
  return { props, count, ambiguous };
};
