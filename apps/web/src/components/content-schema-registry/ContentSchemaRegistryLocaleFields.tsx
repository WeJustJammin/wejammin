import * as React from 'react';

import ContentSchemaRegistryLocaleChains from './ContentSchemaRegistryLocaleChains';
import {
  ContentSchemaRegistryLocaleReview,
  ContentSchemaRegistryLocaleSummary,
} from './ContentSchemaRegistryLocaleReview';
import ContentSchemaRegistryLocaleSelects, {
  ContentSchemaRegistryLocaleInherited,
} from './ContentSchemaRegistryLocaleSelects';
import ContentSchemaRegistryLocaleTags from './ContentSchemaRegistryLocaleTags';
import {
  submitConfig,
  type LocaleConfig,
} from './content-schema-registry-locale-config';
import type { LocaleDraftController } from './use-locale-config-draft';

export interface ContentSchemaRegistryLocaleFieldsProps {
  readonly controller: LocaleDraftController;
  /** `create` edits source/default; `successor` shows them as inherited. */
  readonly mode: 'create' | 'successor';
  /** The source version configuration (successor) or null (new type). */
  readonly source: LocaleConfig | null;
  readonly pending: boolean;
}

/**
 * FE03 "Locale configuration fields (OD-4)". The submitted pair is carried as
 * JSON text in hidden fields so the native form post stays a plain
 * form-urlencoded body that the facade parses into the contract request.
 */
export default function ContentSchemaRegistryLocaleFields({
  controller,
  mode,
  source,
  pending,
}: ContentSchemaRegistryLocaleFieldsProps): React.ReactElement {
  const config = submitConfig(controller.draft);
  const fixed =
    mode === 'successor' ? [config.sourceLocale, config.defaultLocale] : [];
  return (
    <div
      data-locale-fields
      className="content-schema-registry-locale-fields"
      aria-disabled={pending ? 'true' : undefined}
    >
      <ContentSchemaRegistryLocaleSummary controller={controller} />
      <ContentSchemaRegistryLocaleTags
        controller={controller}
        pending={pending}
        fixed={fixed}
      />
      {mode === 'create' ? (
        <ContentSchemaRegistryLocaleSelects
          controller={controller}
          pending={pending}
        />
      ) : (
        <ContentSchemaRegistryLocaleInherited
          sourceLocale={config.sourceLocale}
          defaultLocale={config.defaultLocale}
        />
      )}
      <ContentSchemaRegistryLocaleChains
        controller={controller}
        pending={pending}
      />
      <ContentSchemaRegistryLocaleReview
        draft={controller.draft}
        source={source}
      />
      <p role="status" aria-live="polite" data-locale-live>
        {controller.announcement}
      </p>
      <input
        type="hidden"
        name="supportedLocales"
        value={JSON.stringify(config.supportedLocales)}
      />
      <input
        type="hidden"
        name="fallbackChains"
        value={JSON.stringify(config.fallbackChains)}
      />
    </div>
  );
}
