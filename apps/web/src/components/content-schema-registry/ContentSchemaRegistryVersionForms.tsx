import * as React from 'react';

import ContentSchemaRegistryCommandForm, {
  TextField,
} from './ContentSchemaRegistryCommandForm';

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

/** CMS-03A-09: create the next draft from an immutable source version. */
export function ContentSchemaRegistrySuccessorForm(
  props: ContentSchemaRegistryVersionFormProps,
): React.ReactElement {
  return (
    <ContentSchemaRegistryCommandForm
      action={props.action}
      csrfToken={props.csrfToken}
      idempotencyKey={props.idempotencyKey}
      ifMatch={props.ifMatch}
      expectedVersion={props.expectedVersion}
      operationId="CMS-03A-09"
      formId="content-schema-registry-successor-form"
      consequence="Creates the next editable draft from this version; this version is unchanged."
    >
      <legend>Create successor draft</legend>
      <PathFields {...props} />
      <p className="content-schema-registry-help">
        The server assigns the new version number and copies the fields of this
        version into the draft.
      </p>
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
