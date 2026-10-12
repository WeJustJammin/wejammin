import {
  canonicalRichTextLink,
  type RichTextLink,
} from './cms-rich-text-contracts';

const HTTPS_HREF_PATTERN = new RegExp(
  '^https:\\/\\/[^\\s@/]+(\\/[^\\s]*)?$',
  'u',
);
const MAILTO_HREF_PATTERN = /^mailto:(?<address>[^\s@]+@[^\s@]+)$/u;
const INTERNAL_ROUTE_PATTERN = new RegExp(
  // eslint-disable-next-line no-control-regex
  '^/(?![/\\\\])[^\\u0000-\\u001f?#\\\\]{0,2047}$',
  'u',
);

/**
 * A href is admissible only when one of the shared canonical link variants
 * accepts it outright: javascript:, data:, protocol-relative URLs, malformed
 * mailto addresses, and backslash-based internal routes are refused. Lengths
 * count Unicode characters because the shared schema is the one grammar.
 */
export const linkFromHref = (href: string): RichTextLink | null => {
  if (HTTPS_HREF_PATTERN.test(href)) {
    // Through the shared schema, like mailto and internal links, so the 2048
    // character bound and the DEL / C1 control refusal hold here too.
    return canonicalRichTextLink({ kind: 'https', href });
  }
  const mailto = MAILTO_HREF_PATTERN.exec(href);
  if (mailto?.groups?.address !== undefined) {
    const link = canonicalRichTextLink({
      kind: 'mailto',
      address: mailto.groups.address,
    });
    if (link !== null) return link;
  }
  if (INTERNAL_ROUTE_PATTERN.test(href)) {
    const link = canonicalRichTextLink({ kind: 'internal', route: href });
    if (link !== null) return link;
  }
  return null;
};

/** The destination text a link serializes to (the inverse of `linkFromHref`). */
export const hrefOfLink = (link: RichTextLink): string =>
  link.kind === 'https'
    ? link.href
    : link.kind === 'mailto'
      ? 'mailto:' + link.address
      : link.route;
