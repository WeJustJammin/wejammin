import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import ContentSchemaRegistryLocaleFields from './ContentSchemaRegistryLocaleFields';
import ContentSchemaRegistryTemplateFields from './ContentSchemaRegistryTemplateFields';
import {
  PathFields,
  type ContentSchemaRegistryVersionFormProps,
} from './ContentSchemaRegistryVersionFormParts';
import {
  diffAgainstSource,
  draftFromConfig,
  type LocaleConfig,
} from './content-schema-registry-locale-config';
import type { SourceTemplates } from './content-schema-registry-template-binding';
import { useLocaleConfigDraft } from './use-locale-config-draft';
import { useTemplateChoice } from './use-template-choice';

const SUCCESSOR_FORM_ID = 'content-schema-registry-successor-form';

/**
 * CMS-03A-09: create the next draft from an immutable source version. The
 * locale configuration and the template configuration (DEC-123) are each kept
 * (both members null) or replaced (both present, prefilled from the source);
 * source and default language are inherited.
 */
export default function ContentSchemaRegistrySuccessorForm(
  props: ContentSchemaRegistryVersionFormProps & {
    readonly sourceLocaleConfig: LocaleConfig;
    readonly sourceTemplateConfig: SourceTemplates;
  },
): React.ReactElement {
  const { sourceLocaleConfig, sourceTemplateConfig } = props;
  const [choice, setChoice] = React.useState<'keep' | 'change'>('keep');
  const locale = useLocaleConfigDraft(
    SUCCESSOR_FORM_ID,
    draftFromConfig(sourceLocaleConfig),
  );
  const templates = useTemplateChoice(SUCCESSOR_FORM_ID, sourceTemplateConfig);
  const keep = (): void => {
    const diff = diffAgainstSource(sourceLocaleConfig, locale.draft);
    const changed =
      diff.added.length + diff.removed.length + diff.reordered.length;
    if (
      changed > 0 &&
      !window.confirm(
        `Discard ${changed} changed ${changed === 1 ? 'item' : 'items'} and keep the current languages and fallback orders?`,
      )
    )
      return;
    locale.replace(draftFromConfig(sourceLocaleConfig));
    setChoice('keep');
  };
  return (
    <ContentSchemaRegistryCommandForm
      action={props.action}
      csrfToken={props.csrfToken}
      idempotencyKey={props.idempotencyKey}
      ifMatch={props.ifMatch}
      expectedVersion={props.expectedVersion}
      operationId="CMS-03A-09"
      formId={SUCCESSOR_FORM_ID}
      consequence="Creates the next editable draft from this version; this version is unchanged."
      onSubmit={(event) => {
        if (choice === 'change' && !locale.guardSubmit())
          event.preventDefault();
        else if (!templates.guardSubmit()) event.preventDefault();
      }}
    >
      <legend>Create successor draft</legend>
      <PathFields {...props} />
      <p className="content-schema-registry-help">
        The server assigns the new version number and copies the fields of this
        version into the draft.
      </p>
      <fieldset data-locale-choice>
        <legend>Languages in the new version</legend>
        <label>
          <input
            type="radio"
            name="localeChoice"
            value="keep"
            checked={choice === 'keep'}
            onChange={keep}
          />{' '}
          Keep the current languages and fallback orders
        </label>
        <label>
          <input
            type="radio"
            name="localeChoice"
            value="change"
            checked={choice === 'change'}
            onChange={() => setChoice('change')}
          />{' '}
          Change languages and fallback orders
        </label>
      </fieldset>
      {choice === 'change' ? (
        <ContentSchemaRegistryLocaleFields
          controller={locale}
          mode="successor"
          source={sourceLocaleConfig}
          pending={false}
        />
      ) : (
        <>
          <input type="hidden" name="supportedLocales" value="null" />
          <input type="hidden" name="fallbackChains" value="null" />
        </>
      )}
      <ContentSchemaRegistryTemplateFields controller={templates} />
    </ContentSchemaRegistryCommandForm>
  );
}
