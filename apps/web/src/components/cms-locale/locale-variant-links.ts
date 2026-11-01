import { localeVariantPagePath } from './locale-variant-path';

export interface LocaleVariantLink {
  readonly locale: string;
  readonly href: string;
}

/**
 * The links from an entry page to its locale variant pages (FE03 :1073): one per supported language other than
 * the source, in the version's order. A malformed tag or a repeat (compared without case) is dropped, never
 * linked, and a malformed entry id links nothing.
 */
export const localeVariantLinks = (
  entryId: string,
  supportedLocales: readonly string[],
  sourceLocale: string,
): readonly LocaleVariantLink[] => {
  const seen = new Set<string>([sourceLocale.toLowerCase()]);
  const links: LocaleVariantLink[] = [];
  for (const locale of supportedLocales) {
    const href = localeVariantPagePath(entryId, locale);
    if (href === null || seen.has(locale.toLowerCase())) continue;
    seen.add(locale.toLowerCase());
    links.push({ locale, href });
  }
  return links;
};
