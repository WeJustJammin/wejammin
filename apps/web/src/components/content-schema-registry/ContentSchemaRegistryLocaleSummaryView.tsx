import * as React from 'react';

import {
  chainSentence,
  type LocaleConfig,
} from './content-schema-registry-locale-config';

/**
 * Read-only protected-detail view of a version's locale configuration: the
 * languages and, per target, "{target}: {a} → {b} → {default}". No control is
 * rendered because no draft command edits the configuration (BE03a OD-4).
 */
export default function ContentSchemaRegistryLocaleSummaryView({
  resource,
}: {
  readonly resource: LocaleConfig & { readonly localeConfigHash: string };
}): React.ReactElement {
  const targets = resource.supportedLocales.filter(
    (tag) => tag !== resource.defaultLocale,
  );
  return (
    <section aria-labelledby="content-schema-registry-locales-heading">
      <h4 id="content-schema-registry-locales-heading">Languages</h4>
      <p>{resource.supportedLocales.join(', ')}</p>
      <dl>
        <dt>Source language</dt>
        <dd>{resource.sourceLocale}</dd>
        <dt>Default language</dt>
        <dd>{resource.defaultLocale}</dd>
        <dt>Locale configuration hash</dt>
        <dd>
          <code>{resource.localeConfigHash}</code>
        </dd>
      </dl>
      {targets.length === 0 ? (
        <p>No fallback orders: this version has one language.</p>
      ) : (
        <ul data-locale-chains>
          {targets.map((target) => (
            <li key={target}>
              {chainSentence(
                target,
                (resource.fallbackChains[target] ?? []).filter(
                  (tag) => tag !== resource.defaultLocale,
                ),
                resource.defaultLocale,
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
