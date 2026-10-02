import * as React from 'react';

import ContentSchemaRegistryCommandForm from './ContentSchemaRegistryCommandForm';
import type {
  ContentSchemaRegistryCommandState,
  ContentSchemaRegistryUiError,
} from './content-schema-registry-types';
import { JsonField, TextField } from './ContentSchemaRegistryCommandForm';
import ContentSchemaRegistryLocaleFields from './ContentSchemaRegistryLocaleFields';
import { emptyLocaleDraft } from './content-schema-registry-locale-config';
import { useLocaleConfigDraft } from './use-locale-config-draft';

const FORM_ID = 'content-schema-registry-create-form';

export interface ContentSchemaRegistryCreateFormProps {
  readonly action: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly state?: ContentSchemaRegistryCommandState;
  readonly error?: ContentSchemaRegistryUiError | undefined;
}

/** CMS-03A-01: native no-JS form for a complete content-type draft. */
export default function ContentSchemaRegistryCreateForm({
  action,
  csrfToken,
  idempotencyKey,
  state = 'idle',
  error,
}: ContentSchemaRegistryCreateFormProps): React.ReactElement {
  const locale = useLocaleConfigDraft(FORM_ID, emptyLocaleDraft());
  return (
    <ContentSchemaRegistryCommandForm
      action={action}
      csrfToken={csrfToken}
      idempotencyKey={idempotencyKey}
      operationId="CMS-03A-01"
      formId={FORM_ID}
      onSubmit={(event) => {
        if (!locale.guardSubmit()) event.preventDefault();
      }}
      state={state}
      {...(error === undefined ? {} : { error })}
      consequence="A new immutable content type draft and its initial version will be created."
    >
      <legend>Content type draft</legend>
      <TextField
        id="content-schema-registry-type-key"
        name="typeKey"
        label="Type key"
        maxLength={64}
        help="Use lowercase letters, numbers, and underscores; keys are never reused."
      />
      <TextField
        id="content-schema-registry-label"
        name="label"
        label="Display label"
        maxLength={120}
      />
      <TextField
        id="content-schema-registry-owner-capability"
        name="ownerCapability"
        label="Owner capability"
        maxLength={128}
        help="The server checks this capability against the selected acting context."
      />
      <ContentSchemaRegistryLocaleFields
        controller={locale}
        mode="create"
        source={null}
        pending={state === 'pending'}
      />
      <TextField
        id="content-schema-registry-workflow-key"
        name="workflowKey"
        label="Workflow key"
        maxLength={128}
      />
      <TextField
        id="content-schema-registry-workflow-version"
        name="workflowVersion"
        label="Workflow version"
        maxLength={32}
      />
      <TextField
        id="content-schema-registry-default-template-version-id"
        name="defaultTemplateVersionId"
        label="Default template version ID (optional)"
        required={false}
        help="Leave blank to submit null."
      />
      <JsonField
        id="content-schema-registry-fields"
        name="fields"
        label="Field definitions (JSON array)"
        defaultValue="[]"
        help="Use only the generated FieldDefinitionInput fields."
      />
      <JsonField
        id="content-schema-registry-relations"
        name="relations"
        label="Relation bindings (JSON array)"
        defaultValue="[]"
        help="Use only the generated RelationBindingInput fields."
      />
      <JsonField
        id="content-schema-registry-template-bindings"
        name="templateBindings"
        label="Template bindings (JSON array)"
        defaultValue="[]"
        help="Use only templateVersionId values returned by the server."
      />
      <JsonField
        id="content-schema-registry-capability-bindings"
        name="capabilityBindings"
        label="Capability bindings (JSON array)"
        defaultValue="[]"
        help="Use only capabilityKey and capabilityVersion pairs."
      />
    </ContentSchemaRegistryCommandForm>
  );
}
