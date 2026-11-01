import * as React from 'react';

import type { LocaleVariantLink } from './locale-variant-links';

interface Props {
  readonly links: readonly LocaleVariantLink[];
}

/**
 * The entry page's way to the locale variant pages (FE03 :1073): one native link per supported language other than
 * the source. Nothing renders when there is no other language. Server-rendered only; no script.
 */
export default function CmsEntryTranslateLinks({
  links,
}: Props): React.ReactElement | null {
  if (links.length === 0) return null;
  return (
    <nav aria-label="Translate">
      <ul>
        {links.map((link) => (
          <li key={link.locale}>
            <a href={link.href}>Translate to {link.locale}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
