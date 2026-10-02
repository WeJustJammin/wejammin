import * as React from 'react';

import ContentSchemaRegistryCommandForm, {
  TextField,
} from './ContentSchemaRegistryCommandForm';
import ContentSchemaRegistryLocaleFields from './ContentSchemaRegistryLocaleFields';
import {
  diffAgainstSource,
  draftFromConfig,
  type LocaleConfig,
} from './content-schema-registry-locale-config';
import { useLocaleConfigDraft } from './use-locale-config-draft';

/**
 * FE03 CMS-04a/b/c producers on the version page. Every form posts natively
 * to the version route; the route binds the path identifiers and the browser
 * supplies only the contract fields plus transport (CSRF, Idempotency-Key,
 * the exact source ETag). No version number, row id or identity is collected.
 */

export interface ContentSchemaRegistryVersionFormProps {
  readonly action: string;
  readonly contentTypeId: string;
  readonly versionId: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly ifMatch: string;
  readonly expectedVersion: string;
}

const PathFields = ({
  contentTypeId,
  versionId,
  expectedVersion,
}: Pick<
  ContentSchemaRegistryVersionFormProps,
  'contentTypeId' | 'versionId' | 'expectedVersion'
>): React.ReactElement => (
  <>
    <input type="hidden" name="contentTypeId" value={contentTypeId} />
    <input type="hidden" name="versionId" value={versionId} />
    <input type="hidden" name="expectedVersion" value={expectedVersion} />
  </>
);

const SUCCESSOR_FORM_ID = 'content-schema-registry-successor-form';

/**
 * CMS-03A-09: create the next draft from an immutable source version. The
 * locale configuration is kept (both fields null) or replaced (both present,
 * prefilled from the source); source and default language are inherited.
 */
export function ContentSchemaRegistrySuccessorForm(
  props: ContentSchemaRegistryVersionFormProps & {
    readonly sourceLocaleConfig: LocaleConfig;
  },
): React.ReactElement {
  const { sourceLocaleConfig } = props;
  const [choice, setChoice] = React.useState<'keep' | 'change'>('keep');
  const locale = useLocaleConfigDraft(
    SUCCESSOR_FORM_ID,
    draftFromConfig(sourceLocaleConfig),
  );
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
    </ContentSchemaRegistryCommandForm>
  );
}

/** CMS-03A-10: start the bounded dry run that produces the sealed report. */
export function ContentSchemaRegistryDryRunForm(
  props: ContentSchemaRegistryVersionFormProps,
): React.ReactElement {
  return (
    <ContentSchemaRegistryCommandForm
      action={props.action}
      csrfToken={props.csrfToken}
      idempotencyKey={props.idempotencyKey}
      ifMatch={props.ifMatch}
      expectedVersion={props.expectedVersion}
      operationId="CMS-03A-10"
      formId="content-schema-registry-dry-run-form"
      consequence="Queues a bounded dry run of this draft; the result appears only after the server seals the report."
    >
      <legend>Start schema dry run</legend>
      <PathFields {...props} />
      <TextField
        id="content-schema-registry-transform-key"
        name="transformKey"
        label="Transform key (optional)"
        required={false}
        maxLength={128}
        help="Enter both a transform key and its version, or leave both blank."
      />
      <TextField
        id="content-schema-registry-transform-version"
        name="transformVersion"
        label="Transform version (optional)"
        required={false}
        maxLength={19}
        help="Provide a version together with the key; neither is sent when both are blank."
      />
    </ContentSchemaRegistryCommandForm>
  );
}

/** CMS-03A-11: submit the sealed passed dry run for independent review. */
export function ContentSchemaRegistrySubmitReviewForm({
  dryRunId,
  ...props
}: ContentSchemaRegistryVersionFormProps & {
  readonly dryRunId: string;
}): React.ReactElement {
  return (
    <ContentSchemaRegistryCommandForm
      action={props.action}
      csrfToken={props.csrfToken}
      idempotencyKey={props.idempotencyKey}
      ifMatch={props.ifMatch}
      expectedVersion={props.expectedVersion}
      operationId="CMS-03A-11"
      formId="content-schema-registry-submit-review-form"
      consequence="Freezes this draft and its passed dry run for reviewers; editing is blocked until the review ends."
    >
      <legend>Submit for review</legend>
      <PathFields {...props} />
      <input type="hidden" name="dryRunId" value={dryRunId} />
      <p className="content-schema-registry-help">
        The sealed dry run for this exact version is submitted with the draft.
      </p>
    </ContentSchemaRegistryCommandForm>
  );
}
